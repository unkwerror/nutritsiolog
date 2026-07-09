import { describe, it, expect } from 'vitest'
import { normalizePhoneRu } from './phone.js'

describe('normalizePhoneRu', () => {
    it('нормализует все варианты записи одного номера к одному E.164', () => {
        const expected = '+79161234567'
        expect(normalizePhoneRu('+7 916 123-45-67')).toBe(expected)
        expect(normalizePhoneRu('8 (916) 123 45 67')).toBe(expected)
        expect(normalizePhoneRu('79161234567')).toBe(expected)
        expect(normalizePhoneRu('9161234567')).toBe(expected)
        expect(normalizePhoneRu('+7 (916) 123-45-67')).toBe(expected)
    })

    it('отклоняет не-мобильные и мусор', () => {
        expect(normalizePhoneRu('84951234567')).toBeNull() // городской Москва
        expect(normalizePhoneRu('12345')).toBeNull()
        expect(normalizePhoneRu('+380501234567')).toBeNull() // не РФ
        expect(normalizePhoneRu('')).toBeNull()
        expect(normalizePhoneRu('abc')).toBeNull()
    })

    it('отклоняет слишком длинные и короткие номера', () => {
        expect(normalizePhoneRu('791612345678')).toBeNull() // 11 значащих
        expect(normalizePhoneRu('916123456')).toBeNull() // 9 цифр
    })
})
