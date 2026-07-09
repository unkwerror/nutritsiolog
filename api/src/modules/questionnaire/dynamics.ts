import { type QuestionnaireAnswers } from './schemas.js'

// ── Динамика анкеты: чистые функции (юнит-тестируются без БД) ──────────────────
// Три вида отслеживаемого:
// 1. Числовые (вес, талия, ИМТ) → временные ряды для графиков
// 2. Шкальные ответы → сравнение двух последних заполнений со стрелкой
// 3. Симптомы (мультивыбор) → ушли / появились / счётчик

export type QTrend = 'improved' | 'worsened' | 'stable'

export type BodySeries = {
    key: 'weight' | 'waist' | 'bmi'
    display: string
    unit: string
    optimumMin: number | null
    optimumMax: number | null
    points: Array<{ date: string; value: number }>
}

export type AnswerChange = {
    key: string
    label: string
    prevLabel: string
    currLabel: string
    trend: QTrend
}

export type SymptomChanges = {
    prevCount: number
    currCount: number
    gone: string[] // русские названия ушедших симптомов
    appeared: string[]
}

type Row = { answers: QuestionnaireAnswers; createdAt: Date }

// ── Справочник шкал: порядок значений от «хуже» к «лучше» ──────────────────────
// Для немонотонных вопросов (сон, приёмы пищи) — оценка близости к оптимуму.

type ScaleDef = {
    label: string
    // score: больше = лучше. Не входит в union — вопрос не отслеживается.
    scores: Record<string, number>
    valueLabels: Record<string, string>
}

const SCALES: Record<string, ScaleDef> = {
    activityLevel: {
        label: 'Активность',
        scores: { sedentary: 0, light: 1, moderate: 2, high: 3 },
        valueLabels: {
            sedentary: 'сидячая',
            light: 'лёгкая',
            moderate: 'умеренная',
            high: 'высокая',
        },
    },
    sleepDuration: {
        label: 'Длительность сна',
        // оптимум 7-8 часов; и недосып, и пересып — хуже
        scores: { lt6: 0, '6-7': 1, '7-8': 2, gt8: 1 },
        valueLabels: { lt6: 'меньше 6 ч', '6-7': '6–7 ч', '7-8': '7–8 ч', gt8: 'больше 8 ч' },
    },
    sleepQuality: {
        label: 'Качество сна',
        scores: { poor: 0, interrupted: 1, normal: 2, excellent: 3 },
        valueLabels: {
            poor: 'плохой',
            interrupted: 'прерывистый',
            normal: 'нормальный',
            excellent: 'отличный',
        },
    },
    bedtime: {
        label: 'Время отбоя',
        scores: { after_00: 0, '23-00': 1, before_23: 2 },
        valueLabels: { after_00: 'после 00:00', '23-00': '23:00–00:00', before_23: 'до 23:00' },
    },
    mealsPerDay: {
        label: 'Приёмы пищи',
        // 3 — оптимум методики; постоянные перекусы и 1-2 приёма — хуже
        scores: { '1-2': 0, '3': 2, '4-5': 1, gt5: 0 },
        valueLabels: { '1-2': '1–2 раза', '3': '3 раза', '4-5': '4–5 раз', gt5: 'больше 5 раз' },
    },
    dinnerToSleep: {
        label: 'Ужин до сна',
        scores: { lt2h: 0, '2-3h': 1, gt3h: 2 },
        valueLabels: { lt2h: 'меньше 2 ч', '2-3h': '2–3 ч', gt3h: 'больше 3 ч' },
    },
    waterLiters: {
        label: 'Вода',
        scores: { 'lt1.5': 0, '1.5-2': 1, gt2: 2 },
        valueLabels: { 'lt1.5': 'меньше 1.5 л', '1.5-2': '1.5–2 л', gt2: 'больше 2 л' },
    },
    caffeine: {
        label: 'Кофеин',
        scores: { gt5: 0, '3-4': 1, '1-2': 2, '0': 3 },
        valueLabels: { '0': 'нет', '1-2': '1–2 чашки', '3-4': '3–4 чашки', gt5: '5+ чашек' },
    },
    smoking: {
        label: 'Курение',
        scores: { yes: 0, quit: 1, no: 2 },
        valueLabels: { yes: 'курю', quit: 'бросил(а)', no: 'нет' },
    },
    emotionalEating: {
        label: 'Эмоциональное переедание',
        scores: { always: 0, often: 1, rarely: 2, never: 3 },
        valueLabels: { always: 'постоянно', often: 'часто', rarely: 'редко', never: 'никогда' },
    },
    pms: {
        label: 'ПМС',
        scores: { severe: 0, moderate: 1, none: 2 },
        valueLabels: { severe: 'выраженный', moderate: 'умеренный', none: 'нет' },
    },
}

export const SYMPTOM_LABELS: Record<string, string> = {
    fatigue: 'усталость',
    bloating: 'вздутие',
    gut_issues: 'проблемы ЖКТ',
    hair_skin_nails: 'волосы/кожа/ногти',
    edema: 'отёки',
    mood_anxiety: 'тревожность',
    headaches_brainfog: 'головные боли',
    low_immunity: 'частые простуды',
    joint_muscle_pain: 'боли в суставах/мышцах',
    cold_extremities: 'холодные конечности',
}

// ИМТ по ВОЗ: 18.5–25. Талия: риск-порог < 94 см (муж) / < 80 см (жен).
const BMI_OPTIMUM = { min: 18.5, max: 25 }
const WAIST_MAX = { male: 94, female: 80 }

export function computeBmi(weightKg: number, heightCm: number): number | null {
    if (!Number.isFinite(weightKg) || !Number.isFinite(heightCm) || heightCm <= 0) return null
    return Math.round((weightKg / (heightCm / 100) ** 2) * 10) / 10
}

// Ряды вес/талия/ИМТ по всем заполнениям (rows — по возрастанию даты).
// Серии без единой точки не возвращаем.
export function buildBodySeries(rows: Row[]): BodySeries[] {
    const gender = rows.at(-1)?.answers.gender ?? null
    const weight: BodySeries = {
        key: 'weight',
        display: 'Вес',
        unit: 'кг',
        optimumMin: null,
        optimumMax: null,
        points: [],
    }
    const waist: BodySeries = {
        key: 'waist',
        display: 'Обхват талии',
        unit: 'см',
        optimumMin: null,
        optimumMax: gender ? WAIST_MAX[gender] : null,
        points: [],
    }
    const bmi: BodySeries = {
        key: 'bmi',
        display: 'Индекс массы тела',
        unit: '',
        optimumMin: BMI_OPTIMUM.min,
        optimumMax: BMI_OPTIMUM.max,
        points: [],
    }

    for (const row of rows) {
        const date = row.createdAt.toISOString()
        const { weightKg, heightCm, waistCm } = row.answers
        if (Number.isFinite(weightKg)) weight.points.push({ date, value: weightKg })
        if (waistCm !== undefined && Number.isFinite(waistCm))
            waist.points.push({ date, value: waistCm })
        const b = computeBmi(weightKg, heightCm)
        if (b !== null) bmi.points.push({ date, value: b })
    }

    return [weight, waist, bmi].filter((s) => s.points.length > 0)
}

// Сравнение шкальных ответов двух заполнений: только изменившиеся.
export function compareAnswers(
    prev: QuestionnaireAnswers,
    curr: QuestionnaireAnswers
): AnswerChange[] {
    const changes: AnswerChange[] = []
    for (const [key, scale] of Object.entries(SCALES)) {
        const p = (prev as Record<string, unknown>)[key]
        const c = (curr as Record<string, unknown>)[key]
        if (typeof p !== 'string' || typeof c !== 'string' || p === c) continue
        const ps = scale.scores[p]
        const cs = scale.scores[c]
        if (ps === undefined || cs === undefined) continue
        changes.push({
            key,
            label: scale.label,
            prevLabel: scale.valueLabels[p] ?? p,
            currLabel: scale.valueLabels[c] ?? c,
            trend: cs > ps ? 'improved' : cs < ps ? 'worsened' : 'stable',
        })
    }
    // Ухудшения первыми — они важнее
    const order: Record<QTrend, number> = { worsened: 0, improved: 1, stable: 2 }
    return changes.sort((a, b) => order[a.trend] - order[b.trend])
}

export function compareSymptoms(
    prev: QuestionnaireAnswers,
    curr: QuestionnaireAnswers
): SymptomChanges {
    const prevSet = new Set(prev.symptoms)
    const currSet = new Set(curr.symptoms)
    const gone = [...prevSet].filter((s) => !currSet.has(s)).map((s) => SYMPTOM_LABELS[s] ?? s)
    const appeared = [...currSet].filter((s) => !prevSet.has(s)).map((s) => SYMPTOM_LABELS[s] ?? s)
    return { prevCount: prevSet.size, currCount: currSet.size, gone, appeared }
}
