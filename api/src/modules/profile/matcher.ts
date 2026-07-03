import { MARKER_CATALOG, type CatalogEntry, type Gender, type OptRange } from './optimums.js'

// Нормализация: нижний регистр, кириллица/латиница/цифры, схлопнуть пробелы.
function normalize(s: string): string {
    return s
        .toLowerCase()
        .replace(/ё/g, 'е')
        .replace(/[^a-zа-я0-9%#.+-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
}

function tokens(s: string): string[] {
    return normalize(s).split(' ').filter(Boolean)
}

// Индекс алиасов → запись каталога, отсортированный по длине алиаса (длиннее — точнее).
type AliasEntry = { alias: string; norm: string; multiword: boolean; entry: CatalogEntry }
const ALIAS_INDEX: AliasEntry[] = MARKER_CATALOG.flatMap((entry) =>
    entry.aliases.map((alias) => {
        const norm = normalize(alias)
        return { alias, norm, multiword: norm.includes(' '), entry }
    })
).sort((a, b) => b.norm.length - a.norm.length)

const CATALOG_BY_KEY = new Map(MARKER_CATALOG.map((e) => [e.key, e]))

// Строгий матчинг: одиночный алиас должен совпасть как отдельное слово (а не
// подстрока — иначе «железо» ловит «железосвязывающая»); многословный — как
// подпоследовательность нормализованной строки. Побеждает длиннейший алиас.
export function matchCatalogKey(name: string | null, code: string | null): string | null {
    const nName = normalize(name ?? '')
    const nCode = normalize(code ?? '')
    if (!nName && !nCode) return null
    const wordSet = new Set([...tokens(nName), ...tokens(nCode)])
    const hay = `${nName} ${nCode}`.trim()

    for (const a of ALIAS_INDEX) {
        if (a.multiword) {
            if (hay.includes(a.norm)) return a.entry.key
        } else {
            if (wordSet.has(a.norm)) return a.entry.key
        }
    }
    return null
}

export function getCatalogEntry(key: string): CatalogEntry | undefined {
    return CATALOG_BY_KEY.get(key)
}

export function optimumFor(entry: CatalogEntry, gender: Gender | null): OptRange | null {
    if (gender && entry.optimum[gender]) return entry.optimum[gender]!
    if (entry.optimum.all) return entry.optimum.all
    // Нет точного гендера, но есть раздельные нормы — берём осторожную объединённую
    const m = entry.optimum.male
    const f = entry.optimum.female
    if (m && f) {
        return {
            min: m.min !== null && f.min !== null ? Math.min(m.min, f.min) : (m.min ?? f.min),
            max: m.max !== null && f.max !== null ? Math.max(m.max, f.max) : (m.max ?? f.max),
        }
    }
    return m ?? f ?? null
}

export type Evaluation = {
    key: string
    display: string
    section: string
    isOutOfRange: boolean
    direction: 'low' | 'high' | null
    optimum: OptRange | null
    // 'catalog' — оценено по оптимуму нутрициолога; 'lab' — по норме из бланка (fallback)
    source: 'catalog' | 'lab'
}

function outOfRange(value: number | null, opt: OptRange | null): 'low' | 'high' | null {
    if (value === null || !Number.isFinite(value) || !opt) return null
    if (opt.min !== null && value < opt.min) return 'low'
    if (opt.max !== null && value > opt.max) return 'high'
    return null
}

export type Severity = 'mild' | 'severe'

// Порог «сильного» отклонения: во сколько ширин оптимального коридора значение
// вышло за границу. > 1 ширины → severe (красный), иначе mild (жёлтый).
const SEVERE_RATIO = 1.0

// Насколько сильно значение вышло за оптимум. Масштаб отклонения — ширина
// коридора нутрициолога (её нутрициолог задаёт как «нормальный разброс»);
// если коридор односторонний или нулевой — берём саму границу либо значение.
export function assessDeviation(
    value: number | null,
    opt: OptRange | null
): { direction: 'low' | 'high'; severity: Severity } | null {
    if (value === null || !Number.isFinite(value) || !opt) return null

    let boundary: number
    let direction: 'low' | 'high'
    if (opt.min !== null && value < opt.min) {
        boundary = opt.min
        direction = 'low'
    } else if (opt.max !== null && value > opt.max) {
        boundary = opt.max
        direction = 'high'
    } else {
        return null
    }

    const width = opt.min !== null && opt.max !== null ? Math.abs(opt.max - opt.min) : 0
    const scale = width > 0 ? width : Math.abs(boundary) || Math.abs(value) || 1
    const ratio = Math.abs(value - boundary) / scale
    return { direction, severity: ratio > SEVERE_RATIO ? 'severe' : 'mild' }
}

// Оценка значения по СОБСТВЕННОМУ оптимуму (решение 032). Если у маркера в
// справочнике нет оптимума (или маркер не в справочнике) — оценка берётся из
// нормы, распознанной в бланке (fallback по запросу заказчика).
export function evaluateMarker(
    key: string,
    value: number | null,
    gender: Gender | null,
    labRange?: { min: number | null; max: number | null; isOutOfRange: boolean; direction: 'low' | 'high' | null }
): Evaluation | null {
    const entry = getCatalogEntry(key)
    if (!entry) return null
    const opt = optimumFor(entry, gender)
    if (opt && (opt.min !== null || opt.max !== null)) {
        const direction = outOfRange(value, opt)
        return {
            key,
            display: entry.display,
            section: entry.section,
            isOutOfRange: direction !== null,
            direction,
            optimum: opt,
            source: 'catalog',
        }
    }
    // Fallback на норму из бланка
    if (labRange) {
        return {
            key,
            display: entry.display,
            section: entry.section,
            isOutOfRange: labRange.isOutOfRange,
            direction: labRange.direction,
            optimum: { min: labRange.min, max: labRange.max },
            source: 'lab',
        }
    }
    return {
        key,
        display: entry.display,
        section: entry.section,
        isOutOfRange: false,
        direction: null,
        optimum: opt,
        source: 'catalog',
    }
}
