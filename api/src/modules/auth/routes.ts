import { randomUUID }           from 'node:crypto'
import { type FastifyInstance }  from 'fastify'
import { redis }                 from '../../core/redis.js'
import { config }                from '../../core/config.js'
import { UnauthorizedError }     from '../../core/errors.js'
import { UsersRepository }       from './repository.js'
import { AuthService }           from './service.js'
import { RequestOtpSchema, VerifyOtpSchema } from './schemas.js'

const REFRESH_TTL_SEC = 30 * 24 * 3600  // 30 дней
const ACCESS_TTL      = '15m'

export default async function authRoutes(fastify: FastifyInstance) {

    fastify.post('/auth/request-otp', async (request, reply) => {
        const body    = RequestOtpSchema.parse(request.body)
        const service = new AuthService(new UsersRepository(request.server.db))

        const { isNewUser } = await service.requestOtp(body)
        return reply.code(200).send({ isNewUser })
    })

    fastify.post('/auth/verify-otp', async (request, reply) => {
        const body    = VerifyOtpSchema.parse(request.body)
        const service = new AuthService(new UsersRepository(request.server.db))

        const user = await service.verifyOtp(body)

        const accessToken  = fastify.jwt.sign(
            { id: user.id, email: user.email },
            { expiresIn: ACCESS_TTL }
        )
        const jti          = randomUUID()
        const refreshToken = fastify.jwt.sign(
            { id: user.id, email: user.email, jti },
            { expiresIn: '30d' }
        )

        await redis.setex(`refresh:${jti}`, REFRESH_TTL_SEC, user.id)

        reply.setCookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure:   config.NODE_ENV === 'production',
            sameSite: 'lax',
            path:     '/api/v1/auth/refresh',
            maxAge:   REFRESH_TTL_SEC,
        })

        return { accessToken }
    })

    fastify.post('/auth/refresh', async (request, reply) => {
        const token = request.cookies?.refreshToken
        if (!token) throw new UnauthorizedError('UNAUTHORIZED')

        let payload: { id: string; email: string | null; jti: string }
        try {
            payload = fastify.jwt.verify(token)
        } catch {
            throw new UnauthorizedError('UNAUTHORIZED')
        }

        const userId = await redis.get(`refresh:${payload.jti}`)
        if (!userId) throw new UnauthorizedError('UNAUTHORIZED')

        const accessToken = fastify.jwt.sign(
            { id: payload.id, email: payload.email },
            { expiresIn: ACCESS_TTL }
        )
        return { accessToken }
    })

    fastify.post('/auth/logout', { preHandler: [fastify.authenticate] }, async (request, reply) => {
        const token = request.cookies?.refreshToken
        if (token) {
            try {
                const payload = fastify.jwt.verify<{ jti: string }>(token)
                await redis.del(`refresh:${payload.jti}`)
            } catch { /* уже невалиден */ }
        }
        reply.clearCookie('refreshToken', { path: '/api/v1/auth/refresh' })
        return { ok: true }
    })
}
