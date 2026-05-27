import { type OcrService } from '../OcrService.js'
import { validateLabResult, type LabResult } from '../types.js'
import { OcrProviderError, OcrValidationError, OcrTimeoutError } from '../errors.js'
import { SYSTEM_INSTRUCTION } from '../prompts/analysis.js'
import logger from '../../core/logger.js'

type YandexAdapterConfig = {
    apiKey:      string
    folderId:    string
    timeoutMs?:  number
    maxRetries?: number
}

const VISION_SYNC_URL   = 'https://ocr.api.cloud.yandex.net/ocr/v1/recognizeText'
const VISION_ASYNC_URL  = 'https://ocr.api.cloud.yandex.net/ocr/v1/recognizeTextAsync'
const VISION_RESULT_URL = 'https://ocr.api.cloud.yandex.net/ocr/v1/getRecognizeTextResult'
const GPT_URL           = 'https://llm.api.cloud.yandex.net/foundationModels/v1/completion'

const TEXT_PARSE_PROMPT = `Ниже — текст, распознанный OCR из медицинского лабораторного бланка. Разбери его и верни результат строго по схеме из системного промпта. Если текст не является результатом лабораторного анализа — верни {"notALabResult": true}. Только JSON, без дополнительного текста.\n\nТЕКСТ БЛАНКА:\n`

export class YandexAdapter implements OcrService {
    private readonly apiKey:     string
    private readonly folderId:   string
    private readonly timeoutMs:  number
    private readonly maxRetries: number

    constructor(cfg: YandexAdapterConfig) {
        this.apiKey     = cfg.apiKey
        this.folderId   = cfg.folderId
        this.timeoutMs  = cfg.timeoutMs  ?? 60_000
        this.maxRetries = cfg.maxRetries ?? 3
    }

    async parseLabResult(buffer: Buffer, mimeType: string, _analysisType?: string): Promise<LabResult> {
        return this.withRetry(() => this.run(buffer, mimeType))
    }

    private async run(buffer: Buffer, mimeType: string): Promise<LabResult> {
        const rawText = await this.visionOcr(buffer, mimeType)
        if (!rawText.trim()) throw new OcrValidationError('EMPTY_OCR_RESULT')
        return this.gptStructure(rawText)
    }

    // Step 1 — Yandex Vision OCR: sync (1 page) with fallback to async (multi-page)
    private async visionOcr(buffer: Buffer, mimeType: string): Promise<string> {
        try {
            return await this.visionOcrSync(buffer, mimeType)
        } catch (err) {
            if (err instanceof OcrProviderError && err.statusCode === 400 &&
                err.message.includes('page limit')) {
                return await this.visionOcrAsync(buffer, mimeType)
            }
            throw err
        }
    }

    private async visionOcrSync(buffer: Buffer, mimeType: string): Promise<string> {
        const body = {
            content:       buffer.toString('base64'),
            mimeType:      mimeType,
            languageCodes: ['ru'],
            model:         'page',
        }

        const abort = new AbortController()
        const timer = setTimeout(() => abort.abort(), this.timeoutMs)

        let response: Response
        try {
            response = await fetch(VISION_SYNC_URL, {
                method:  'POST',
                headers: {
                    'Content-Type':  'application/json',
                    'Authorization': `Api-Key ${this.apiKey}`,
                    'x-folder-id':   this.folderId,
                },
                body:   JSON.stringify(body),
                signal: abort.signal,
            })
        } catch (err) {
            if (err instanceof Error && err.name === 'AbortError')
                throw new OcrTimeoutError(`Yandex Vision OCR timeout after ${this.timeoutMs}ms`)
            throw new OcrProviderError(`Yandex Vision fetch error: ${err instanceof Error ? err.message : String(err)}`)
        } finally {
            clearTimeout(timer)
        }

        if (!response.ok) {
            const text = await response.text().catch(() => '')
            throw new OcrProviderError(`Yandex Vision error ${response.status}: ${text}`, response.status)
        }

        type Block = { lines?: Array<{ text?: string }> }
        type Page  = { blocks?: Block[] }
        const json = await response.json() as {
            result?: {
                textAnnotation?: {
                    fullText?: string
                    blocks?: Block[]
                    pages?:  Page[]
                }
            }
        }

        const annotation = json.result?.textAnnotation
        logger.info({
            hasFullText: !!annotation?.fullText,
            fullTextLen: annotation?.fullText?.length ?? 0,
            blockCount:  annotation?.blocks?.length ?? 0,
            pageCount:   annotation?.pages?.length ?? 0,
            rawPreview:  JSON.stringify(json).slice(0, 500),
        }, 'Vision OCR sync response')

        if (annotation?.fullText?.trim()) return annotation.fullText

        // Fallback: try top-level blocks, then pages[].blocks
        const extractFromBlocks = (blocks: Block[]) =>
            blocks.flatMap(b => b.lines ?? []).map(l => l.text ?? '').filter(Boolean).join('\n')

        const fromBlocks = extractFromBlocks(annotation?.blocks ?? [])
        if (fromBlocks.trim()) return fromBlocks

        const fromPages = (annotation?.pages ?? [])
            .flatMap(p => extractFromBlocks(p.blocks ?? []))
            .join('\n')

        return fromPages
    }

    private async visionOcrAsync(buffer: Buffer, mimeType: string): Promise<string> {
        const body = {
            content:       buffer.toString('base64'),
            mimeType:      mimeType,
            languageCodes: ['ru'],
            model:         'page',
        }

        const headers = {
            'Content-Type':  'application/json',
            'Authorization': `Api-Key ${this.apiKey}`,
            'x-folder-id':   this.folderId,
        }

        // Start async operation
        const startRes = await fetch(VISION_ASYNC_URL, {
            method: 'POST', headers, body: JSON.stringify(body),
        }).catch(err => { throw new OcrProviderError(`Yandex Vision async start error: ${err instanceof Error ? err.message : String(err)}`) })

        if (!startRes.ok) {
            const text = await startRes.text().catch(() => '')
            throw new OcrProviderError(`Yandex Vision async error ${startRes.status}: ${text}`, startRes.status)
        }

        const { id: operationId } = await startRes.json() as { id?: string }
        if (!operationId) throw new OcrProviderError('Yandex Vision async: no operation ID returned')

        // getRecognition is a streaming endpoint — call immediately, it blocks until done
        const abort = new AbortController()
        const timer = setTimeout(() => abort.abort(), this.timeoutMs)

        let resultRes: Response
        try {
            resultRes = await fetch(`${VISION_RESULT_URL}?operationId=${operationId}`, {
                headers,
                signal: abort.signal,
            })
        } catch (err) {
            if (err instanceof Error && err.name === 'AbortError')
                throw new OcrTimeoutError(`Yandex Vision async timeout after ${this.timeoutMs}ms`)
            throw new OcrProviderError(`Yandex Vision get result error: ${err instanceof Error ? err.message : String(err)}`)
        } finally {
            clearTimeout(timer)
        }

        if (!resultRes.ok) {
            const text = await resultRes.text().catch(() => '')
            throw new OcrProviderError(`Yandex Vision get result error ${resultRes.status}: ${text}`, resultRes.status)
        }

        // Response is NDJSON: one JSON object per page
        const rawBody = await resultRes.text()
        logger.info({ rawPreview: rawBody.slice(0, 800) }, 'Vision OCR async result')

        type PageResult = {
            textAnnotation?: {
                fullText?: string
                blocks?: Array<{ lines?: Array<{ text?: string }> }>
            }
        }

        const pageTexts: string[] = []
        for (const line of rawBody.split('\n').filter(l => l.trim())) {
            try {
                const page = JSON.parse(line) as PageResult
                const annotation = page.textAnnotation
                if (annotation?.fullText?.trim()) {
                    pageTexts.push(annotation.fullText)
                } else {
                    const t = (annotation?.blocks ?? [])
                        .flatMap(b => b.lines ?? []).map(l => l.text ?? '').filter(Boolean).join('\n')
                    if (t.trim()) pageTexts.push(t)
                }
            } catch { /* skip invalid lines */ }
        }

        return pageTexts.join('\n\n')
    }

    // Step 2 — YandexGPT: extracted text → LabResult JSON
    private async gptStructure(ocrText: string): Promise<LabResult> {
        const body = {
            modelUri: `gpt://${this.folderId}/yandexgpt/latest`,
            completionOptions: {
                stream:      false,
                temperature: 0,
                maxTokens:   '8000',
            },
            messages: [
                { role: 'system', text: SYSTEM_INSTRUCTION },
                { role: 'user',   text: TEXT_PARSE_PROMPT + ocrText },
            ],
        }

        const abort = new AbortController()
        const timer = setTimeout(() => abort.abort(), this.timeoutMs)

        let response: Response
        try {
            response = await fetch(GPT_URL, {
                method:  'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Api-Key ${this.apiKey}`,
                    'x-folder-id':  this.folderId,
                },
                body:   JSON.stringify(body),
                signal: abort.signal,
            })
        } catch (err) {
            if (err instanceof Error && err.name === 'AbortError')
                throw new OcrTimeoutError(`Yandex GPT timeout after ${this.timeoutMs}ms`)
            throw new OcrProviderError(`Yandex GPT fetch error: ${err instanceof Error ? err.message : String(err)}`)
        } finally {
            clearTimeout(timer)
        }

        if (!response.ok) {
            const text = await response.text().catch(() => '')
            throw new OcrProviderError(`Yandex GPT error ${response.status}: ${text}`, response.status)
        }

        const json = await response.json() as {
            result?: { alternatives?: Array<{ message?: { text?: string } }> }
        }

        const rawText = json.result?.alternatives?.[0]?.message?.text ?? ''
        if (!rawText) throw new OcrValidationError('Yandex GPT returned empty response')

        try {
            const cleaned = rawText.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim()
            return validateLabResult(JSON.parse(cleaned))
        } catch (err) {
            if (err instanceof OcrValidationError) throw err
            logger.error({ err, rawText }, 'Failed to parse Yandex GPT response')
            throw new OcrValidationError(
                `Invalid JSON from Yandex GPT: ${err instanceof Error ? err.message : String(err)}`
            )
        }
    }

    private async withRetry(fn: () => Promise<LabResult>, retriesLeft = this.maxRetries, delay = 1000): Promise<LabResult> {
        try {
            return await fn()
        } catch (err) {
            if (err instanceof OcrValidationError) throw err
            if (retriesLeft === 0) throw err

            const isRetryable = err instanceof OcrProviderError || err instanceof OcrTimeoutError
            if (!isRetryable) throw err

            const waitMs = delay + Math.floor(Math.random() * 1000)
            logger.warn({ retriesLeft, waitMs, err: err instanceof Error ? err.message : String(err) }, 'Yandex OCR retry')
            await new Promise(resolve => setTimeout(resolve, waitMs))
            return this.withRetry(fn, retriesLeft - 1, delay * 2)
        }
    }
}