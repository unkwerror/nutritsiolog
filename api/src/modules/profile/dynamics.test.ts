import { describe, it, expect } from 'vitest'
import { computeTrend, parseRuDate, buildSummary } from './dynamics.js'

describe('computeTrend', () => {
    const opt = { min: 50, max: 150 }

    it('движение К оптимуму = improved, даже если значение падает', () => {
        // холестерин-подобный кейс: был выше нормы, снизился к границе
        expect(computeTrend(200, 160, opt)).toBe('improved')
        // ферритин-подобный: был ниже, вырос к норме
        expect(computeTrend(30, 45, opt)).toBe('improved')
        // вошёл в коридор
        expect(computeTrend(30, 80, opt)).toBe('improved')
    })

    it('движение ОТ оптимума = worsened', () => {
        expect(computeTrend(160, 200, opt)).toBe('worsened')
        expect(computeTrend(45, 30, opt)).toBe('worsened')
        // выпал из коридора
        expect(computeTrend(100, 170, opt)).toBe('worsened')
    })

    it('движение внутри коридора = stable', () => {
        expect(computeTrend(80, 120, opt)).toBe('stable')
        expect(computeTrend(120, 80, opt)).toBe('stable')
    })

    it('сдвиг меньше 2% ширины коридора = stable (шум измерения)', () => {
        // ширина 100, eps 2: дистанция изменилась на 1 → шум
        expect(computeTrend(151, 152, opt)).toBe('stable')
        // дистанция изменилась на 3 → уже тренд
        expect(computeTrend(151, 154, opt)).toBe('worsened')
    })

    it('без оптимума направление неизвестно = stable', () => {
        expect(computeTrend(10, 100, null)).toBe('stable')
        expect(computeTrend(10, 100, { min: null, max: null })).toBe('stable')
    })

    it('односторонний коридор работает', () => {
        expect(computeTrend(6.8, 5.0, { min: null, max: 5.2 })).toBe('improved')
        expect(computeTrend(5.0, 6.8, { min: null, max: 5.2 })).toBe('worsened')
    })
})

describe('parseRuDate', () => {
    it('парсит dd.mm.yyyy', () => {
        expect(parseRuDate('15.03.2026')?.toISOString()).toBe('2026-03-15T00:00:00.000Z')
        expect(parseRuDate('1.3.2026')?.toISOString()).toBe('2026-03-01T00:00:00.000Z')
    })

    it('парсит dd.mm.yyyy с хвостом времени', () => {
        expect(parseRuDate('15.03.2026 10:45')?.toISOString()).toBe('2026-03-15T00:00:00.000Z')
    })

    it('парсит ISO', () => {
        expect(parseRuDate('2026-03-15')?.toISOString()).toBe('2026-03-15T00:00:00.000Z')
        expect(parseRuDate('2026-03-15T12:00:00Z')?.toISOString()).toBe('2026-03-15T00:00:00.000Z')
    })

    it('мусор → null', () => {
        expect(parseRuDate(null)).toBeNull()
        expect(parseRuDate(undefined)).toBeNull()
        expect(parseRuDate('не указано')).toBeNull()
        expect(parseRuDate('45.99.2026')).toBeNull()
        expect(parseRuDate('')).toBeNull()
    })
})

describe('buildSummary', () => {
    const mk = (values: number[], opt: { min: number | null; max: number | null }) => ({
        optimumMin: opt.min,
        optimumMax: opt.max,
        points: values.map((v, i) => ({
            analysisId: i + 1,
            date: `2026-0${i + 1}-01T00:00:00.000Z`,
            value: v,
        })),
    })

    it('null пока ни у одного маркера нет двух точек', () => {
        expect(buildSummary([mk([42], { min: 50, max: 150 })])).toBeNull()
        expect(buildSummary([])).toBeNull()
    })

    it('считает improved/worsened/stable по последней паре точек', () => {
        const summary = buildSummary([
            mk([30, 45], { min: 50, max: 150 }), // improved
            mk([100, 170], { min: 50, max: 150 }), // worsened
            mk([80, 120], { min: 50, max: 150 }), // stable
        ])
        expect(summary).toEqual({
            improved: 1,
            worsened: 1,
            stable: 1,
            currentDate: '2026-02-01T00:00:00.000Z',
            previousDate: '2026-01-01T00:00:00.000Z',
        })
    })
})
