import { z } from 'zod'

export const RequestOtpSchema = z.object({
    email: z.email(),
})

export const VerifyOtpSchema = z.object({
    email:     z.email(),
    code:      z.string().length(6).regex(/^\d{6}$/),
    firstName: z.string().min(1).max(100).optional(),
    lastName:  z.string().min(1).max(100).optional(),
    consentPd: z.literal(true).optional(),
})

export type RequestOtpBody = z.infer<typeof RequestOtpSchema>
export type VerifyOtpBody  = z.infer<typeof VerifyOtpSchema>
