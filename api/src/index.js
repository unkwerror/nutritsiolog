import Fastify from 'fastify'
import dbPlugin from './plugins/db.js'

const app = Fastify({
    logger: true
})

app.register(dbPlugin)
app.get('/health', async (request, reply) => {
    return {status: 'ok'}
})

const start = async () => {
    try {
        await app.listen({port: 3001, host: '0.0.0.0'})
    } catch(err) {
        app.log.error(err)
        process.exit(1)
    }
}

start()