import { z } from 'zod'
import { type FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { LeadConsultationSchema } from './schemas.js'
import { LeadRepository } from './repository.js'
import { LeadService } from './service.js'
import { UsersRepository } from '../auth/repository.js'
import { sendLeadEmail } from '../../core/mailer.js'

const leadRoutes: FastifyPluginAsyncZod = async (fastify) => {
    fastify.post(
        '/lead/consultation',
        {
            preHandler: [fastify.authenticate],
            config: { rateLimit: { max: 5, timeWindow: '1h' } },
            schema: {
                tags: ['Lead'],
                security: [{ bearerAuth: [] }],
                body: LeadConsultationSchema,
                response: { 200: z.object({ ok: z.literal(true) }) },
            },
        },
        async (request, reply) => {
            const db = request.server.db
            const service = new LeadService(new LeadRepository(db), new UsersRepository(db), {
                sendLeadEmail,
            })
            await service.submitConsultationLead(request.user.id, request.body.message)
            return reply.send({ ok: true as const })
        }
    )
}

export default leadRoutes
