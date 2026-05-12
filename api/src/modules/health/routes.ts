import { z } from 'zod'
import { sql } from 'drizzle-orm'
import { type FastifyInstance } from 'fastify'
import { analysisQueue } from '../../queues/analysisQueue.js'
import { ensureBucket } from '../../services/storage.js'
import { transporter } from '../../core/mailer.js'

const HealthSchema = z.object({
    status: z.enum(['ok', 'degraded']),
    checks: z.object({
        pg: z.boolean(),
        redis: z.boolean(),
        minio: z.boolean(),
        smtp: z.boolean(),
    }),
})

export default async function healthRoutes(fastify: FastifyInstance) {
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

            const ok = pg && redis && minio && smtp
            return reply
                .code(ok ? 200 : 503)
                .send({ status: ok ? 'ok' : 'degraded', checks: { pg, redis, minio, smtp } })
        }
    )
}
