import { describe, it, expect } from 'vitest'
import { computeBmi, buildBodySeries, compareAnswers, compareSymptoms } from './dynamics.js'
import { type QuestionnaireAnswers } from './schemas.js'

const base: QuestionnaireAnswers = {
    gender: 'female',
    dateOfBirth: '1975-05-10',
    heightCm: 165,
    weightKg: 72,
    waistCm: 84,
    goal: ['lose_weight'],
    activityLevel: 'light',
    sleepDuration: '6-7',
    sleepQuality: 'interrupted',
    bedtime: '23-00',
    mealsPerDay: '4-5',
    dinnerToSleep: 'lt2h',
    waterLiters: 'lt1.5',
    caffeine: '3-4',
    smoking: 'no',
    emotionalEating: 'often',
    symptoms: ['fatigue', 'bloating', 'edema'],
    medications: 'no',
    supplements: 'sometimes',
    cycleStatus: 'regular',
    pms: 'moderate',
}

describe('computeBmi', () => {
    it('считает ИМТ с округлением до 0.1', () => {
        expect(computeBmi(72, 165)).toBe(26.4)
        expect(computeBmi(60, 170)).toBe(20.8)
    })
    it('мусор → null', () => {
        expect(computeBmi(NaN, 165)).toBeNull()
        expect(computeBmi(72, 0)).toBeNull()
    })
})

describe('buildBodySeries', () => {
    it('строит ряды вес/талия/ИМТ по заполнениям', () => {
        const rows = [
            { answers: base, createdAt: new Date('2026-06-01') },
            { answers: { ...base, weightKg: 69, waistCm: 81 }, createdAt: new Date('2026-07-01') },
        ]
        const series = buildBodySeries(rows)
        const byKey = Object.fromEntries(series.map((s) => [s.key, s]))

        expect(byKey.weight!.points.map((p) => p.value)).toEqual([72, 69])
        expect(byKey.waist!.points.map((p) => p.value)).toEqual([84, 81])
        expect(byKey.bmi!.points.map((p) => p.value)).toEqual([26.4, 25.3])
        // Талия: женская норма < 80
        expect(byKey.waist!.optimumMax).toBe(80)
        expect(byKey.bmi!.optimumMin).toBe(18.5)
    })

    it('талия опциональна — серия без точек не возвращается', () => {
        const noWaist: QuestionnaireAnswers = { ...base }
        delete noWaist.waistCm
        const rows = [{ answers: noWaist, createdAt: new Date('2026-06-01') }]
        const keys = buildBodySeries(rows).map((s) => s.key)
        expect(keys).not.toContain('waist')
        expect(keys).toContain('weight')
    })
})

describe('compareAnswers', () => {
    it('возвращает только изменившиеся ответы с направлением', () => {
        const curr: QuestionnaireAnswers = {
            ...base,
            sleepQuality: 'normal', // interrupted → normal = improved
            caffeine: 'gt5', // 3-4 → 5+ = worsened
            waterLiters: 'lt1.5', // не изменилось
        }
        const changes = compareAnswers(base, curr)
        const byKey = Object.fromEntries(changes.map((c) => [c.key, c]))

        expect(changes).toHaveLength(2)
        expect(byKey.sleepQuality!.trend).toBe('improved')
        expect(byKey.sleepQuality!.currLabel).toBe('нормальный')
        expect(byKey.caffeine!.trend).toBe('worsened')
        // ухудшения первыми
        expect(changes[0]!.key).toBe('caffeine')
    })

    it('немонотонная шкала сна: и недосып, и пересып хуже оптимума', () => {
        const toOptimal = compareAnswers(base, { ...base, sleepDuration: '7-8' })
        expect(toOptimal[0]!.trend).toBe('improved')
        const overshoot = compareAnswers(
            { ...base, sleepDuration: '7-8' },
            { ...base, sleepDuration: 'gt8' }
        )
        expect(overshoot[0]!.trend).toBe('worsened')
        // lt6 → gt8: оба плохие, но gt8 (1) лучше lt6 (0)
        const across = compareAnswers(
            { ...base, sleepDuration: 'lt6' },
            { ...base, sleepDuration: 'gt8' }
        )
        expect(across[0]!.trend).toBe('improved')
    })

    it('нетрекаемые поля (цель, лекарства) не попадают в изменения', () => {
        const changes = compareAnswers(base, {
            ...base,
            goal: ['gut_health'],
            medications: 'other',
        })
        expect(changes).toHaveLength(0)
    })
})

describe('compareSymptoms', () => {
    it('считает ушедшие и появившиеся симптомы по-русски', () => {
        const curr = {
            ...base,
            symptoms: ['fatigue', 'mood_anxiety'] as QuestionnaireAnswers['symptoms'],
        }
        const diff = compareSymptoms(base, curr)
        expect(diff.prevCount).toBe(3)
        expect(diff.currCount).toBe(2)
        expect(diff.gone.sort()).toEqual(['вздутие', 'отёки'])
        expect(diff.appeared).toEqual(['тревожность'])
    })
})
