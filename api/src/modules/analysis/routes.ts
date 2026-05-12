import '@fastify/multipart'
import { z }                    from 'zod'
import { type FastifyInstance } from 'fastify'
import { AnalysisRepository }   from './repository.js'
import { AnalysisService }      from './service.js'
import { ValidationError }      from '../../core/errors.js'

const AnalysisResultSchema = z.object({
    analysisId: z.number(),
    status:     z.string(),
})

export default async function analysisRoutes(fastify: FastifyInstance) {

    fastify.post('/analysis/upload', {
        schema: {
            tags: ['Analysis'],
            security: [{ bearerAuth: [] }],
            response: {
                202: z.union([AnalysisResultSchema, z.array(AnalysisResultSchema)]),
            },
        },
        preHandler: [fastify.authenticate],
    }, async (request, reply) => {
        const files: Array<{ buffer: Buffer; mimeType: string; originalName: string }> = []

        for await (const part of request.files()) {
            const buffer = await part.toBuffer()
            files.push({ buffer, mimeType: part.mimetype, originalName: part.filename })
        }

        const service = new AnalysisService(new AnalysisRepository(request.server.db))
        const result  = await service.createAnalysis(request.user.id, files)

        return reply.code(202).send(result)
    })

    fastify.get<{ Params: { id: string } }>('/analysis/:id', {
        schema: {
            tags: ['Analysis'],
            security: [{ bearerAuth: [] }],
            params: z.object({ id: z.string() }),
        },
        preHandler: [fastify.authenticate],
    }, async (request, reply) => {
        const numId = Number(request.params.id)
        if (!Number.isInteger(numId) || numId < 1)
            throw new ValidationError('INVALID_ID', 'Invalid analysis id')

        const service  = new AnalysisService(new AnalysisRepository(request.server.db))
        const analysis = await service.getAnalysis(numId, request.user.id)

        return reply.send(analysis)
    })
}
