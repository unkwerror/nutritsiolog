import { eq } from 'drizzle-orm'
import { analyses } from '../db/schema.js'
import { uploadFile } from '../services/storage.js'
import { analysisQueue } from '../queues/analysisQueue.js'

export default async function analysisRoutes(fastify) {

    fastify.post('/analysis/upload', { preHandler: [fastify.authenticate] }, async (request, reply) => {
        const { db } = request.server
        const userId = request.user.id

        const parts = []
        for await (const part of request.files()) {
            const buffer = await part.toBuffer()
            parts.push({ buffer, mimeType: part.mimetype, originalName: part.filename })
        }

        if (parts.length === 0)
            return reply.code(400).send({ error: 'Nothing uploaded' })

        const results = []

        for (const file of parts) {
            const fileKey = await uploadFile(file.buffer, file.originalName, file.mimeType)

            const [analysis] = await db.insert(analyses).values({
                userId,
                fileKey,
                fileOriginalName: file.originalName,
                fileMimeType:     file.mimeType,
                fileSize:         file.buffer.length,
                status:           'pending'
            }).returning()

            await analysisQueue.add('parse', {
                analysisId: analysis.id,
                fileKey,
                mimeType: file.mimeType
            })

            results.push({ analysisId: analysis.id, status: 'pending' })
        }

        return reply.code(202).send(results.length === 1 ? results[0] : results)
    })

    fastify.get('/analysis/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
        const { db } = request.server
        const { id } = request.params

        const [analysis] = await db.select().from(analyses).where(eq(analyses.id, Number(id)))

        if (!analysis) return reply.code(404).send({ error: 'Not found' })
        if (analysis.userId !== request.user.id) return reply.code(403).send({ error: 'Forbidden' })

        return analysis
    })
}
