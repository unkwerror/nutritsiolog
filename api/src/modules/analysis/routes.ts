import '@fastify/multipart'
import { z } from 'zod'
import { type FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { AnalysisRepository } from './repository.js'
import { AnalysisService } from './service.js'
import { MinioStorage } from './infrastructure/storage.js'
import { BullMQQueue } from './infrastructure/queue.js'
import { ValidationError } from '../../core/errors.js'
import { createSubscriber } from '../../core/redis.js'
import { config } from '../../core/config.js'

const storage = new MinioStorage()
const queue = new BullMQQueue()

const AnalysisResultSchema = z.object({
    analysisId: z.number(),
    status: z.string(),
})

const MarkerSchema = z.object({
    id: z.number(),
    name: z.string(),
    code: z.string().nullable(),
    section: z.string().nullable(),
    value: z.string().nullable(),
    unit: z.string().nullable(),
    referenceMin: z.string().nullable(),
    referenceMax: z.string().nullable(),
    referenceRaw: z.string().nullable(),
    isOutOfRange: z.boolean(),
    outOfRangeDirection: z.enum(['low', 'high']).nullable(),
    isEdited: z.boolean(),
    originalValue: z.string().nullable(),
    comment: z.string().nullable(),
    method: z.string().nullable(),
})

const MarkerAddSchema = z.object({
    name: z.string().trim().min(1).max(255),
    value: z.number().nullable().optional(),
    unit: z.string().max(50).nullable().optional(),
    section: z.string().max(100).nullable().optional(),
    comment: z.string().nullable().optional(),
    isOutOfRange: z.boolean().optional(),
    outOfRangeDirection: z.enum(['low', 'high']).nullable().optional(),
})

const MarkerEditSchema = z.object({
    value: z.number().nullable().optional(),
    unit: z.string().nullable().optional(),
    referenceMin: z.number().nullable().optional(),
    referenceMax: z.number().nullable().optional(),
    name: z.string().min(1).optional(),
    comment: z.string().nullable().optional(),
})

const analysisStatusValues = ['pending', 'processing', 'done', 'failed'] as const
const analysisTypeValues = [
    'cbc',
    'biochemistry',
    'thyroid',
    'hormones',
    'vitamins',
    'coagulation',
    'urinalysis',
    'lipid',
    'immunology',
    'other',
] as const

const AnalysisListItemSchema = z.object({
    id: z.number(),
    status: z.enum(analysisStatusValues),
    detectedTypes: z.array(z.enum(analysisTypeValues)).nullable(),
    analysisType: z.string().nullable(),
    typeSource: z.string(),
    labName: z.string().nullable(),
    fileOriginalName: z.string().nullable(),
    fileMimeType: z.string().nullable(),
    fileSize: z.number().nullable(),
    isArchived: z.boolean(),
    createdAt: z.date(),
    updatedAt: z.date(),
})

const AnalysisDetailSchema = AnalysisListItemSchema.extend({
    labAddress: z.string().nullable(),
    labPhone: z.string().nullable(),
    patientFullName: z.string().nullable(),
    patientGender: z.string().nullable(),
    patientBirthDate: z.string().nullable(),
    patientAge: z.number().nullable(),
    orderId: z.string().nullable(),
    sampleTakenAt: z.string().nullable(),
    reportDate: z.string().nullable(),
    markers: z.array(MarkerSchema),
})

const analysisRoutes: FastifyPluginAsyncZod = async (fastify) => {
    fastify.post(
        '/analysis/upload',
        {
            schema: {
                tags: ['Analysis'],
                security: [{ bearerAuth: [] }],
                response: {
                    202: z.union([AnalysisResultSchema, z.array(AnalysisResultSchema)]),
                },
            },
            preHandler: [fastify.authenticate],
        },
        async (request, reply) => {
            const files: Array<{ buffer: Buffer; mimeType: string; originalName: string }> = []
            let analysisType: string | undefined

            for await (const part of request.parts()) {
                if (part.type === 'file') {
                    const buffer = await part.toBuffer()
                    files.push({ buffer, mimeType: part.mimetype, originalName: part.filename })
                } else if (
                    part.fieldname === 'analysisType' &&
                    typeof part.value === 'string' &&
                    part.value
                ) {
                    analysisType = part.value
                }
            }

            const service = new AnalysisService(
                new AnalysisRepository(request.server.db),
                storage,
                queue
            )
            const result = await service.createAnalysis(request.user.id, files, {
                analysisType,
                ocrProvider: config.OCR_PROVIDER,
            })

            return reply.code(202).send(result)
        }
    )

    fastify.get(
        '/analysis',
        {
            schema: {
                tags: ['Analysis'],
                security: [{ bearerAuth: [] }],
                response: { 200: z.array(AnalysisListItemSchema) },
            },
            preHandler: [fastify.authenticate],
        },
        async (request, reply) => {
            const service = new AnalysisService(
                new AnalysisRepository(request.server.db),
                storage,
                queue
            )
            const list = await service.listAnalyses(request.user.id)
            return reply.send(list)
        }
    )

    fastify.get(
        '/analysis/:id/events',
        {
            schema: {
                tags: ['Analysis'],
                security: [{ bearerAuth: [] }],
                params: z.object({ id: z.string() }),
                description: 'SSE stream: sends events when OCR status changes',
            },
            preHandler: [fastify.authenticate],
        },
        async (request, reply) => {
            const numId = Number(request.params.id)
            if (!Number.isInteger(numId) || numId < 1)
                throw new ValidationError('INVALID_ID', 'Invalid analysis id')

            reply.hijack()
            const raw = reply.raw

            // @fastify/cors never runs after hijack — add CORS headers manually
            const origin = request.headers.origin
            if (origin) {
                raw.setHeader('Access-Control-Allow-Origin', origin)
                raw.setHeader('Access-Control-Allow-Credentials', 'true')
                raw.setHeader('Vary', 'Origin')
            }

            raw.setHeader('Content-Type', 'text/event-stream')
            raw.setHeader('Cache-Control', 'no-cache')
            raw.setHeader('Connection', 'keep-alive')
            raw.setHeader('X-Accel-Buffering', 'no')

            const repo = new AnalysisRepository(request.server.db)
            const sub = createSubscriber()
            let closed = false

            const finish = (data: { status: string; analysisId: number }) => {
                if (closed) return
                closed = true
                sub.disconnect()
                if (!raw.destroyed) {
                    raw.write(`data: ${JSON.stringify(data)}\n\n`)
                    raw.end()
                }
            }

            const sendEvent = (data: { status: string; analysisId: number }) => {
                if (closed || raw.destroyed) return
                raw.write(`data: ${JSON.stringify(data)}\n\n`)
                if (data.status === 'done' || data.status === 'failed') {
                    finish(data)
                }
            }

            sub.on('message', (_ch: string, msg: string) => {
                sendEvent(JSON.parse(msg) as { status: string; analysisId: number })
            })

            await sub.subscribe(`analysis:${numId}`)

            if (raw.destroyed) {
                sub.disconnect()
                return
            }

            const analysis = await repo.findByIdAndUser(numId, request.user.id)

            if (!analysis) {
                sub.disconnect()
                if (!raw.destroyed) raw.end()
                return
            }

            if (analysis.status === 'done' || analysis.status === 'failed') {
                finish({ status: analysis.status, analysisId: numId })
                return
            }

            // Send current status immediately so client knows we're connected
            if (!raw.destroyed) {
                raw.write(
                    `data: ${JSON.stringify({ status: analysis.status, analysisId: numId })}\n\n`
                )
            }

            const timer = setTimeout(
                () => {
                    finish({ status: 'timeout', analysisId: numId })
                },
                5 * 60 * 1000
            )

            request.raw.on('close', () => {
                if (!closed) {
                    closed = true
                    clearTimeout(timer)
                    sub.disconnect()
                }
            })
        }
    )

    fastify.get(
        '/analysis/:id',
        {
            schema: {
                tags: ['Analysis'],
                security: [{ bearerAuth: [] }],
                params: z.object({ id: z.string() }),
                response: { 200: AnalysisDetailSchema },
            },
            preHandler: [fastify.authenticate],
        },
        async (request, reply) => {
            const numId = Number(request.params.id)
            if (!Number.isInteger(numId) || numId < 1)
                throw new ValidationError('INVALID_ID', 'Invalid analysis id')

            const service = new AnalysisService(
                new AnalysisRepository(request.server.db),
                storage,
                queue
            )
            const analysis = await service.getAnalysis(numId, request.user.id)

            return reply.send(analysis)
        }
    )

    fastify.post(
        '/analysis/:analysisId/markers',
        {
            schema: {
                tags: ['Analysis'],
                security: [{ bearerAuth: [] }],
                params: z.object({
                    analysisId: z.coerce.number().int().positive(),
                }),
                body: MarkerAddSchema,
                response: { 201: MarkerSchema },
            },
            preHandler: [fastify.authenticate],
        },
        async (request, reply) => {
            const service = new AnalysisService(
                new AnalysisRepository(request.server.db),
                storage,
                queue
            )
            const created = await service.addMarker(
                request.params.analysisId,
                request.user.id,
                request.body
            )
            return reply.code(201).send(created)
        }
    )

    fastify.patch(
        '/analysis/:analysisId/markers/:markerId',
        {
            schema: {
                tags: ['Analysis'],
                security: [{ bearerAuth: [] }],
                params: z.object({
                    analysisId: z.coerce.number().int().positive(),
                    markerId: z.coerce.number().int().positive(),
                }),
                body: MarkerEditSchema,
                response: { 200: MarkerSchema },
            },
            preHandler: [fastify.authenticate],
        },
        async (request, reply) => {
            const service = new AnalysisService(
                new AnalysisRepository(request.server.db),
                storage,
                queue
            )
            const updated = await service.updateMarker(
                request.params.markerId,
                request.user.id,
                request.body
            )
            return reply.send(updated)
        }
    )
}

export default analysisRoutes
