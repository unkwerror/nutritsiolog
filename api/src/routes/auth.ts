import bcrypt from 'bcrypt'
import { type FastifyInstance } from 'fastify'
import { eq } from 'drizzle-orm'

import { users }  from '../db/schema.js'
import { config } from '../core/config.js'

type RegisterBody = {
    email?:    string
    phone?:    string
    password:  string
    firstName: string
    lastName:  string
    consentPd: boolean
}

type LoginBody = {
    email?:   string
    phone?:   string
    password: string
}

export default async function authRoutes(fastify: FastifyInstance) {

    fastify.post<{ Body: RegisterBody }>('/auth/register', {
        schema: {
            body: {
                type: 'object',
                required: ['password', 'firstName', 'lastName', 'consentPd'],
                anyOf: [
                    { required: ['email'] },
                    { required: ['phone'] }
                ],
                properties: {
                    email:     { type: 'string', format: 'email' },
                    phone:     { type: 'string', minLength: 7, maxLength: 25, pattern: '^[+\\d\\s\\-()]+$' },
                    password:  { type: 'string', minLength: 8, maxLength: 72 },
                    firstName: { type: 'string', minLength: 1, maxLength: 100 },
                    lastName:  { type: 'string', minLength: 1, maxLength: 100 },
                    consentPd: { type: 'boolean', enum: [true] }
                }
            }
        }
    }, async (request, reply) => {
        const { email, phone, password, firstName, lastName, consentPd } = request.body
        const { db } = request.server

        try {
            const hash   = await bcrypt.hash(password, 10)
            const [user] = await db.insert(users)
                .values({ email, phone, password: hash, firstName, lastName, consentPd })
                .returning()

            if (!user) throw new Error('Insert returned no rows')

            const token = fastify.jwt.sign({ id: user.id, email: user.email })

            return reply
                .setCookie('token', token, {
                    httpOnly: true,
                    secure:   config.NODE_ENV === 'production',
                    sameSite: 'strict',
                    path:     '/'
                })
                .send({ id: user.id, email: user.email })

        } catch (err) {
            const code = err instanceof Error
                ? (err.cause as { code?: string } | undefined)?.code
                : undefined
            if (code === '23505') {
                return reply.code(409).send({ error: 'Email or phone already in use' })
            }
            throw err
        }
    })

    fastify.post<{ Body: LoginBody }>('/auth/login', {
        schema: {
            body: {
                type: 'object',
                required: ['password'],
                anyOf: [
                    { required: ['email'] },
                    { required: ['phone'] }
                ],
                properties: {
                    email:    { type: 'string', format: 'email' },
                    phone:    { type: 'string', minLength: 7, maxLength: 25, pattern: '^[+\\d\\s\\-()]+$' },
                    password: { type: 'string', minLength: 8, maxLength: 72 }
                }
            }
        }
    }, async (request, reply) => {
        const { email, phone, password } = request.body
        const { db } = request.server

        const condition = email ? eq(users.email, email) : eq(users.phone, phone!)
        const [user]    = await db.select().from(users).where(condition)

        if (!user) return reply.code(401).send({ error: 'Invalid credentials' })

        const valid = await bcrypt.compare(password, user.password!)
        if (!valid) return reply.code(401).send({ error: 'Invalid credentials' })

        const token = fastify.jwt.sign({ id: user.id, email: user.email })

        return reply
            .setCookie('token', token, {
                httpOnly: true,
                secure:   config.NODE_ENV === 'production',
                sameSite: 'strict',
                path:     '/'
            })
            .send({ ok: true })
    })
}
