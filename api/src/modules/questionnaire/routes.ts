import { z } from 'zod'
import { type FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { QuestionnaireRepository } from './repository.js'
import { QuestionnaireService } from './service.js'
import { QuestionnaireAnswersSchema } from './schemas.js'
import { UsersRepository } from '../auth/repository.js'
import { ProfileService } from '../profile/service.js'

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

            // Триггер расчёта профиля (решение 033). Сбой персиста не должен
            // ронять сохранение анкеты — ловим и логируем.
            try {
                await ProfileService.fromDb(request.server.db).calculateAndPersist(
                    request.user.id,
                    'questionnaire'
                )
            } catch (err) {
                request.log.warn({ err }, 'profile recalculation after questionnaire failed')
            }

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

    // История заполнений (анкета append-only) — для аннотаций на странице динамики
    fastify.get(
        '/questionnaire/history',
        {
            schema: {
                tags: ['Questionnaire'],
                security: [{ bearerAuth: [] }],
                response: {
                    200: z.array(
                        z.object({
                            id: z.number(),
                            tags: z.array(z.string()),
                            createdAt: z.date(),
                        })
                    ),
                },
            },
            preHandler: [fastify.authenticate],
        },
        async (request, reply) => {
            const repo = new QuestionnaireRepository(request.server.db)
            const rows = await repo.findAllByUser(request.user.id)
            return reply.send(
                rows.map((r) => ({ id: r.id, tags: r.tags as string[], createdAt: r.createdAt }))
            )
        }
    )
}

export default questionnaireRoutes
