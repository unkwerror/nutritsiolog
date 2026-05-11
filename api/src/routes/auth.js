import bcrypt from 'bcrypt'
import { users } from '../db/schema.js'
import { eq } from 'drizzle-orm'

export default async function authRoutes(fastify) {
    fastify.post('/auth/register', {
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
        const {db} = request.server

        try {
            const hash = await bcrypt.hash(password, 10)
            const [user] = await db.insert(users)
                .values({ email, phone, password: hash, firstName, lastName, consentPd })
                .returning()

            const token = fastify.jwt.sign({id: user.id, email: user.email})

            return reply
                .setCookie('token', token, {
                    httpOnly: true,
                    secure: process.env.NODE_ENV === 'production',
                    sameSite: 'strict',
                    path: '/'
                })
                .send({id: user.id, email: user.email})
                
        } catch (err) {
            if(err.cause?.code === '23505'){
                return reply.code(409).send({error: 'Email or phone already in use'})
            }
            throw err
        }
    })

    fastify.post('/auth/login', {
        schema: {
            body: {
                type: 'object',
                required: ['password'],
                anyOf: [
                    {required: ['email']},
                    {required: ['phone']}
                ],
                properties: {
                    email:  {type: 'string', format: 'email'},
                    phone:     { type: 'string', minLength: 7, maxLength: 25, pattern: '^[+\\d\\s\\-()]+$' },
                    password:  { type: 'string', minLength: 8, maxLength: 72 },
                }
            }
        }
    }, async (request, reply) => {
        const { email, phone, password } = request.body
        const {db} = request.server

        const condition = email ? eq(users.email, email) : eq(users.phone, phone)
        const [user] = await db.select().from(users).where(condition)
            if(!user) return reply.code(401).send({error: 'Invalid credentials'})

        const valid = await bcrypt.compare(password, user.password)
            if(!valid) return reply.code(401).send({error: 'Invalid credentials'})
        
        const token = fastify.jwt.sign({id: user.id, email: user.email})
        return reply
            .setCookie('token', token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict',
                path: '/'
            })
            .send({ok: true})

    })
}

