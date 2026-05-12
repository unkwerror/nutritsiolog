import fp from 'fastify-plugin'
import jwt from '@fastify/jwt'
import cookie from '@fastify/cookie'

async function jwtPlugin(fastify) {
    fastify.register(cookie)

    fastify.register(jwt, {
        secret: process.env.JWT_SECRET,
        cookie: {
            cookieName: 'token',
            signed: false
        }
    })

    fastify.decorate('authenticate', async (request, reply) => {
        try {
            await request.jwtVerify()
        } catch {
            reply.code(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } })
        }
    })
}


export default fp(jwtPlugin)
