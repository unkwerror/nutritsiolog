import { type OptRange } from './optimums.js'

// ── Чистые функции динамики маркеров (юнит-тестируются без БД) ─────────────────

export type SeriesPoint = {
    analysisId: number
    date: string // ISO
    value: number
}

export type MarkerSeries = {
    key: string
    display: string
    section: string
    unit: string | null
    optimumMin: number | null
    optimumMax: number | null
    points: SeriesPoint[] // по возрастанию даты
}

export type Trend = 'improved' | 'worsened' | 'stable'

// Порог «без изменений»: сдвиг меньше 2% от масштаба считаем шумом измерения
const STABLE_RATIO = 0.02

// Дистанция значения до оптимального коридора: 0 внутри коридора,
// иначе — расстояние до ближайшей границы.
function distanceToOptimum(value: number, opt: OptRange): number {
    if (opt.min !== null && value < opt.min) return opt.min - value
    if (opt.max !== null && value > opt.max) return value - opt.max
    return 0
}

// «Улучшился» = стал ближе к оптимальному коридору, а не сырое «вырос/упал»:
// падение холестерина к норме — улучшение, падение гемоглобина ниже нормы — нет.
// Без оптимума направление «лучше» неизвестно → stable.
export function computeTrend(prev: number, curr: number, opt: OptRange | null): Trend {
    if (!opt || (opt.min === null && opt.max === null)) return 'stable'

    const dPrev = distanceToOptimum(prev, opt)
    const dCurr = distanceToOptimum(curr, opt)

    // Масштаб шума: ширина коридора либо границa
    const width =
        opt.min !== null && opt.max !== null
            ? Math.abs(opt.max - opt.min)
            : Math.abs(opt.min ?? opt.max ?? 1) || 1
    const eps = width * STABLE_RATIO

    if (Math.abs(dPrev - dCurr) <= eps) return 'stable'
    return dCurr < dPrev ? 'improved' : 'worsened'
}

// sampleTakenAt / reportDate приходят из OCR как свободный текст — парсим
// осторожно: dd.mm.yyyy (+ опциональное время) и ISO. Мусор → null.
export function parseRuDate(raw: string | null | undefined): Date | null {
    if (!raw) return null
    const s = raw.trim()

    const ru = /^(\d{1,2})\.(\d{1,2})\.(\d{4})/.exec(s)
    if (ru) {
        const [, dd, mm, yyyy] = ru
        const d = new Date(Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd)))
        return Number.isNaN(d.getTime()) || Number(mm) > 12 || Number(dd) > 31 ? null : d
    }

    const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s)
    if (iso) {
        const d = new Date(`${iso[1]}-${iso[2]}-${iso[3]}T00:00:00Z`)
        return Number.isNaN(d.getTime()) ? null : d
    }

    return null
}

export type DynamicsSummary = {
    improved: number
    worsened: number
    stable: number
    currentDate: string // ISO даты последнего замера
    previousDate: string
}

// Сводка «с прошлого раза»: по каждому маркеру сравниваем последнюю точку с
// предпоследней. null, если ни у одного маркера нет двух замеров.
export function buildSummary(
    series: { points: SeriesPoint[]; optimumMin: number | null; optimumMax: number | null }[]
): DynamicsSummary | null {
    let improved = 0
    let worsened = 0
    let stable = 0
    let currentDate: string | null = null
    let previousDate: string | null = null

    for (const s of series) {
        const n = s.points.length
        if (n < 2) continue
        const prev = s.points[n - 2]!
        const curr = s.points[n - 1]!
        const trend = computeTrend(prev.value, curr.value, {
            min: s.optimumMin,
            max: s.optimumMax,
        })
        if (trend === 'improved') improved++
        else if (trend === 'worsened') worsened++
        else stable++
        if (!currentDate || curr.date > currentDate) currentDate = curr.date
        if (!previousDate || prev.date > previousDate) previousDate = prev.date
    }

    if (currentDate === null || previousDate === null) return null
    return { improved, worsened, stable, currentDate, previousDate }
}
