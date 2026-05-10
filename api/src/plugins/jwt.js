import fp from 'fastify-plugin'
import jwt from '@fastify/jwt'

async function jwtPlugin(fastify) {
    fastify.register(jwt, {
        secret: process.env.JWT_SECRET
    })
}

export default fp(jwtPlugin)
