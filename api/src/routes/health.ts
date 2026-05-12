import { sql }           from 'drizzle-orm'
import { type FastifyInstance } from 'fastify'
import { analysisQueue } from '../queues/analysisQueue.js'
import { ensureBucket }  from '../services/storage.js'

export default async function healthRoutes(fastify: FastifyInstance) {
    fastify.get('/health', async (request, reply) => {
        let pg    = false
        let redis = false
        let minio = false

        try {
            await request.server.db.execute(sql`SELECT 1`)
            pg = true
        } catch {}

        try {
            const redisClient = await analysisQueue.client
            await redisClient.ping()
            redis = true
        } catch {}

        try {
            await ensureBucket()
            minio = true
        } catch {}

        const ok = pg && redis && minio

        return reply
            .code(ok ? 200 : 503)
            .send({ status: ok ? 'ok' : 'degraded', checks: { pg, redis, minio } })
    })
}
