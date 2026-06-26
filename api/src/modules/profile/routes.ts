import { z } from 'zod'
import { type FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { ProfileService } from './service.js'

const SignalSchema = z.object({
    category: z.string(),
    title: z.string(),
    text: z.string(),
    severity: z.enum(['info', 'warning', 'critical']),
    sources: z.array(z.string()),
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
                        hasQuestionnaire: z.boolean(),
                        hasAnalyses: z.boolean(),
                    }),
                },
            },
            preHandler: [fastify.authenticate],
        },
        async (request, reply) => {
            const svc = new ProfileService(request.server.db)
            const result = await svc.getRecommendations(request.user.id)
            return reply.send(result)
        }
    )
}

export default profileRoutes
