import fp                        from 'fastify-plugin'
import { type FastifyInstance } from 'fastify'
import { db, sql }              from '../db/client.js'

declare module 'fastify' {
    interface FastifyInstance {
        db: typeof db
    }
}

async function dbPlugin(fastify: FastifyInstance) {
    fastify.decorate('db', db)

    fastify.addHook('onClose', async () => {
        await sql.end()
        fastify.log.info('Database connection closed')
    })
}

export default fp(dbPlugin)
