import { z } from 'zod'
import { type FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { QuestionnaireRepository } from './repository.js'
import { QuestionnaireService } from './service.js'
import { QuestionnaireAnswersSchema } from './schemas.js'
import { UsersRepository } from '../auth/repository.js'

const questionnaireRoutes: FastifyPluginAsyncZod = async (fastify) => {
    fastify.post(
        '/questionnaire',
        {
            schema: {
                tags: ['Questionnaire'],
                security: [{ bearerAuth: [] }],
                body: QuestionnaireAnswersSchema,
                response: {
                    201: z.object({
                        id: z.number(),
                        tags: z.array(z.string()),
                        createdAt: z.date(),
                    }),
                },
            },
            preHandler: [fastify.authenticate],
        },
        async (request, reply) => {
            const svc = new QuestionnaireService(
                new QuestionnaireRepository(request.server.db),
                new UsersRepository(request.server.db)
            )
            const result = await svc.submit(request.user.id, request.body)
            return reply.code(201).send({
                id: result.id,
                tags: result.tags as string[],
                createdAt: result.createdAt,
            })
        }
    )

    fastify.get(
        '/questionnaire/my',
        {
            schema: {
                tags: ['Questionnaire'],
                security: [{ bearerAuth: [] }],
                response: {
                    200: z
                        .object({
                            id: z.number(),
                            answers: z.any(),
                            tags: z.array(z.string()),
                            createdAt: z.date(),
                        })
                        .nullable(),
                },
            },
            preHandler: [fastify.authenticate],
        },
        async (request, reply) => {
            const svc = new QuestionnaireService(
                new QuestionnaireRepository(request.server.db),
                new UsersRepository(request.server.db)
            )
            const result = await svc.getMyLatest(request.user.id)
            return reply.send(
                result
                    ? {
                          id: result.id,
                          answers: result.answers,
                          tags: result.tags as string[],
                          createdAt: result.createdAt,
                      }
                    : null
            )
        }
    )
}

export default questionnaireRoutes
