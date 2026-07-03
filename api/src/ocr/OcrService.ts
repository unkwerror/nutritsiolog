import { type LabResult } from './types.js'

// Прогресс распознавания 0..1 — адаптер вызывает по мере прохождения этапов
// (например, после Vision OCR и перед возвратом структуры от GPT). Воркер
// транслирует его в проценты и публикует в SSE.
export type OcrProgress = (fraction: number) => void

export interface OcrService {
    parseLabResult(
        buffer: Buffer,
        mimeType: string,
        analysisType?: string,
        onProgress?: OcrProgress
    ): Promise<LabResult>
}
