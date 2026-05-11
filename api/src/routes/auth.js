import bcrypt from 'bcrypt'
import { users } from '../db/schema.js'
import { eq } from 'drizzle-orm'

export default async function authRoutes(fastify) {
    fastify.post('/auth/register', {
        schema: {
            body: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                    email:      {type: 'string', format: 'email' },
                    password:   {type: 'string', minLength: 8, maxLength: 72}
                }
            }
        }
    }, async (request, reply) => {
        const {email, password} = request.body
        const {db} = request.server

        try {
            const hash = await bcrypt.hash(password, 10)
            const [user] = await db.insert(users).values({email, password: hash}).returning()
            
            const token = fastify.jwt.sign({id: user.id, email: user.email})

            return reply
                .setCookie('token', token, {
                    httpOnly: true,
                    secure: true,
                    sameSite: 'strict',
                    path: '/'
                })
                .send({id: user.id, email: user.email})
                
        } catch (err) {
            if(err.cause?.code === '23505'){
                return reply.code(409).send({error: 'Email already in use'})
            }
            throw err
        }
    })

    fastify.post('/auth/login', {
        schema: {
            body: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                    email:  {type: 'string', format: 'email'},
                    password: {type: 'string' }
                }
            }
        }
    }, async (request, reply) => {
        const {email, password} = request.body
        const {db} = request.server

        const [user] = await db.select().from(users).where(eq(users.email, email))
            if(!user) return reply.code(401).send({error: 'Invalid email or password'})

        const valid = await bcrypt.compare(password, user.password)
            if(!valid) return reply.code(401).send({error: 'Invalid email or password'})
        
        const token = fastify.jwt.sign({id: user.id, email: user.email})
        return reply
            .setCookie('token', token, {
                httpOnly: true,
                secure: true,
                sameSite: 'strict',
                path: '/'
            })
            .send({ok: true})

    })
}

