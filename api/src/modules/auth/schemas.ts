import { z } from 'zod'

export const RequestOtpSchema = z.object({
    email: z.email(),
})

export const VerifyOtpSchema = z.object({
    email: z.email(),
    code: z
        .string()
        .length(6)
        .regex(/^\d{6}$/),
})

export const RegisterSchema = z.object({
    email: z.email(),
    code: z
        .string()
        .length(6)
        .regex(/^\d{6}$/),
    firstName: z.string().trim().min(1).max(100),
    lastName: z.string().trim().min(1).max(100),
    phone: z
        .string()
        .trim()
        .min(6)
        .max(25)
        .regex(/^[+\d][\d\s\-()]+$/, 'Некорректный телефон'),
    consentPd: z.literal(true),
    consentMedicalData: z.literal(true),
})

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
