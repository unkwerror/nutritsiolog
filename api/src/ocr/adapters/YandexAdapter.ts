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

const VISION_SYNC_URL  = 'https://ocr.api.cloud.yandex.net/ocr/v1/recognizeText'
const VISION_ASYNC_URL = 'https://ocr.api.cloud.yandex.net/ocr/v1/recognizeTextAsync'
const OPERATION_URL    = 'https://operation.api.cloud.yandex.net/operations'
const GPT_URL          = 'https://llm.api.cloud.yandex.net/foundationModels/v1/completion'

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

        const json = await response.json() as {
            result?: {
                textAnnotation?: {
                    fullText?: string
                    blocks?: Array<{ lines?: Array<{ text?: string }> }>
                }
            }
        }

        const annotation = json.result?.textAnnotation
        logger.debug({ hasFullText: !!annotation?.fullText, blockCount: annotation?.blocks?.length }, 'Vision OCR sync response')

        if (annotation?.fullText?.trim()) return annotation.fullText

        // Fallback: extract text from blocks if fullText is absent
        const blocksText = (annotation?.blocks ?? [])
            .flatMap(b => b.lines ?? [])
            .map(l => l.text ?? '')
            .filter(Boolean)
            .join('\n')

        return blocksText
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

        // Poll until done (max 30 attempts × 2s = 60s)
        const deadline = Date.now() + this.timeoutMs
        for (let attempt = 0; attempt < 30; attempt++) {
            await new Promise(r => setTimeout(r, 2000))
            if (Date.now() > deadline) throw new OcrTimeoutError('Yandex Vision async timeout')

            const pollRes = await fetch(`${OPERATION_URL}/${operationId}`, { headers }).catch(() => null)
            if (!pollRes?.ok) continue

            const op = await pollRes.json() as {
                done?: boolean
                response?: {
                    textAnnotation?: {
                        fullText?: string
                        blocks?: Array<{ lines?: Array<{ text?: string }> }>
                    }
                }
                error?: { message?: string }
            }

            if (op.error?.message) throw new OcrProviderError(`Yandex Vision async failed: ${op.error.message}`)
            if (op.done) {
                const annotation = op.response?.textAnnotation
                if (annotation?.fullText?.trim()) return annotation.fullText
                return (annotation?.blocks ?? [])
                    .flatMap(b => b.lines ?? [])
                    .map(l => l.text ?? '')
                    .filter(Boolean)
                    .join('\n')
            }
        }

        throw new OcrTimeoutError('Yandex Vision async: max poll attempts exceeded')
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