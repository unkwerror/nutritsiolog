import './utils/proxy.js'
import Fastify   from 'fastify'
import helmet    from '@fastify/helmet'
import cors      from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'
import multipart from '@fastify/multipart'

import dbPlugin       from './plugins/db.js'
import jwtPlugin      from './plugins/jwt.js'
import authRoutes     from './routes/auth.js'
import analysisRoutes from './routes/analysis.js'
import healthRoutes   from './routes/health.js'
import { ensureBucket } from './services/storage.js'
import { config }       from './core/config.js'
import logger           from './utils/logger.js'

const app = Fastify({ loggerInstance: logger })

// security — регистрируем первыми, чтобы заголовки применялись ко всем роутам
app.register(helmet)
app.register(cors,      { origin: config.CORS_ORIGIN })
app.register(rateLimit, { max: 100, timeWindow: '1 minute' })

// инфраструктура
app.register(dbPlugin)
app.register(jwtPlugin)
app.register(multipart, { limits: { fileSize: 10 * 1024 * 1024, files: 5 } })

// роуты
app.register(healthRoutes)
app.register(authRoutes,     { prefix: '/api' })
app.register(analysisRoutes, { prefix: '/api' })

process.on('SIGTERM', async () => {
    app.log.info('SIGTERM received, shutting down')
    try {
        await app.close()
        process.exit(0)
    } catch (err) {
        app.log.error({ err }, 'Error during shutdown')
        process.exit(1)
    }
})

const start = async () => {
    try {
        await ensureBucket()
        await app.listen({ port: config.PORT, host: '0.0.0.0' })
    } catch (err) {
        app.log.error({ err }, 'Failed to start')
        process.exit(1)
    }
}

start()
