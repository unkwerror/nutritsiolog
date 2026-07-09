import { z } from 'zod'
import { PhoneRuSchema } from './phone.js'

// Канал идентификации: телефон — основной (SMS-код), email остаётся вторым
// способом входа (существующие аккаунты). Discriminated union по `channel` —
// чистый oneOf в OpenAPI и exhaustive switch в сервисе.

const CodeSchema = z
    .string()
    .length(6)
    .regex(/^\d{6}$/)

const EmailChannel = z.object({ channel: z.literal('email'), email: z.email() })
const PhoneChannel = z.object({ channel: z.literal('phone'), phone: PhoneRuSchema })

export const RequestOtpSchema = z.discriminatedUnion('channel', [EmailChannel, PhoneChannel])

export const VerifyOtpSchema = z.discriminatedUnion('channel', [
    EmailChannel.extend({ code: CodeSchema }),
    PhoneChannel.extend({ code: CodeSchema }),
])

const RegisterCommon = {
    code: CodeSchema,
    firstName: z.string().trim().min(1).max(100),
    lastName: z.string().trim().min(1).max(100),
    consentPd: z.literal(true),
    consentMedicalData: z.literal(true),
}

export const RegisterSchema = z.discriminatedUnion('channel', [
    // Старый флоу: код подтверждает email, телефон обязателен (не верифицирован)
    EmailChannel.extend({ ...RegisterCommon, phone: PhoneRuSchema }),
    // Новый флоу: код подтверждает телефон, email — опциональный контакт
    PhoneChannel.extend({ ...RegisterCommon, email: z.email().optional() }),
])

// Профиль редактируется частично — все поля опциональны.
// email не редактируется здесь: это логин-идентификатор (см. решение 009).
export const UpdateProfileSchema = z
    .object({
        firstName: z.string().trim().min(1).max(100),
        lastName: z.string().trim().min(1).max(100),
        middleName: z.string().trim().max(100).nullable(),
        gender: z.enum(['male', 'female']).nullable(),
        // ISO date YYYY-MM-DD
        dateOfBirth: z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/, 'Дата в формате ГГГГ-ММ-ДД')
            .nullable(),
        phone: z
            .string()
            .trim()
            .min(6)
            .max(25)
            .regex(/^[+\d][\d\s\-()]+$/, 'Некорректный телефон')
            .nullable(),
    })
    .partial()

export type RequestOtpBody = z.infer<typeof RequestOtpSchema>
export type VerifyOtpBody = z.infer<typeof VerifyOtpSchema>
export type RegisterBody = z.infer<typeof RegisterSchema>
export type UpdateProfileBody = z.infer<typeof UpdateProfileSchema>
