import './utils/proxy.js'
import Fastify      from 'fastify'
import helmet       from '@fastify/helmet'
import cors         from '@fastify/cors'
import rateLimit    from '@fastify/rate-limit'
import multipart    from '@fastify/multipart'
import { ZodTypeProvider, serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod'

import dbPlugin       from './plugins/db.js'
import jwtPlugin      from './plugins/jwt.js'
import swaggerPlugin  from './plugins/swagger.js'
import authRoutes     from './modules/auth/routes.js'
import analysisRoutes from './modules/analysis/routes.js'
import healthRoutes   from './routes/health.js'
import { ensureBucket } from './services/storage.js'
import { config }       from './core/config.js'
import logger           from './core/logger.js'
import errorHandler     from './core/errorHandler.js'

const app = Fastify({ loggerInstance: logger })
    .withTypeProvider<ZodTypeProvider>()

app.setValidatorCompiler(validatorCompiler)
app.setSerializerCompiler(serializerCompiler)

// security
app.register(helmet, {
    contentSecurityPolicy: {
        directives: {
            defaultSrc:     ["'self'"],
            scriptSrc:      ["'self'", "'unsafe-inline'"],
            styleSrc:       ["'self'", "'unsafe-inline'"],
            imgSrc:         ["'self'", "data:"],
            workerSrc:      ["'self'", "blob:"],
        }
    }
})
app.register(cors,      { origin: config.CORS_ORIGIN })
app.register(rateLimit, { max: 100, timeWindow: '1 minute' })

// инфраструктура
app.register(swaggerPlugin)
app.register(dbPlugin)
app.register(jwtPlugin)
app.register(multipart, { limits: { fileSize: 10 * 1024 * 1024, files: 5 } })

// обработка ошибок
app.register(errorHandler)

// роуты
app.register(healthRoutes)
app.register(authRoutes,     { prefix: '/api/v1' })
app.register(analysisRoutes, { prefix: '/api/v1' })

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
