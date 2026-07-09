import { z } from 'zod'

export const LeadConsultationSchema = z.object({
    message: z.string().trim().max(1000).optional(),
})

export type LeadConsultationBody = z.infer<typeof LeadConsultationSchema>
