import './core/proxy.js'
import Fastify from 'fastify'
import helmet from '@fastify/helmet'
import cors from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'
import multipart from '@fastify/multipart'
import { ZodTypeProvider, serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod'

import dbPlugin from './plugins/db.js'
import jwtPlugin from './plugins/jwt.js'
import swaggerPlugin from './plugins/swagger.js'
import authRoutes from './modules/auth/routes.js'
import analysisRoutes from './modules/analysis/routes.js'
import questionnaireRoutes from './modules/questionnaire/routes.js'
import profileRoutes from './modules/profile/routes.js'
import adminRoutes from './modules/admin/routes.js'
import healthRoutes from './modules/health/routes.js'
import devtoolsRoutes from './modules/devtools/upload.js'
import { MinioStorage } from './modules/analysis/infrastructure/storage.js'
import { config } from './core/config.js'
import logger from './core/logger.js'
import errorHandler from './core/errorHandler.js'

const app = Fastify({ loggerInstance: logger }).withTypeProvider<ZodTypeProvider>()

app.setValidatorCompiler(validatorCompiler)
app.setSerializerCompiler(serializerCompiler)

// security
// CSP отключён — настраивается на уровне Nginx в prod (там же терминация TLS)
app.register(helmet, { contentSecurityPolicy: false })
const allowedOrigins = config.CORS_ORIGIN.split(',').map((s: string) => s.trim())
app.register(cors, {
    origin: (origin: string | undefined, cb: (err: Error | null, allow: boolean) => void) => {
        // Чужой origin — просто не отдаём CORS-заголовки (браузер заблокирует сам).
        // Error здесь превращал каждый такой запрос в 500 в логах.
        cb(null, !origin || allowedOrigins.includes(origin))
    },
    credentials: true,
    // По умолчанию @fastify/cors разрешает только GET,HEAD,POST — без этого
    // preflight для PATCH/PUT/DELETE падает с CORS-ошибкой.
    methods: ['GET', 'HEAD', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    exposedHeaders: ['Content-Disposition'],
})
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
app.register(authRoutes, { prefix: '/api/v1' })
app.register(analysisRoutes, { prefix: '/api/v1' })
app.register(questionnaireRoutes, { prefix: '/api/v1' })
app.register(profileRoutes, { prefix: '/api/v1' })
app.register(adminRoutes, { prefix: '/api/v1' })
if (config.NODE_ENV !== 'production') app.register(devtoolsRoutes)

// PM2 по умолчанию шлёт SIGINT — без него graceful shutdown не срабатывал
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
    process.on(signal, async () => {
        app.log.info(`${signal} received, shutting down`)
        try {
            await app.close()
            process.exit(0)
        } catch (err) {
            app.log.error({ err }, 'Error during shutdown')
            process.exit(1)
        }
    })
}

const start = async () => {
    try {
        await new MinioStorage().ensureBucket()
        await app.listen({ port: config.PORT, host: '0.0.0.0' })
    } catch (err) {
        app.log.error({ err }, 'Failed to start')
        process.exit(1)
    }
}

start()
