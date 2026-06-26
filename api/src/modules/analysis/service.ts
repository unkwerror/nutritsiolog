import { fileTypeFromBuffer } from 'file-type'
import { type StoragePort } from './infrastructure/storage.js'
import { type QueuePort } from './infrastructure/queue.js'
import { type AnalysisRepository } from './repository.js'
import { AnalysisNotFoundError, NothingUploadedError } from './errors.js'
import { NotFoundError, ValidationError } from '../../core/errors.js'

const ALLOWED_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png'] as const

type FileInput = {
    buffer: Buffer
    mimeType: string
    originalName: string
}

type CreateAnalysisOptions = {
    analysisType?: string
    ocrProvider?: string
}

type MarkerEditInput = {
    value?: number | null
    unit?: string | null
    referenceMin?: number | null
    referenceMax?: number | null
    name?: string
    comment?: string | null
}

export class AnalysisService {
    constructor(
        private repo: AnalysisRepository,
        private storage: StoragePort,
        private queue: QueuePort
    ) {}

    async createAnalysis(userId: string, files: FileInput[], opts: CreateAnalysisOptions = {}) {
        if (files.length === 0) throw new NothingUploadedError()

        const results: Array<{ analysisId: number; status: string }> = []

        for (const file of files) {
            // 10.3: validate MIME by magic bytes, not client-provided Content-Type
            const detected = await fileTypeFromBuffer(file.buffer)
            if (!detected || !(ALLOWED_MIME_TYPES as readonly string[]).includes(detected.mime)) {
                throw new ValidationError(
                    'INVALID_FILE_TYPE',
                    `Unsupported file type: ${detected?.mime ?? 'unknown'}`
                )
            }

            const fileKey = await this.storage.upload(file.buffer, file.originalName, detected.mime)
            const analysis = await this.repo.insert({
                userId,
                fileKey,
                fileOriginalName: file.originalName,
                fileMimeType: detected.mime,
                fileSize: file.buffer.length,
                analysisType: opts.analysisType,
                typeSource: opts.analysisType ? 'manual' : 'ai',
                ocrProvider: opts.ocrProvider,
            })

            await this.queue.add({
                analysisId: analysis.id,
                fileKey,
                mimeType: detected.mime,
                analysisType: opts.analysisType,
                ocrProvider: opts.ocrProvider,
            })

            results.push({ analysisId: analysis.id, status: 'pending' })
        }

        return results.length === 1 ? results[0]! : results
    }

    async listAnalyses(userId: string) {
        return this.repo.findAllByUser(userId)
    }

    async getAnalysis(id: number, userId: string) {
        const analysis = await this.repo.findByIdAndUser(id, userId)
        if (!analysis) throw new AnalysisNotFoundError()
        const analysisMarkers = await this.repo.findMarkersByAnalysisId(id)
        return { ...analysis, markers: analysisMarkers }
    }

    // Decision 030: update-in-place (not append-only).
    // isOutOfRange is preserved from OCR unless user explicitly changes referenceMin/Max.
    async updateMarker(markerId: number, userId: string, input: MarkerEditInput) {
        const existing = await this.repo.findMarkerWithOwner(markerId, userId)
        if (!existing) throw new NotFoundError('MARKER_NOT_FOUND', 'Marker not found')

        const userChangedRef = input.referenceMin !== undefined || input.referenceMax !== undefined

        let isOutOfRange = existing.isOutOfRange
        let outOfRangeDirection = existing.outOfRangeDirection

        if (userChangedRef) {
            const mergedValue =
                input.value !== undefined
                    ? input.value
                    : existing.value !== null
                      ? Number(existing.value)
                      : null
            const mergedMin =
                input.referenceMin !== undefined
                    ? input.referenceMin
                    : existing.referenceMin !== null
                      ? Number(existing.referenceMin)
                      : null
            const mergedMax =
                input.referenceMax !== undefined
                    ? input.referenceMax
                    : existing.referenceMax !== null
                      ? Number(existing.referenceMax)
                      : null

            const tooLow =
                mergedValue !== null &&
                mergedMin !== null &&
                Number.isFinite(mergedValue) &&
                Number.isFinite(mergedMin) &&
                mergedValue < mergedMin
            const tooHigh =
                mergedValue !== null &&
                mergedMax !== null &&
                Number.isFinite(mergedValue) &&
                Number.isFinite(mergedMax) &&
                mergedValue > mergedMax

            isOutOfRange = tooLow || tooHigh
            outOfRangeDirection = tooLow ? 'low' : tooHigh ? 'high' : null
        }

        // originalValue stores the first (OCR) value — only set on the first edit
        const originalValue =
            !existing.isEdited && input.value !== undefined ? existing.value : undefined

        const updated = await this.repo.updateMarker(markerId, {
            ...(input.name !== undefined ? { name: input.name } : {}),
            ...(input.value !== undefined
                ? { value: input.value !== null ? String(input.value) : null }
                : {}),
            ...(input.unit !== undefined ? { unit: input.unit } : {}),
            ...(input.referenceMin !== undefined
                ? { referenceMin: input.referenceMin !== null ? String(input.referenceMin) : null }
                : {}),
            ...(input.referenceMax !== undefined
                ? { referenceMax: input.referenceMax !== null ? String(input.referenceMax) : null }
                : {}),
            ...(input.comment !== undefined ? { comment: input.comment } : {}),
            isOutOfRange,
            outOfRangeDirection,
            isEdited: true,
            ...(originalValue !== undefined ? { originalValue } : {}),
        })

        if (!updated) throw new NotFoundError('MARKER_NOT_FOUND', 'Marker not found')
        return updated
    }
}
