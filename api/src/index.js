import Fastify from 'fastify'
import jwtPlugin from './plugins/jwt.js'
import dbPlugin from './plugins/db.js'
import authRoutes from './routes/auth.js'


const app = Fastify({
    logger: true
})

app.register(dbPlugin)
app.register(jwtPlugin)
app.register(authRoutes)
app.get('/health', async (request, reply) => {
    return {status: 'ok'}
})

const start = async () => {
    try {
        await app.listen({port: process.env.PORT, host: '0.0.0.0'})
    } catch(err) {
        app.log.error(err)
        process.exit(1)
    }
}

start()