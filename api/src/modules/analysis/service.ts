import { uploadFile } from '../../services/storage.js'
import { analysisQueue } from '../../queues/analysisQueue.js'
import { type AnalysisRepository } from './repository.js'
import { AnalysisNotFoundError, NothingUploadedError } from './errors.js'

type FileInput = {
    buffer: Buffer
    mimeType: string
    originalName: string
}

export class AnalysisService {
    constructor(private repo: AnalysisRepository) {}

    async createAnalysis(userId: string, files: FileInput[]) {
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
            })

            await analysisQueue.add('parse', {
                analysisId: analysis.id,
                fileKey,
                mimeType: file.mimeType,
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
}
