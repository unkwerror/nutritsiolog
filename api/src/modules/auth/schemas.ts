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
    firstName: z.string().min(1).max(100),
    lastName: z.string().min(1).max(100),
    consentPd: z.literal(true),
    consentMedicalData: z.literal(true),
})

export type RequestOtpBody = z.infer<typeof RequestOtpSchema>
export type VerifyOtpBody = z.infer<typeof VerifyOtpSchema>
export type RegisterBody = z.infer<typeof RegisterSchema>
