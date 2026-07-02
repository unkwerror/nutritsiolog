import { eq, desc } from 'drizzle-orm'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import { markerCatalog, profileCalculations } from '../../db/schema.js'

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
    async insertProfileCalculation(data: NewProfileCalculationInput): Promise<ProfileCalculationRow> {
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
}
