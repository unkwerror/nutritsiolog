import { z } from 'zod'
import { sql } from 'drizzle-orm'
import { type FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { analysisQueue } from '../../queues/analysisQueue.js'
import { ensureBucket } from '../../services/storage.js'
import { transporter } from '../../core/mailer.js'

const HealthSchema = z.object({
    status: z.enum(['ok', 'degraded', 'down']),
    checks: z.object({
        pg: z.boolean(),
        redis: z.boolean(),
        minio: z.boolean(),
        smtp: z.boolean(),
    }),
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
            let redis = false
            let minio = false
            let smtp = false

            try {
                await request.server.db.execute(sql`SELECT 1`)
                pg = true
            } catch {
                /* noop */
            }
            try {
                await (await analysisQueue.client).ping()
                redis = true
            } catch {
                /* noop */
            }
            try {
                await ensureBucket()
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

            const checks = { pg, redis, minio, smtp }
            const isCritical = pg && redis && minio

            return reply
                .code(isCritical ? 200 : 503)
                .send({ status: isCritical ? (smtp ? 'ok' : 'degraded') : 'down', checks })
        }
    )
}

export default healthRoutes