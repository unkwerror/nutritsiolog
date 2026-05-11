import './utils/proxy.js'
import Fastify from 'fastify'
import multipart from '@fastify/multipart'

import jwtPlugin from './plugins/jwt.js'
import dbPlugin from './plugins/db.js'
import authRoutes from './routes/auth.js'
import analysisRoutes from './routes/analysis.js'
import { ensureBucket } from './services/storage.js'

const app = Fastify({ logger: true })

app.register(dbPlugin)
app.register(jwtPlugin)
app.register(multipart)

app.register(authRoutes, { prefix: '/api' })
app.register(analysisRoutes, { prefix: '/api' })

app.get('/health', async () => ({ status: 'ok' }))

const start = async () => {
    try {
        await ensureBucket()
        await app.listen({ port: process.env.PORT || 3001, host: '0.0.0.0' })
    } catch(err) {
        app.log.error(err)
        process.exit(1)
    }
}

start()