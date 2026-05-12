import { GoogleGenAI }    from '@google/genai'
import { type OcrService } from '../OcrService.js'
import { validateLabResult, type LabResult } from '../types.js'
import { OcrProviderError, OcrValidationError, OcrTimeoutError } from '../errors.js'
import { SYSTEM_INSTRUCTION, PARSE_PROMPT } from '../prompts/analysis.js'
import logger from '../../core/logger.js'

type GeminiAdapterConfig = {
    apiKey:      string
    timeoutMs?:  number
    maxRetries?: number
}

export class GeminiAdapter implements OcrService {
    private readonly ai:         GoogleGenAI
    private readonly timeoutMs:  number
    private readonly maxRetries: number

    constructor(cfg: GeminiAdapterConfig) {
        this.ai = new GoogleGenAI({
            apiKey:      cfg.apiKey,
            httpOptions: { headers: { 'Accept-Encoding': 'identity' } }
        })
        this.timeoutMs  = cfg.timeoutMs  ?? 60_000
        this.maxRetries = cfg.maxRetries ?? 3
    }

    async parseLabResult(buffer: Buffer, mimeType = 'application/pdf'): Promise<LabResult> {
        return this.callWithRetry(buffer, mimeType, this.maxRetries)
    }

    private async callWithRetry(
        buffer: Buffer,
        mimeType: string,
        retriesLeft: number,
        delay = 1000
    ): Promise<LabResult> {
        try {
            return await this.callGemini(buffer, mimeType)
        } catch (err) {
            // Validation errors — retry бесполезен, ответ уже пришёл но невалиден
            if (err instanceof OcrValidationError) throw err

            if (retriesLeft === 0) throw err

            const isRetryable = err instanceof OcrProviderError || err instanceof OcrTimeoutError
            if (!isRetryable) throw err

            const jitter = Math.floor(Math.random() * 1000)
            const waitMs = delay + jitter

            logger.warn(
                { retriesLeft, waitMs, errName: err instanceof Error ? err.name : 'unknown' },
                'OCR retry'
            )
            await new Promise(resolve => setTimeout(resolve, waitMs))
            return this.callWithRetry(buffer, mimeType, retriesLeft - 1, delay * 2)
        }
    }

    private async callGemini(buffer: Buffer, mimeType: string): Promise<LabResult> {
        const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(
                () => reject(new OcrTimeoutError(`Gemini timeout after ${this.timeoutMs}ms`)),
                this.timeoutMs
            )
        )

        const apiCall = this.ai.models.generateContent({
            model:    'gemini-2.5-flash',
            config:   {
                systemInstruction: SYSTEM_INSTRUCTION,
                responseMimeType:  'application/json',
                temperature:       0
            },
            contents: [{
                parts: [
                    { text: PARSE_PROMPT },
                    { inlineData: { mimeType, data: buffer.toString('base64') } }
                ]
            }]
        }).catch(err => {
            const status = err instanceof Object && 'status' in err
                ? (err as { status: number }).status
                : undefined
            throw new OcrProviderError(
                `Gemini API error: ${err instanceof Error ? err.message : String(err)}`,
                status
            )
        })

        const response = await Promise.race([apiCall, timeoutPromise])

        try {
            const rawText = response.text ?? ''
            if (!rawText) throw new OcrValidationError('Gemini returned empty response')
            const parsed = JSON.parse(rawText)
            return validateLabResult(parsed)
        } catch (err) {
            if (err instanceof OcrValidationError) throw err
            logger.error({ err, rawResponse: response.text }, 'Failed to parse Gemini response')
            throw new OcrValidationError(
                `Invalid JSON from Gemini: ${err instanceof Error ? err.message : String(err)}`
            )
        }
    }
}
