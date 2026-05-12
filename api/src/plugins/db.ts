import { drizzle } from 'drizzle-orm/postgres-js'
import postgres     from 'postgres'
import fp           from 'fastify-plugin'
import { type FastifyInstance } from 'fastify'

import { config } from '../core/config.js'

declare module 'fastify' {
    interface FastifyInstance {
        db: ReturnType<typeof drizzle>
    }
}

async function dbPlugin(fastify: FastifyInstance) {
    const sql = postgres(config.DATABASE_URL)
    const db  = drizzle(sql)

    fastify.decorate('db', db)

    fastify.addHook('onClose', async () => {
        await sql.end()
        fastify.log.info('Database connection closed')
    })
}

export default fp(dbPlugin)
