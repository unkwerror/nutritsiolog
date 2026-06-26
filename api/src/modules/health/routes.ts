import { z } from 'zod'
import { sql } from 'drizzle-orm'
import { type FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import * as Minio from 'minio'
import { redis } from '../../core/redis.js'
import { transporter } from '../../core/mailer.js'
import { config } from '../../core/config.js'

const HealthSchema = z.object({
    status: z.enum(['ok', 'degraded', 'down']),
    checks: z.object({
        pg: z.boolean(),
        redis: z.boolean(),
        minio: z.boolean(),
        smtp: z.boolean(),
    }),
})

const minioClient = new Minio.Client({
    endPoint: config.MINIO_ENDPOINT,
    port: config.MINIO_PORT,
    useSSL: config.MINIO_USE_SSL,
    accessKey: config.MINIO_ACCESS_KEY,
    secretKey: config.MINIO_SECRET_KEY,
})

const healthRoutes: FastifyPluginAsyncZod = async (fastify) => {
    fastify.get(
        '/health',
        {
            schema: {
                tags: ['System'],
                response: { 200: HealthSchema, 503: HealthSchema },
            },
        },
        async (request, reply) => {
            let pg = false
            let redisOk = false
            let minio = false
            let smtp = false

            try {
                await request.server.db.execute(sql`SELECT 1`)
                pg = true
            } catch {
                /* noop */
            }
            try {
                await redis.ping()
                redisOk = true
            } catch {
                /* noop */
            }
            try {
                // bucketExists is a lightweight read — does not mutate
                await minioClient.bucketExists(config.MINIO_BUCKET)
                minio = true
            } catch {
                /* noop */
            }
            try {
                await transporter.verify()
                smtp = true
            } catch {
                /* noop */
            }

            const checks = { pg, redis: redisOk, minio, smtp }
            const isCritical = pg && redisOk && minio

            return reply
                .code(isCritical ? 200 : 503)
                .send({ status: isCritical ? (smtp ? 'ok' : 'degraded') : 'down', checks })
        }
    )
}

export default healthRoutes
