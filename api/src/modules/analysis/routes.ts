import '@fastify/multipart'
import { z } from 'zod'
import { type FastifyInstance } from 'fastify'
import { AnalysisRepository } from './repository.js'
import { AnalysisService } from './service.js'
import { ValidationError } from '../../core/errors.js'
import { createSubscriber } from '../../core/redis.js'

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
    outOfRangeDirection: z.string().nullable(),
    comment: z.string().nullable(),
    method: z.string().nullable(),
})

const AnalysisListItemSchema = z.object({
    id: z.number(),
    status: z.string(),
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

export default async function analysisRoutes(fastify: FastifyInstance) {
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

            for await (const part of request.files()) {
                const buffer = await part.toBuffer()
                files.push({ buffer, mimeType: part.mimetype, originalName: part.filename })
            }

            const service = new AnalysisService(new AnalysisRepository(request.server.db))
            const result = await service.createAnalysis(request.user.id, files)

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
            const service = new AnalysisService(new AnalysisRepository(request.server.db))
            const list = await service.listAnalyses(request.user.id)
            return reply.send(list)
        }
    )

    fastify.get<{ Params: { id: string } }>(
        '/analysis/:id/events',
        {
            schema: {
                tags: ['Analysis'],
                security: [{ bearerAuth: [] }],
                params: z.object({ id: z.string() }),
                description: 'SSE stream: sends one event when OCR completes or fails',
            },
            preHandler: [fastify.authenticate],
        },
        async (request, reply) => {
            const numId = Number(request.params.id)
            if (!Number.isInteger(numId) || numId < 1)
                throw new ValidationError('INVALID_ID', 'Invalid analysis id')

            // Hijack response — Fastify не будет сам ничего отправлять
            reply.hijack()
            const raw = reply.raw

            raw.setHeader('Content-Type', 'text/event-stream')
            raw.setHeader('Cache-Control', 'no-cache')
            raw.setHeader('Connection', 'keep-alive')
            raw.setHeader('X-Accel-Buffering', 'no') // отключает буферизацию в Nginx

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

            // Подписываемся ДО проверки БД — иначе worker может опубликовать
            // между проверкой и подпиской и событие потеряется
            sub.on('message', (_ch: string, msg: string) => {
                finish(JSON.parse(msg) as { status: string; analysisId: number })
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

            // Анализ уже готов — отвечаем сразу
            if (analysis.status === 'done' || analysis.status === 'failed') {
                finish({ status: analysis.status, analysisId: numId })
                return
            }

            // Таймаут 5 минут — OCR max 60с × 3 попытки + запас
            // const здесь: timer объявлен после finish и используется только ниже
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

    fastify.get<{ Params: { id: string } }>(
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

            const service = new AnalysisService(new AnalysisRepository(request.server.db))
            const analysis = await service.getAnalysis(numId, request.user.id)

            return reply.send(analysis)
        }
    )
}
