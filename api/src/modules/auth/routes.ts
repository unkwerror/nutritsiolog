import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { type FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { redis } from '../../core/redis.js'
import { config } from '../../core/config.js'
import { UnauthorizedError, ConflictError, PG_UNIQUE_VIOLATION } from '../../core/errors.js'
import { UsersRepository } from './repository.js'
import { AuthService } from './service.js'
import { createSmsService } from '../../core/sms/index.js'
import {
    RequestOtpSchema,
    VerifyOtpSchema,
    RegisterSchema,
    UpdateProfileSchema,
} from './schemas.js'

const MeSchema = z.object({
    id: z.string(),
    firstName: z.string(),
    lastName: z.string(),
    middleName: z.string().nullable(),
    gender: z.enum(['male', 'female']).nullable(),
    dateOfBirth: z.string().nullable(),
    timezone: z.string(),
    email: z.string().nullable(),
    phone: z.string().nullable(),
    emailVerifiedAt: z.date().nullable(),
    phoneVerifiedAt: z.date().nullable(),
    consentPd: z.boolean(),
    consentMedicalData: z.boolean(),
    createdAt: z.date(),
    updatedAt: z.date(),
})

// Держим пользователя залогиненным как можно дольше: refresh живёт год и
// ротируется при каждом /auth/refresh — активная сессия «катится» вперёд и
// практически не истекает. Access-токен на час, чтобы реже дёргать refresh.
const REFRESH_TTL_DAYS = 365
const REFRESH_TTL_SEC = REFRESH_TTL_DAYS * 24 * 3600
const ACCESS_TTL = '1h'
// Путь покрывает и /auth/refresh, и /auth/logout — иначе logout не видит куку
// и не может отозвать refresh-токен в Redis (он оставался валидным 30 дней)
const REFRESH_COOKIE_PATH = '/api/v1/auth'

function buildTokens(
    fastify: Parameters<FastifyPluginAsyncZod>[0],
    user: { id: string; email: string | null }
) {
    const accessToken = fastify.jwt.sign(
        { id: user.id, email: user.email },
        { expiresIn: ACCESS_TTL }
    )
    const jti = randomUUID()
    const refreshToken = fastify.jwt.sign(
        { id: user.id, email: user.email, jti },
        { expiresIn: `${REFRESH_TTL_DAYS}d` }
    )
    return { accessToken, refreshToken, jti }
}

// Composition root: SMS-адаптер создаётся один раз (как storage/queue в analysis)
const sms = createSmsService()

const authRoutes: FastifyPluginAsyncZod = async (fastify) => {
    fastify.get(
        '/users/me',
        {
            schema: {
                tags: ['Users'],
                security: [{ bearerAuth: [] }],
                response: { 200: MeSchema },
            },
            preHandler: [fastify.authenticate],
        },
        async (request, reply) => {
            const repo = new UsersRepository(request.server.db)
            const user = await repo.findByIdPublic(request.user.id)
            if (!user) throw new UnauthorizedError('UNAUTHORIZED')
            return reply.send(user)
        }
    )

    fastify.patch(
        '/users/me',
        {
            schema: {
                tags: ['Users'],
                security: [{ bearerAuth: [] }],
                body: UpdateProfileSchema,
                response: { 200: MeSchema },
            },
            preHandler: [fastify.authenticate],
        },
        async (request, reply) => {
            const repo = new UsersRepository(request.server.db)
            try {
                await repo.updateProfile(request.user.id, request.body)
            } catch (err) {
                if (
                    err &&
                    typeof err === 'object' &&
                    'code' in err &&
                    err.code === PG_UNIQUE_VIOLATION
                ) {
                    throw new ConflictError('PHONE_TAKEN', 'Этот телефон уже используется')
                }
                throw err
            }
            const user = await repo.findByIdPublic(request.user.id)
            if (!user) throw new UnauthorizedError('UNAUTHORIZED')
            return reply.send(user)
        }
    )

    fastify.post(
        '/auth/request-otp',
        {
            schema: {
                tags: ['Auth'],
                body: RequestOtpSchema,
                response: { 200: z.object({ isNewUser: z.boolean() }) },
            },
        },
        async (request, reply) => {
            const service = new AuthService(new UsersRepository(request.server.db), sms)
            const { isNewUser } = await service.requestOtp(request.body, {
                requestId: request.id,
            })
            return reply.code(200).send({ isNewUser })
        }
    )

    fastify.post(
        '/auth/verify-otp',
        {
            schema: {
                tags: ['Auth'],
                body: VerifyOtpSchema,
                response: { 200: z.object({ accessToken: z.string() }) },
            },
        },
        async (request, reply) => {
            const service = new AuthService(new UsersRepository(request.server.db), sms)
            const user = await service.verifyOtp(request.body)

            const { accessToken, refreshToken, jti } = buildTokens(fastify, user)
            await redis.setex(`refresh:${jti}`, REFRESH_TTL_SEC, user.id)

            reply.setCookie('refreshToken', refreshToken, {
                httpOnly: true,
                secure: config.NODE_ENV === 'production',
                sameSite: 'lax',
                path: REFRESH_COOKIE_PATH,
                maxAge: REFRESH_TTL_SEC,
            })

            return { accessToken }
        }
    )

    fastify.post(
        '/auth/register',
        {
            schema: {
                tags: ['Auth'],
                body: RegisterSchema,
                response: { 200: z.object({ accessToken: z.string() }) },
            },
        },
        async (request, reply) => {
            const service = new AuthService(new UsersRepository(request.server.db), sms)
            const user = await service.register(request.body)

            const { accessToken, refreshToken, jti } = buildTokens(fastify, user)
            await redis.setex(`refresh:${jti}`, REFRESH_TTL_SEC, user.id)

            reply.setCookie('refreshToken', refreshToken, {
                httpOnly: true,
                secure: config.NODE_ENV === 'production',
                sameSite: 'lax',
                path: REFRESH_COOKIE_PATH,
                maxAge: REFRESH_TTL_SEC,
            })

            return { accessToken }
        }
    )

    fastify.post(
        '/auth/refresh',
        {
            schema: {
                tags: ['Auth'],
                response: { 200: z.object({ accessToken: z.string() }) },
            },
        },
        async (request, reply) => {
            const token = request.cookies?.refreshToken
            if (!token) throw new UnauthorizedError('UNAUTHORIZED')

            let payload: { id: string; email: string | null; jti: string }
            try {
                payload = fastify.jwt.verify(token)
            } catch {
                throw new UnauthorizedError('UNAUTHORIZED')
            }

            // GETDEL атомарно: два параллельных refresh с одной кукой не могут
            // оба пройти проверку и породить две независимые refresh-цепочки
            const userId = await redis.getdel(`refresh:${payload.jti}`)
            if (!userId) throw new UnauthorizedError('UNAUTHORIZED')

            const {
                accessToken,
                refreshToken: newRefreshToken,
                jti: newJti,
            } = buildTokens(fastify, {
                id: payload.id,
                email: payload.email,
            })
            await redis.setex(`refresh:${newJti}`, REFRESH_TTL_SEC, payload.id)

            reply.setCookie('refreshToken', newRefreshToken, {
                httpOnly: true,
                secure: config.NODE_ENV === 'production',
                sameSite: 'lax',
                path: REFRESH_COOKIE_PATH,
                maxAge: REFRESH_TTL_SEC,
            })

            return { accessToken }
        }
    )

    fastify.post(
        '/auth/logout',
        {
            schema: {
                tags: ['Auth'],
                security: [{ bearerAuth: [] }],
                response: { 200: z.object({ ok: z.boolean() }) },
            },
            preHandler: [fastify.authenticate],
        },
        async (request, reply) => {
            const token = request.cookies?.refreshToken
            if (token) {
                try {
                    const payload = fastify.jwt.verify<{ jti: string }>(token)
                    await redis.del(`refresh:${payload.jti}`)
                } catch {
                    /* уже невалиден */
                }
            }
            reply.clearCookie('refreshToken', { path: REFRESH_COOKIE_PATH })
            return { ok: true }
        }
    )
}

export default authRoutes
