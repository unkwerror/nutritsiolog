import { eq, and, desc, inArray } from 'drizzle-orm'
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
    valueText?: string | null
    unit?: string | null
    referenceMin?: string | null
    referenceMax?: string | null
    referenceRaw?: string | null
    isOutOfRange: boolean
    outOfRangeDirection?: 'low' | 'high' | null
    isEdited?: boolean
    originalValue?: string | null
    revision?: number
    comment?: string | null
    method?: string | null
}

// Явный список колонок для данных, уходящих клиенту (стандарт: не select() без полей)
const markerColumns = {
    id: markers.id,
    analysisId: markers.analysisId,
    name: markers.name,
    code: markers.code,
    section: markers.section,
    value: markers.value,
    valueText: markers.valueText,
    unit: markers.unit,
    referenceMin: markers.referenceMin,
    referenceMax: markers.referenceMax,
    referenceRaw: markers.referenceRaw,
    isOutOfRange: markers.isOutOfRange,
    outOfRangeDirection: markers.outOfRangeDirection,
    isEdited: markers.isEdited,
    originalValue: markers.originalValue,
    revision: markers.revision,
    isCurrent: markers.isCurrent,
    comment: markers.comment,
    method: markers.method,
    createdAt: markers.createdAt,
} as const

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

    // Append-only (034/039): each edit is a new row; only is_current=true rows are
    // the latest revision of each (name, method) pair — старые ревизии не отдаём.
    async findMarkersByAnalysisId(analysisId: number) {
        return this.db
            .select(markerColumns)
            .from(markers)
            .where(and(eq(markers.analysisId, analysisId), eq(markers.isCurrent, true)))
            .orderBy(markers.id)
    }

    // Батч-загрузка маркеров для набора анализов одним запросом (fix N+1 в админке).
    async findMarkersByAnalysisIds(analysisIds: number[]) {
        type MarkerRow = Awaited<ReturnType<AnalysisRepository['findMarkersByAnalysisId']>>[number]
        const grouped = new Map<number, MarkerRow[]>()
        if (analysisIds.length === 0) return grouped

        const rows = await this.db
            .select(markerColumns)
            .from(markers)
            .where(and(inArray(markers.analysisId, analysisIds), eq(markers.isCurrent, true)))
            .orderBy(markers.id)

        for (const row of rows) {
            const list = grouped.get(row.analysisId)
            if (list) list.push(row)
            else grouped.set(row.analysisId, [row])
        }
        return grouped
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
        const [inserted] = await this.db.insert(markers).values(data).returning(markerColumns)
        return inserted ?? null
    }

    // Append-only правка (034/039): в одной транзакции снимаем флаг «текущая»
    // со старой ревизии (данные не меняем) и вставляем новую строку-ревизию.
    // При unique violation транзакция откатывается — старая ревизия остаётся текущей.
    async insertMarkerRevision(previousMarkerId: number, data: NewMarker) {
        return this.db.transaction(async (tx) => {
            await tx
                .update(markers)
                .set({ isCurrent: false })
                .where(eq(markers.id, previousMarkerId))
            const [inserted] = await tx.insert(markers).values(data).returning(markerColumns)
            return inserted ?? null
        })
    }
}
