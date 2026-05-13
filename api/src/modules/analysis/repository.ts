import { eq, and, desc } from 'drizzle-orm'
import { type PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import { analyses, markers } from '../../db/schema.js'

type DB = PostgresJsDatabase
type NewAnalysis = {
    userId: string
    fileKey: string
    fileOriginalName: string
    fileMimeType: string
    fileSize: number
}

export class AnalysisRepository {
    constructor(private db: DB) {}

    async insert(data: NewAnalysis) {
        const [analysis] = await this.db
            .insert(analyses)
            .values({
                ...data,
                status: 'pending',
            })
            .returning()
        if (!analysis) throw new Error('Insert returned no rows')
        return analysis
    }

    async findAllByUser(userId: string) {
        return this.db
            .select({
                id: analyses.id,
                status: analyses.status,
                labName: analyses.labName,
                fileOriginalName: analyses.fileOriginalName,
                fileMimeType: analyses.fileMimeType,
                fileSize: analyses.fileSize,
                isArchived: analyses.isArchived,
                createdAt: analyses.createdAt,
                updatedAt: analyses.updatedAt,
            })
            .from(analyses)
            .where(and(eq(analyses.userId, userId), eq(analyses.isArchived, false)))
            .orderBy(desc(analyses.createdAt))
    }

    async findByIdAndUser(id: number, userId: string) {
        const [analysis] = await this.db
            .select()
            .from(analyses)
            .where(and(eq(analyses.id, id), eq(analyses.userId, userId)))
        return analysis ?? null
    }

    async findMarkersByAnalysisId(analysisId: number) {
        return this.db.select().from(markers).where(eq(markers.analysisId, analysisId))
    }
}
