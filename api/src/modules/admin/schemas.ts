import { z } from 'zod'

// ── Поиск пользователей ──────────────────────────────────────────────────────

export const SearchUsersQuery = z.object({
    // Поиск по почте, имени, фамилии, отчеству. Несколько слов — все должны совпасть.
    q: z.string().trim().max(200).optional(),
    limit: z.coerce.number().int().min(1).max(1000).default(50),
    offset: z.coerce.number().int().min(0).default(0),
})
export type SearchUsersQuery = z.infer<typeof SearchUsersQuery>

const UserListItem = z.object({
    id: z.string(),
    firstName: z.string(),
    lastName: z.string(),
    middleName: z.string().nullable(),
    email: z.string().nullable(),
    phone: z.string().nullable(),
    gender: z.enum(['male', 'female']).nullable(),
    createdAt: z.date(),
    analysesCount: z.number(),
    hasQuestionnaire: z.boolean(),
})

export const SearchUsersResponse = z.object({
    total: z.number(),
    limit: z.number(),
    offset: z.number(),
    users: z.array(UserListItem),
})

// ── Карточка пользователя ────────────────────────────────────────────────────

export const AdminMarker = z.object({
    id: z.number(),
    name: z.string(),
    code: z.string().nullable(),
    section: z.string().nullable(),
    value: z.string().nullable(),
    unit: z.string().nullable(),
    referenceRaw: z.string().nullable(),
    isOutOfRange: z.boolean(),
    outOfRangeDirection: z.enum(['low', 'high']).nullable(),
    isEdited: z.boolean(),
    comment: z.string().nullable(),
    method: z.string().nullable(),
})

export const AdminAnalysis = z.object({
    id: z.number(),
    status: z.string(),
    detectedTypes: z.array(z.string()).nullable(),
    labName: z.string().nullable(),
    createdAt: z.date(),
    markers: z.array(AdminMarker),
})

export const AdminSignal = z.object({
    category: z.string(),
    title: z.string(),
    text: z.string(),
    severity: z.enum(['info', 'warning', 'critical']),
    sources: z.array(z.string()),
})

export const AdminUser = z.object({
    id: z.string(),
    firstName: z.string(),
    lastName: z.string(),
    middleName: z.string().nullable(),
    gender: z.enum(['male', 'female']).nullable(),
    dateOfBirth: z.string().nullable(),
    timezone: z.string(),
    email: z.string().nullable(),
    phone: z.string().nullable(),
    emailVerifiedAt: z.date().nullable(),
    phoneVerifiedAt: z.date().nullable(),
    consentPd: z.boolean(),
    consentMedicalData: z.boolean(),
    createdAt: z.date(),
    updatedAt: z.date(),
})

export const UserDetailResponse = z.object({
    user: AdminUser,
    analyses: z.array(AdminAnalysis),
    questionnaire: z
        .object({
            tags: z.array(z.string()),
            createdAt: z.date(),
        })
        .nullable(),
    recommendations: z.object({
        signals: z.array(AdminSignal),
        hasQuestionnaire: z.boolean(),
        hasAnalyses: z.boolean(),
    }),
})
export type UserDetail = z.infer<typeof UserDetailResponse>
