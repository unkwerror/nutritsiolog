import fp                                                    from 'fastify-plugin'
import { type FastifyPluginAsync, type FastifyRequest, type FastifyReply } from 'fastify'
import { ZodError }                                          from 'zod'
import { AppError }                                          from './errors.js'

const errorHandlerPlugin: FastifyPluginAsync = async (fastify) => {
    fastify.setErrorHandler(async (error: Error, request: FastifyRequest, reply: FastifyReply) => {

        if (error instanceof AppError) {
            const level = error.statusCode < 500 ? 'warn' : 'error'
            request.log[level]({ err: error }, 'Request error')

            return reply.code(error.statusCode).send({
                error: {
                    code:    error.code,
                    message: error.message,
                    ...(error.details !== undefined && { details: error.details })
                }
            })
        }

        // Ошибки валидации Zod (parse() в роутах)
        if (error instanceof ZodError) {
            request.log.warn({ err: error }, 'Validation error')
            return reply.code(400).send({
                error: { code: 'VALIDATION_ERROR', message: 'Invalid request data', details: error.issues }
            })
        }

        // Ошибки Fastify и его плагинов с клиентским статусом: 400 — валидация схемы,
        // 413 — @fastify/multipart (файл больше лимита), 429 — @fastify/rate-limit.
        // Без этого они проваливаются в ветку 500 и клиент не может их отличить от сбоя.
        const statusCode = (error as { statusCode?: unknown }).statusCode
        if (typeof statusCode === 'number' && statusCode >= 400 && statusCode < 500) {
            request.log.warn({ err: error }, 'Request error')
            const code =
                statusCode === 400
                    ? 'VALIDATION_ERROR'
                    : statusCode === 413
                      ? 'FILE_TOO_LARGE'
                      : statusCode === 429
                        ? 'RATE_LIMITED'
                        : ((error as { code?: string }).code ?? 'REQUEST_ERROR')
            return reply.code(statusCode).send({
                error: { code, message: error.message }
            })
        }

        // Всё остальное — неожиданная ошибка, скрываем детали от клиента
        request.log.error({ err: error }, 'Unhandled error')
        return reply.code(500).send({
            error: { code: 'INTERNAL_ERROR', message: 'Internal server error' }
        })
    })
}

export default fp(errorHandlerPlugin)
