// Оценка каждого маркера анализа по СОБСТВЕННОМУ справочнику нутрициолога
// (решение 032) с градацией силы отклонения (mild/severe) и объединённой
// рекомендацией: краткий совет по маркеру (advice.ts) + развёрнутые шаги и
// продукты из методички нутрициолога (сигналы rules.ts). Всё считается на чтении
// GET /analysis/:id — таблица markers остаётся append-only (034).

import { matchCatalogKey, getCatalogEntry, optimumFor, assessDeviation } from './matcher.js'
import { getAdvice } from './advice.js'
import { generateSignals, type Signal } from './rules.js'
import { type Gender } from './optimums.js'

export type MarkerRecommendation = {
    // Краткий персональный совет по конкретному маркеру
    summary: string | null
    // Развёрнутые шаги из методички нутрициолога (объединённые сигналы)
    steps: string[]
    // Продукты добавить / убрать — из методички нутрициолога
    foods: { add: string[]; avoid: string[] } | null
    // Заголовки связанных блоков нутрициолога (напр. «Дефицит железа»)
    topics: string[]
}

export type MarkerAssessment = {
    // 'normal' — в коридоре оптимума; 'mild' — умеренное отклонение (жёлтый);
    // 'severe' — сильное отклонение (красный)
    status: 'normal' | 'mild' | 'severe'
    direction: 'low' | 'high' | null
    optimumMin: string | null
    optimumMax: string | null
    // 'catalog' — оценено по оптимуму нутрициолога; 'lab' — по норме из бланка
    // (маркер вне справочника); null — оценить нечем
    optimumSource: 'catalog' | 'lab' | null
    recommendation: MarkerRecommendation | null
}

export type AssessableMarker = {
    name: string
    code: string | null
    value: string | null
    isOutOfRange: boolean
    outOfRangeDirection: 'low' | 'high' | null
    referenceMin?: string | null
    referenceMax?: string | null
    section?: string | null
}

function parseValue(v: string | null): number | null {
    if (v === null) return null
    const n = Number(v.replace(',', '.'))
    return Number.isFinite(n) ? n : null
}

function numToStr(n: number | null): string | null {
    return n === null ? null : String(n)
}

// Индекс сигналов нутрициолога по ключу маркера-источника: HGB → [сигнал «Дефицит железа»]
export function indexSignalsBySource(signals: Signal[]): Map<string, Signal[]> {
    const map = new Map<string, Signal[]>()
    for (const s of signals) {
        for (const src of s.sources) {
            // Источники вида 'questionnaire:...' к маркерам не относятся
            if (src.includes(':')) continue
            const list = map.get(src)
            if (list) list.push(s)
            else map.set(src, [s])
        }
    }
    return map
}

function dedupe(items: string[]): string[] {
    return [...new Set(items.map((s) => s.trim()).filter(Boolean))]
}

// Собирает объединённую рекомендацию для маркера: персональный совет + шаги и
// продукты из всех сигналов нутрициолога, ссылающихся на этот маркер.
export function buildRecommendation(
    key: string | null,
    direction: 'low' | 'high' | null,
    signalsByKey: Map<string, Signal[]>
): MarkerRecommendation {
    const summary = key && direction ? getAdvice(key, direction) : null
    const linked = key ? (signalsByKey.get(key) ?? []) : []

    const steps: string[] = []
    const add: string[] = []
    const avoid: string[] = []
    const topics: string[] = []
    for (const s of linked) {
        steps.push(...s.detail)
        if (s.foods?.add) add.push(...s.foods.add)
        if (s.foods?.avoid) avoid.push(...s.foods.avoid)
        topics.push(s.title)
    }

    const mergedAdd = dedupe(add)
    const mergedAvoid = dedupe(avoid)
    return {
        summary,
        steps: dedupe(steps),
        foods: mergedAdd.length || mergedAvoid.length ? { add: mergedAdd, avoid: mergedAvoid } : null,
        topics: dedupe(topics),
    }
}

export function assessMarkers(
    markers: AssessableMarker[],
    gender: Gender | null,
    questionnaireTags: string[] = []
): MarkerAssessment[] {
    // Сигналы нутрициолога по этим маркерам + контексту анкеты (персонализация)
    const signals = generateSignals(
        markers.map((m) => ({
            code: m.code,
            name: m.name,
            value: m.value,
            isOutOfRange: m.isOutOfRange,
            outOfRangeDirection: m.outOfRangeDirection,
            referenceMin: m.referenceMin ?? null,
            referenceMax: m.referenceMax ?? null,
            section: m.section ?? null,
        })),
        questionnaireTags,
        gender
    )
    const signalsByKey = indexSignalsBySource(signals)

    return markers.map((m) => {
        const key = matchCatalogKey(m.name, m.code)
        const entry = key ? getCatalogEntry(key) : undefined
        const opt = entry ? optimumFor(entry, gender) : null
        const value = parseValue(m.value)

        // По оптимуму нутрициолога
        if (opt && (opt.min !== null || opt.max !== null)) {
            const dev = assessDeviation(value, opt)
            const status = dev ? dev.severity : 'normal'
            const direction = dev?.direction ?? null
            return {
                status,
                direction,
                optimumMin: numToStr(opt.min),
                optimumMax: numToStr(opt.max),
                optimumSource: 'catalog',
                recommendation:
                    status === 'normal' ? null : buildRecommendation(key, direction, signalsByKey),
            }
        }

        // Fallback: маркер вне справочника — по флагу из бланка (без градации силы)
        if (m.isOutOfRange) {
            return {
                status: 'mild',
                direction: m.outOfRangeDirection,
                optimumMin: null,
                optimumMax: null,
                optimumSource: 'lab',
                recommendation: buildRecommendation(key, m.outOfRangeDirection, signalsByKey),
            }
        }

        return {
            status: 'normal',
            direction: null,
            optimumMin: numToStr(opt?.min ?? null),
            optimumMax: numToStr(opt?.max ?? null),
            optimumSource: entry ? 'catalog' : null,
            recommendation: null,
        }
    })
}
