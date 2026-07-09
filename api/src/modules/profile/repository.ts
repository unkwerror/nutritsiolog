import { eq, desc, and, asc, isNotNull } from 'drizzle-orm'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import { markerCatalog, profileCalculations, markers, analyses } from '../../db/schema.js'

type DB = PostgresJsDatabase

// Явный список колонок (стандарт: не select() без полей для данных клиенту)
const calculationColumns = {
    id: profileCalculations.id,
    profileType: profileCalculations.profileType,
    healthScore: profileCalculations.healthScore,
    sectionScores: profileCalculations.sectionScores,
    signals: profileCalculations.signals,
    findings: profileCalculations.findings,
    tags: profileCalculations.tags,
    triggerSource: profileCalculations.triggerSource,
    calculatedAt: profileCalculations.calculatedAt,
}

export type ProfileCalculationRow = {
    id: number
    profileType: string
    healthScore: number | null
    sectionScores: unknown
    signals: unknown
    findings: unknown
    tags: unknown
    triggerSource: string
    calculatedAt: Date
}

export type NewProfileCalculationInput = {
    userId: string
    profileType: string
    healthScore: number | null
    sectionScores: unknown
    signals: unknown
    findings: unknown
    tags: unknown
    triggerSource: string
}

export class ProfileRepository {
    constructor(private db: DB) {}

    // key → id справочника marker_catalog — для проставления markers.catalog_id в worker
    async loadCatalogKeyToId(): Promise<Map<string, number>> {
        const rows = await this.db
            .select({ id: markerCatalog.id, key: markerCatalog.key })
            .from(markerCatalog)
        return new Map(rows.map((r) => [r.key, r.id]))
    }

    // Append-only (решение 034): расчёты профиля только INSERT, никаких UPDATE
    async insertProfileCalculation(
        data: NewProfileCalculationInput
    ): Promise<ProfileCalculationRow> {
        const [row] = await this.db
            .insert(profileCalculations)
            .values(data)
            .returning(calculationColumns)
        if (!row) throw new Error('Insert returned no rows')
        return row
    }

    async findLatestProfileCalculation(userId: string): Promise<ProfileCalculationRow | null> {
        const [row] = await this.db
            .select(calculationColumns)
            .from(profileCalculations)
            .where(eq(profileCalculations.userId, userId))
            .orderBy(desc(profileCalculations.calculatedAt), desc(profileCalculations.id))
            .limit(1)
        return row ?? null
    }

    async findProfileCalculationHistory(
        userId: string,
        limit: number
    ): Promise<ProfileCalculationRow[]> {
        return this.db
            .select(calculationColumns)
            .from(profileCalculations)
            .where(eq(profileCalculations.userId, userId))
            .orderBy(desc(profileCalculations.calculatedAt), desc(profileCalculations.id))
            .limit(limit)
    }

    // Все числовые значения текущих ревизий маркеров по готовым анализам —
    // сырьё для временных рядов динамики. Группировка по каталогу — в сервисе.
    async findMarkerTimeSeries(userId: string) {
        return this.db
            .select({
                analysisId: markers.analysisId,
                name: markers.name,
                code: markers.code,
                unit: markers.unit,
                value: markers.value,
                catalogId: markers.catalogId,
                sampleTakenAt: analyses.sampleTakenAt,
                analysisCreatedAt: analyses.createdAt,
            })
            .from(markers)
            .innerJoin(analyses, eq(markers.analysisId, analyses.id))
            .where(
                and(
                    eq(analyses.userId, userId),
                    eq(analyses.status, 'done'),
                    eq(analyses.isArchived, false),
                    eq(markers.isCurrent, true),
                    isNotNull(markers.value)
                )
            )
            .orderBy(asc(analyses.createdAt), asc(markers.id))
    }

    // id каталога → key (для строк, где worker уже проставил catalog_id)
    async loadCatalogIdToKey(): Promise<Map<number, string>> {
        const rows = await this.db
            .select({ id: markerCatalog.id, key: markerCatalog.key })
            .from(markerCatalog)
        return new Map(rows.map((r) => [r.id, r.key]))
    }
}
