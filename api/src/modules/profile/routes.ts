import { z } from 'zod'
import { type FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { ProfileService } from './service.js'
import { NotFoundError } from '../../core/errors.js'

const FoodsSchema = z.object({
    add: z.array(z.string()).optional(),
    avoid: z.array(z.string()).optional(),
})

const SignalSchema = z.object({
    id: z.string(),
    category: z.string(),
    categoryKey: z.enum(['nutrition', 'vitamins', 'metabolism', 'hormones', 'inflammation', 'lifestyle']),
    title: z.string(),
    text: z.string(),
    detail: z.array(z.string()),
    foods: FoodsSchema.optional(),
    severity: z.enum(['info', 'warning', 'critical']),
    sources: z.array(z.string()),
})

const ProgramBlockSchema = z.object({
    key: z.string(),
    icon: z.string(),
    title: z.string(),
    summary: z.string(),
    steps: z.array(z.string()),
    relevantTags: z.array(z.string()),
    relevant: z.boolean(),
})

const profileRoutes: FastifyPluginAsyncZod = async (fastify) => {
    fastify.get(
        '/profile/recommendations',
        {
            schema: {
                tags: ['Profile'],
                security: [{ bearerAuth: [] }],
                response: {
                    200: z.object({
                        signals: z.array(SignalSchema),
                        program: z.array(ProgramBlockSchema),
                        inflammation: z.object({
                            add: z.array(z.string()),
                            avoid: z.array(z.string()),
                        }),
                        glycemicTips: z.array(z.string()),
                        nutritionPrinciples: z.array(z.string()),
                        bitterTastes: z.array(z.string()),
                        dessertSwaps: z.array(z.string()),
                        lifehacks: z.array(z.object({ title: z.string(), text: z.string() })),
                        healthScore: z.number().nullable(),
                        sectionScores: z.array(
                            z.object({
                                section: z.string(),
                                title: z.string(),
                                total: z.number(),
                                outOfRange: z.number(),
                                score: z.number(),
                            })
                        ),
                        findings: z.array(
                            z.object({
                                key: z.string(),
                                display: z.string(),
                                section: z.string(),
                                direction: z.enum(['low', 'high']),
                                value: z.number().nullable(),
                                optimumMin: z.number().nullable(),
                                optimumMax: z.number().nullable(),
                                source: z.enum(['catalog', 'lab']),
                            })
                        ),
                        criticalCount: z.number(),
                        warningCount: z.number(),
                        hasQuestionnaire: z.boolean(),
                        hasAnalyses: z.boolean(),
                    }),
                },
            },
            preHandler: [fastify.authenticate],
        },
        async (request, reply) => {
            const svc = ProfileService.fromDb(request.server.db)
            const result = await svc.getRecommendations(request.user.id)
            return reply.send(result)
        }
    )

    const SnapshotSchema = z.object({
        id: z.number(),
        profileType: z.string(),
        healthScore: z.number().nullable(),
        sectionScores: z.array(
            z.object({
                section: z.string(),
                title: z.string(),
                total: z.number(),
                outOfRange: z.number(),
                score: z.number(),
            })
        ),
        signals: z.array(SignalSchema),
        findings: z.array(
            z.object({
                key: z.string(),
                display: z.string(),
                section: z.string(),
                direction: z.enum(['low', 'high']),
                value: z.number().nullable(),
                optimumMin: z.number().nullable(),
                optimumMax: z.number().nullable(),
                source: z.enum(['catalog', 'lab']),
            })
        ),
        tags: z.array(z.string()),
        triggerSource: z.string(),
        calculatedAt: z.date(),
        criticalCount: z.number(),
        warningCount: z.number(),
    })

    const HistoryItemSchema = z.object({
        id: z.number(),
        profileType: z.string(),
        healthScore: z.number().nullable(),
        triggerSource: z.string(),
        calculatedAt: z.date(),
        criticalCount: z.number(),
        warningCount: z.number(),
    })

    // Последний сохранённый снимок профиля (история append-only, решение 034)
    fastify.get(
        '/profile/current',
        {
            schema: {
                tags: ['Profile'],
                security: [{ bearerAuth: [] }],
                response: { 200: SnapshotSchema },
            },
            preHandler: [fastify.authenticate],
        },
        async (request, reply) => {
            const svc = ProfileService.fromDb(request.server.db)
            const snap = await svc.getCurrentSnapshot(request.user.id)
            if (!snap) throw new NotFoundError('NO_PROFILE', 'Профиль ещё не рассчитан')
            return reply.send(snap)
        }
    )

    fastify.get(
        '/profile/history',
        {
            schema: {
                tags: ['Profile'],
                security: [{ bearerAuth: [] }],
                response: { 200: z.array(HistoryItemSchema) },
            },
            preHandler: [fastify.authenticate],
        },
        async (request, reply) => {
            const svc = ProfileService.fromDb(request.server.db)
            const history = await svc.getSnapshotHistory(request.user.id)
            return reply.send(
                history.map((s) => ({
                    id: s.id,
                    profileType: s.profileType,
                    healthScore: s.healthScore,
                    triggerSource: s.triggerSource,
                    calculatedAt: s.calculatedAt,
                    criticalCount: s.criticalCount,
                    warningCount: s.warningCount,
                }))
            )
        }
    )

    // Пересчёт и сохранение снимка — фронт зовёт после загрузки анализа
    fastify.post(
        '/profile/recalculate',
        {
            schema: {
                tags: ['Profile'],
                security: [{ bearerAuth: [] }],
                response: { 200: SnapshotSchema },
            },
            preHandler: [fastify.authenticate],
        },
        async (request, reply) => {
            const svc = ProfileService.fromDb(request.server.db)
            const snap = await svc.calculateAndPersist(request.user.id, 'manual')
            return reply.send(snap)
        }
    )
}

export default profileRoutes
