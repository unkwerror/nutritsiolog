import { type LabResult } from './types.js'

export interface OcrService {
    parseLabResult(buffer: Buffer, mimeType: string, analysisType?: string): Promise<LabResult>
}