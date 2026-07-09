import { AnalysisRepository } from '../analysis/repository.js'
import { QuestionnaireRepository } from '../questionnaire/repository.js'
import {
    generateSignals,
    evaluateMarkers,
    computeHealthScore,
    computeSectionScores,
    type Signal,
    type SectionScore,
} from './rules.js'
import {
    LIFESTYLE_PROGRAM,
    INFLAMMATION_FOODS,
    GLYCEMIC_TIPS,
    NUTRITION_PRINCIPLES,
    BITTER_TASTES,
    DESSERT_SWAPS,
    LIFEHACKS,
    type ProgramBlock,
} from './content.js'
import { matchCatalogKey, assessDeviation, getCatalogEntry, optimumFor } from './matcher.js'
import { parseRuDate, buildSummary, type MarkerSeries, type DynamicsSummary } from './dynamics.js'
import {
    indexSignalsBySource,
    buildRecommendation,
    type MarkerRecommendation,
} from './assessment.js'
import { ProfileRepository, type ProfileCalculationRow } from './repository.js'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'

type DB = PostgresJsDatabase

export type ProgramBlockView = ProgramBlock & { relevant: boolean }

export type MarkerFinding = {
    key: string
    display: string
    section: string
    direction: 'low' | 'high'
    value: number | null
    optimumMin: number | null
    optimumMax: number | null
    // 'catalog' — норма нутрициолога, 'lab' — норма из бланка (для маркеров вне справочника)
    source: 'catalog' | 'lab'
    // Сила отклонения: 'mild' — умеренно (жёлтый), 'severe' — сильно (красный)
    status: 'mild' | 'severe'
    // Объединённая рекомендация (совет по маркеру + шаги/продукты нутрициолога).
    // Опционально: в сохранённых снимках профиля не хранится (экономия jsonb).
    recommendation?: MarkerRecommendation
}

export type RecommendationsView = {
    signals: Signal[]
    program: ProgramBlockView[]
    inflammation: typeof INFLAMMATION_FOODS
    glycemicTips: string[]
    nutritionPrinciples: string[]
    bitterTastes: string[]
    dessertSwaps: string[]
    lifehacks: Array<{ title: string; text: string }>
    healthScore: number | null
    sectionScores: SectionScore[]
    findings: MarkerFinding[]
    criticalCount: number
    warningCount: number
    hasQuestionnaire: boolean
    hasAnalyses: boolean
}

// Снимок расчёта профиля из profile_calculations (решения 033/034)
export type ProfileSnapshot = {
    id: number
    profileType: string
    healthScore: number | null
    sectionScores: SectionScore[]
    signals: Signal[]
    findings: MarkerFinding[]
    tags: string[]
    triggerSource: string
    calculatedAt: Date
    criticalCount: number
    warningCount: number
}

export class ProfileService {
    // Зависимости через конструктор (DI): репозитории, а не сырой db в бизнес-коде
    constructor(
        private analysisRepo: AnalysisRepository,
        private questionnaireRepo: QuestionnaireRepository,
        private profileRepo: ProfileRepository
    ) {}

    static fromDb(db: DB): ProfileService {
        return new ProfileService(
            new AnalysisRepository(db),
            new QuestionnaireRepository(db),
            new ProfileRepository(db)
        )
    }

    async getRecommendations(userId: string): Promise<RecommendationsView> {
        const [analysisList, questionnaire] = await Promise.all([
            this.analysisRepo.findAllByUser(userId),
            this.questionnaireRepo.findLatestByUser(userId),
        ])

        const doneAnalyses = analysisList.filter((a) => a.status === 'done')

        // Батч-загрузка маркеров одним запросом вместо N+1 по каждому анализу
        const markersByAnalysis = await this.analysisRepo.findMarkersByAnalysisIds(
            doneAnalyses.map((a) => a.id)
        )

        const allMarkers: Array<{
            code: string | null
            name: string
            value: string | null
            isOutOfRange: boolean
            outOfRangeDirection: 'low' | 'high' | null
            referenceMin: string | null
            referenceMax: string | null
            section: string | null
        }> = []
        for (const list of markersByAnalysis.values()) {
            for (const m of list) {
                allMarkers.push({
                    code: m.code,
                    name: m.name,
                    value: m.value,
                    isOutOfRange: m.isOutOfRange,
                    outOfRangeDirection: m.outOfRangeDirection as 'low' | 'high' | null,
                    referenceMin: m.referenceMin,
                    referenceMax: m.referenceMax,
                    section: m.section,
                })
            }
        }

        const tags = questionnaire ? (questionnaire.tags as string[]) : []
        const tagSet = new Set(tags)
        const answers = questionnaire?.answers as { gender?: string } | null
        const gender = (answers?.gender as 'male' | 'female' | null) ?? null

        // Оценка по собственным оптимумам с учётом гендера — единый источник истины
        const evals = evaluateMarkers(allMarkers, gender)
        const signals = generateSignals(allMarkers, tags, gender)
        const healthScore = computeHealthScore(evals)
        const sectionScores = computeSectionScores(evals)

        // Наблюдаемое значение по ключу оценки — для показа «ваше / оптимум».
        // Ключуем той же логикой, что и evaluateMarkers (catalog key либо lab:name).
        const valueByKey = new Map<string, number | null>()
        for (const m of allMarkers) {
            const key = matchCatalogKey(m.name, m.code) ?? `lab:${m.name.toLowerCase()}`
            if (!valueByKey.has(key)) {
                const n = m.value !== null ? Number(m.value.replace(',', '.')) : null
                valueByKey.set(key, n !== null && Number.isFinite(n) ? n : null)
            }
        }

        // Индекс сигналов нутрициолога по маркеру — для мерджа рекомендаций
        const signalsByKey = indexSignalsBySource(signals)

        const findings: MarkerFinding[] = [...evals.values()]
            .filter((e) => e.isOutOfRange && e.direction)
            .map((e) => {
                const value = valueByKey.get(e.key) ?? null
                const direction = e.direction as 'low' | 'high'
                // Градация силы отклонения по оптимуму/норме
                const dev = assessDeviation(value, e.optimum)
                return {
                    key: e.key,
                    display: e.display,
                    section: e.section,
                    direction,
                    value,
                    optimumMin: e.optimum?.min ?? null,
                    optimumMax: e.optimum?.max ?? null,
                    source: e.source,
                    status: dev?.severity ?? 'mild',
                    recommendation: buildRecommendation(e.key, direction, signalsByKey),
                }
            })
            // Сильные отклонения — выше умеренных (важное — вперёд)
            .sort((a, b) => (a.status === b.status ? 0 : a.status === 'severe' ? -1 : 1))

        // Базовая программа: помечаем блоки, релевантные тегам анкеты, и поднимаем их выше
        const program: ProgramBlockView[] = LIFESTYLE_PROGRAM.map((b) => ({
            ...b,
            relevant: b.relevantTags.some((t) => tagSet.has(t)),
        })).sort((a, b) => Number(b.relevant) - Number(a.relevant))

        return {
            signals,
            program,
            inflammation: INFLAMMATION_FOODS,
            glycemicTips: GLYCEMIC_TIPS,
            nutritionPrinciples: NUTRITION_PRINCIPLES,
            bitterTastes: BITTER_TASTES,
            dessertSwaps: DESSERT_SWAPS,
            lifehacks: LIFEHACKS,
            healthScore,
            sectionScores,
            findings,
            criticalCount: signals.filter((s) => s.severity === 'critical').length,
            warningCount: signals.filter((s) => s.severity === 'warning').length,
            hasQuestionnaire: !!questionnaire,
            hasAnalyses: doneAnalyses.length > 0,
        }
    }

    // profile_type — комбинированная строка "ПОЛНОТА:ИСХОД" (решение 033):
    //   полнота: MINIMAL (нет анализов) / MEDIUM (есть анализы, покрытие разделов < 5)
    //            / FULL (анкета + анализы с покрытием >= 5 разделов);
    //   исход по healthScore: OPTIMAL (>=85) / GOOD_WITH_CORRECTIONS (70–84)
    //            / MODERATE_DYSFUNCTION (50–69) / CRITICAL (<50);
    //            healthScore = null (нет анализов) → MINIMAL.
    // Примеры: "MEDIUM:GOOD_WITH_CORRECTIONS", "MINIMAL:MINIMAL".
    private deriveProfileType(view: RecommendationsView): string {
        const completeness = !view.hasAnalyses
            ? 'MINIMAL'
            : view.hasQuestionnaire && view.sectionScores.length >= 5
              ? 'FULL'
              : 'MEDIUM'
        const score = view.healthScore
        const outcome =
            score === null
                ? 'MINIMAL'
                : score >= 85
                  ? 'OPTIMAL'
                  : score >= 70
                    ? 'GOOD_WITH_CORRECTIONS'
                    : score >= 50
                      ? 'MODERATE_DYSFUNCTION'
                      : 'CRITICAL'
        return `${completeness}:${outcome}`
    }

    // Стабильная подпись снимка для дедупликации: healthScore + ids сигналов + теги
    private snapshotSignature(
        healthScore: number | null,
        signalIds: string[],
        tags: string[]
    ): string {
        return [
            healthScore === null ? 'null' : String(healthScore),
            [...signalIds].sort().join(','),
            [...tags].sort().join(','),
        ].join('|')
    }

    private toSnapshot(row: ProfileCalculationRow): ProfileSnapshot {
        const signals = row.signals as Signal[]
        return {
            id: row.id,
            profileType: row.profileType,
            healthScore: row.healthScore,
            sectionScores: row.sectionScores as SectionScore[],
            signals,
            findings: row.findings as MarkerFinding[],
            tags: row.tags as string[],
            triggerSource: row.triggerSource,
            calculatedAt: row.calculatedAt,
            criticalCount: signals.filter((s) => s.severity === 'critical').length,
            warningCount: signals.filter((s) => s.severity === 'warning').length,
        }
    }

    // Пересчёт + сохранение снимка в profile_calculations (append-only, решение 034).
    // Дедуп: если новый снимок совпадает с последним (healthScore + подпись сигналов и тегов) —
    // INSERT пропускается и возвращается последний, чтобы история не засорялась.
    async calculateAndPersist(userId: string, triggerSource: string): Promise<ProfileSnapshot> {
        const view = await this.getRecommendations(userId)
        const questionnaire = await this.questionnaireRepo.findLatestByUser(userId)
        const tags = questionnaire ? (questionnaire.tags as string[]) : []

        const newSignature = this.snapshotSignature(
            view.healthScore,
            view.signals.map((s) => s.id),
            tags
        )

        const latest = await this.profileRepo.findLatestProfileCalculation(userId)
        if (latest) {
            const latestSignals = latest.signals as Signal[]
            const latestSignature = this.snapshotSignature(
                latest.healthScore,
                latestSignals.map((s) => s.id),
                latest.tags as string[]
            )
            if (latestSignature === newSignature) {
                return this.toSnapshot(latest)
            }
        }

        const inserted = await this.profileRepo.insertProfileCalculation({
            userId,
            profileType: this.deriveProfileType(view),
            healthScore: view.healthScore,
            sectionScores: view.sectionScores,
            signals: view.signals,
            // В снимок не кладём объёмные рекомендации (пересчитываются на чтении)
            findings: view.findings.map(({ recommendation: _r, ...rest }) => rest),
            tags,
            triggerSource,
        })
        return this.toSnapshot(inserted)
    }

    async getCurrentSnapshot(userId: string): Promise<ProfileSnapshot | null> {
        const latest = await this.profileRepo.findLatestProfileCalculation(userId)
        return latest ? this.toSnapshot(latest) : null
    }

    async getSnapshotHistory(userId: string, limit = 20): Promise<ProfileSnapshot[]> {
        const rows = await this.profileRepo.findProfileCalculationHistory(userId, limit)
        return rows.map((row) => this.toSnapshot(row))
    }

    // Динамика маркеров во времени: серии значений по каноническим ключам
    // каталога + сводка «с прошлого раза». Питает страницу /dynamics и
    // блок прогресса на дашборде.
    async getDynamics(userId: string): Promise<DynamicsView> {
        const [rows, idToKey, questionnaire] = await Promise.all([
            this.profileRepo.findMarkerTimeSeries(userId),
            this.profileRepo.loadCatalogIdToKey(),
            this.questionnaireRepo.findLatestByUser(userId),
        ])

        const answers = questionnaire?.answers as { gender?: string } | null
        const gender = (answers?.gender as 'male' | 'female' | null) ?? null

        // Группировка по каноническому ключу; catalogId от worker приоритетнее,
        // fallback-матчинг — для старых строк с NULL catalog_id
        const byKey = new Map<string, MarkerSeries>()
        // Один анализ = максимум одна точка на ключ (дубли внутри анализа игнорируем)
        const seen = new Set<string>()

        for (const r of rows) {
            const key =
                (r.catalogId !== null ? idToKey.get(r.catalogId) : null) ??
                matchCatalogKey(r.name, r.code)
            if (!key) continue // нет канонической идентичности — нечего рисовать

            const dedupKey = `${key}|${r.analysisId}`
            if (seen.has(dedupKey)) continue

            const value = r.value !== null ? Number(r.value.replace(',', '.')) : null
            if (value === null || !Number.isFinite(value)) continue

            const entry = getCatalogEntry(key)
            if (!entry) continue

            let series = byKey.get(key)
            if (!series) {
                const opt = optimumFor(entry, gender)
                series = {
                    key,
                    display: entry.display,
                    section: entry.section,
                    unit: entry.unit ?? r.unit,
                    optimumMin: opt?.min ?? null,
                    optimumMax: opt?.max ?? null,
                    points: [],
                }
                byKey.set(key, series)
            }

            const date = parseRuDate(r.sampleTakenAt) ?? r.analysisCreatedAt
            series.points.push({
                analysisId: r.analysisId,
                date: date.toISOString(),
                value,
            })
            seen.add(dedupKey)
        }

        const series = [...byKey.values()]
        // sampleTakenAt может переупорядочить точки относительно даты загрузки
        for (const s of series) s.points.sort((a, b) => a.date.localeCompare(b.date))
        // Многоточечные сверху, внутри группы — по разделу
        series.sort(
            (a, b) => b.points.length - a.points.length || a.section.localeCompare(b.section)
        )

        return { summary: buildSummary(series), series }
    }
}

export type DynamicsView = {
    summary: DynamicsSummary | null
    series: MarkerSeries[]
}
