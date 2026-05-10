import {drizzle} from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import fp from 'fastify-plugin'

async function dbPlugin(fastify) {

    const sql = postgres(process.env.DATABASE_URL)
    const db = drizzle(sql)

    fastify.decorate('db', db)

    fastify.addHook('onClose', async() =>{
       await sql.end()
       fastify.log.info('Database connection closed')
    })
    
}

export default fp(dbPlugin)