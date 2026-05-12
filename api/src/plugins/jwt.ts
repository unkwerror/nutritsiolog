import fp from 'fastify-plugin'
import jwt from '@fastify/jwt'
import cookie from '@fastify/cookie'
import { type FastifyInstance, type FastifyRequest, type FastifyReply } from 'fastify'

import { config } from '../core/config.js'

declare module 'fastify' {
    interface FastifyInstance {
        authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>
    }
}

declare module '@fastify/jwt' {
    interface FastifyJWT {
        user: { id: string; email: string | null }
    }
}

async function jwtPlugin(fastify: FastifyInstance) {
    fastify.register(cookie)

    // Access token — только Authorization: Bearer header
    fastify.register(jwt, { secret: config.JWT_SECRET })

    fastify.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            await request.jwtVerify()
        } catch {
            request.log.warn('Unauthorized request')
            reply.code(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } })
        }
    })
}

export default fp(jwtPlugin)
