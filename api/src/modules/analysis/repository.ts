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
    analysisType?: string
    typeSource?: string
    ocrProvider?: string
}

type NewMarker = {
    analysisId: number
    name: string
    code?: string | null
    section?: string | null
    value?: string | null
    unit?: string | null
    referenceMin?: string | null
    referenceMax?: string | null
    referenceRaw?: string | null
    isOutOfRange: boolean
    outOfRangeDirection?: 'low' | 'high' | null
    isEdited?: boolean
    originalValue?: string | null
    comment?: string | null
    method?: string | null
}

type MarkerUpdate = Partial<{
    name: string
    value: string | null
    unit: string | null
    referenceMin: string | null
    referenceMax: string | null
    comment: string | null
    isOutOfRange: boolean
    outOfRangeDirection: 'low' | 'high' | null
    isEdited: boolean
    originalValue: string | null
}>

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
                detectedTypes: analyses.detectedTypes,
                analysisType: analyses.analysisType,
                typeSource: analyses.typeSource,
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

    // Returns latest version of each (name, method) pair — safety net for legacy append-only data.
    // With update-in-place (decision 030) each marker has exactly one row, so dedup is a no-op.
    async findMarkersByAnalysisId(analysisId: number) {
        const all = await this.db
            .select()
            .from(markers)
            .where(eq(markers.analysisId, analysisId))
            .orderBy(desc(markers.id))

        const seen = new Set<string>()
        const latest: typeof all = []
        for (const m of all) {
            const key = `${m.name}|${m.method ?? ''}`
            if (!seen.has(key)) {
                seen.add(key)
                latest.push(m)
            }
        }
        return latest.reverse()
    }

    async findMarkerWithOwner(markerId: number, userId: string) {
        const rows = await this.db
            .select({ marker: markers, analysisUserId: analyses.userId })
            .from(markers)
            .innerJoin(analyses, eq(markers.analysisId, analyses.id))
            .where(and(eq(markers.id, markerId), eq(analyses.userId, userId)))
        return rows[0]?.marker ?? null
    }

    async insertMarker(data: NewMarker) {
        const [inserted] = await this.db.insert(markers).values(data).returning()
        return inserted ?? null
    }

    async updateMarker(markerId: number, data: MarkerUpdate) {
        const [updated] = await this.db
            .update(markers)
            .set(data)
            .where(eq(markers.id, markerId))
            .returning()
        return updated ?? null
    }
}
