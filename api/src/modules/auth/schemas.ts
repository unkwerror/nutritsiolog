import { z } from 'zod'

const identifierFields = z.object({
    email: z.string().email().optional(),
    phone: z.string().min(7).max(25).regex(/^[\d+\s\-()]+$/).optional(),
}).refine(data => !!(data.email ?? data.phone), {
    message: 'Either email or phone is required',
})

export const RequestOtpSchema = identifierFields

export const VerifyOtpSchema = identifierFields.and(z.object({
    code:      z.string().length(6).regex(/^\d{6}$/),
    firstName: z.string().min(1).max(100).optional(),
    lastName:  z.string().min(1).max(100).optional(),
    consentPd: z.literal(true).optional(),
}))

export type RequestOtpBody = z.infer<typeof RequestOtpSchema>
export type VerifyOtpBody  = z.infer<typeof VerifyOtpSchema>
