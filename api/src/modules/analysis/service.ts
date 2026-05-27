import { uploadFile } from '../../services/storage.js'
import { analysisQueue } from '../../queues/analysisQueue.js'
import { type AnalysisRepository } from './repository.js'
import { AnalysisNotFoundError, NothingUploadedError } from './errors.js'
import { NotFoundError } from '../../core/errors.js'

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
    constructor(private repo: AnalysisRepository) {}

    async createAnalysis(userId: string, files: FileInput[], opts: CreateAnalysisOptions = {}) {
        if (files.length === 0) throw new NothingUploadedError()

        const results: Array<{ analysisId: number; status: string }> = []

        for (const file of files) {
            const fileKey = await uploadFile(file.buffer, file.originalName, file.mimeType)
            const analysis = await this.repo.insert({
                userId,
                fileKey,
                fileOriginalName: file.originalName,
                fileMimeType: file.mimeType,
                fileSize: file.buffer.length,
                analysisType: opts.analysisType,
                typeSource: opts.analysisType ? 'manual' : 'ai',
                ocrProvider: opts.ocrProvider,
            })

            await analysisQueue.add('parse', {
                analysisId: analysis.id,
                fileKey,
                mimeType: file.mimeType,
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

    // Per decision 039: editing creates a new marker row with is_edited=true (append-only)
    async updateMarker(markerId: number, userId: string, input: MarkerEditInput) {
        const existing = await this.repo.findMarkerWithOwner(markerId, userId)
        if (!existing) throw new NotFoundError('MARKER_NOT_FOUND', 'Marker not found')

        // Compute merged numeric values for isOutOfRange recalculation
        const mergedValue  = input.value        !== undefined ? input.value        : (existing.value        !== null ? Number(existing.value)        : null)
        const mergedMin    = input.referenceMin  !== undefined ? input.referenceMin  : (existing.referenceMin  !== null ? Number(existing.referenceMin)  : null)
        const mergedMax    = input.referenceMax  !== undefined ? input.referenceMax  : (existing.referenceMax  !== null ? Number(existing.referenceMax)  : null)

        const tooLow  = mergedValue !== null && mergedMin !== null && Number.isFinite(mergedValue) && Number.isFinite(mergedMin)  && mergedValue < mergedMin
        const tooHigh = mergedValue !== null && mergedMax !== null && Number.isFinite(mergedValue) && Number.isFinite(mergedMax) && mergedValue > mergedMax

        const inserted = await this.repo.insertMarker({
            analysisId:          existing.analysisId,
            name:                input.name           !== undefined ? input.name           : existing.name,
            code:                existing.code,
            section:             existing.section,
            value:               input.value          !== undefined ? (input.value          !== null ? String(input.value)         : null) : existing.value,
            unit:                input.unit           !== undefined ? input.unit           : existing.unit,
            referenceMin:        input.referenceMin   !== undefined ? (input.referenceMin   !== null ? String(input.referenceMin)  : null) : existing.referenceMin,
            referenceMax:        input.referenceMax   !== undefined ? (input.referenceMax   !== null ? String(input.referenceMax)  : null) : existing.referenceMax,
            referenceRaw:        existing.referenceRaw,
            isOutOfRange:        tooLow || tooHigh,
            outOfRangeDirection: tooLow ? 'low' : tooHigh ? 'high' : null,
            isEdited:            true,
            originalValue:       existing.value,
            comment:             input.comment        !== undefined ? input.comment        : existing.comment,
            method:              existing.method,
        })

        if (!inserted) throw new NotFoundError('MARKER_NOT_FOUND', 'Marker not found')
        return inserted
    }
}