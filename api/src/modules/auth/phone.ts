import { z } from 'zod'

// Единственная точка нормализации телефона: РФ-мобильные → E.164 (+79XXXXXXXXX).
// Принимаем «8 916…», «+7 (916)…», «916…» — всё остальное отклоняем
// (SMS-провайдер работает по РФ, ЦА тоже).
export function normalizePhoneRu(raw: string): string | null {
    const digits = raw.replace(/\D/g, '')
    if (/^[78]9\d{9}$/.test(digits)) return `+7${digits.slice(1)}`
    if (/^9\d{9}$/.test(digits)) return `+7${digits}`
    return null
}

export const PhoneRuSchema = z
    .string()
    .trim()
    .min(6)
    .max(25)
    .transform((value, ctx) => {
        const normalized = normalizePhoneRu(value)
        if (!normalized) {
            ctx.addIssue({
                code: 'custom',
                message: 'Укажите российский мобильный номер, например +7 916 123-45-67',
            })
            return z.NEVER
        }
        return normalized
    })
