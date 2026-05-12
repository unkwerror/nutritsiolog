import fp                                                    from 'fastify-plugin'
import { type FastifyPluginAsync, type FastifyRequest, type FastifyReply } from 'fastify'
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

        // Ошибки валидации схемы от Fastify (тело запроса не соответствует схеме)
        if ('statusCode' in error && error.statusCode === 400) {
            request.log.warn({ err: error }, 'Validation error')
            return reply.code(400).send({
                error: { code: 'VALIDATION_ERROR', message: error.message }
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
