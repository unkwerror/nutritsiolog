import './core/proxy.js'
import { Worker } from 'bullmq'
import { eq } from 'drizzle-orm'

import { MinioStorage } from './modules/analysis/infrastructure/storage.js'

const storage = new MinioStorage()
import { createOcrService } from './ocr/index.js'
import { analyses, markers, type analysisTypeEnum } from './db/schema.js'
import { db } from './db/client.js'
import { redis } from './core/redis.js'
import { config } from './core/config.js'
import logger from './core/logger.js'

type AnalysisType = (typeof analysisTypeEnum.enumValues)[number]

const SECTION_TO_TYPE: Record<string, AnalysisType> = {
    'Общий анализ крови': 'cbc',
    Биохимия: 'biochemistry',
    'Гормоны щитовидной железы': 'thyroid',
    'Половые гормоны': 'hormones',
    'Витамины и микроэлементы': 'vitamins',
    Коагулограмма: 'coagulation',
    'Общий анализ мочи': 'urinalysis',
    'Липидный профиль': 'lipid',
    Иммунология: 'immunology',
    Другое: 'other',
}

const ocrService = createOcrService(config)

type AnalysisJobData = {
    analysisId: number
    fileKey: string
    mimeType: string
    analysisType?: string
    ocrProvider?: string
}

const worker = new Worker<AnalysisJobData>(
    'analysis',
    async (job) => {
        const { analysisId, fileKey, mimeType, analysisType, ocrProvider } = job.data
        const log = logger.child({ jobId: job.id, analysisId })

        log.info('job started')

        // Idempotency: если job уже обработан (retry после успешного commit) — пропускаем
        const [current] = await db
            .select({ status: analyses.status })
            .from(analyses)
            .where(eq(analyses.id, analysisId))

        if (!current) {
            log.warn('analysis not found, skipping')
            return
        }

        if (current.status === 'done') {
            log.info('already processed, skipping')
            return
        }

        // Mark as processing so UI badge updates
        await db
            .update(analyses)
            .set({ status: 'processing', updatedAt: new Date() })
            .where(eq(analyses.id, analysisId))

        await redis.publish(
            `analysis:${analysisId}`,
            JSON.stringify({ status: 'processing', analysisId })
        )
        log.info('status set to processing')

        try {
            const buffer = await storage.getBuffer(fileKey)
            const result = await ocrService.parseLabResult(buffer, mimeType, analysisType)

            log.info({ markerCount: result.markers.length }, 'parsed markers')

            // Deduplicate by (name, method) — OCR may return the same marker twice
            const seen = new Set<string>()
            const uniqueMarkers = result.markers.filter(
                (m: { name: string; method: string | null }) => {
                    const key = `${m.name}|${m.method ?? ''}`
                    if (seen.has(key)) return false
                    seen.add(key)
                    return true
                }
            )

            // Map OCR section names to canonical analysisTypeEnum values
            const detectedTypes = [
                ...new Set(
                    uniqueMarkers
                        .map((m: { section: string | null }) => SECTION_TO_TYPE[m.section ?? ''])
                        .filter((t): t is AnalysisType => t !== undefined)
                ),
            ]

            await db.transaction(async (tx) => {
                await tx.insert(markers).values(
                    uniqueMarkers.map((marker) => ({
                        analysisId,
                        name: marker.name,
                        code: marker.code,
                        section: marker.section,
                        value: marker.value !== null ? String(marker.value) : null,
                        unit: marker.unit,
                        referenceMin:
                            marker.referenceMin !== null ? String(marker.referenceMin) : null,
                        referenceMax:
                            marker.referenceMax !== null ? String(marker.referenceMax) : null,
                        referenceRaw: marker.referenceRaw,
                        isOutOfRange: marker.isOutOfRange,
                        outOfRangeDirection: marker.outOfRangeDirection,
                        comment: marker.comment,
                        method: marker.method,
                    }))
                )

                await tx
                    .update(analyses)
                    .set({
                        status: 'done',
                        detectedTypes,
                        ocrProvider: ocrProvider ?? config.OCR_PROVIDER,
                        labName: result.lab?.name,
                        labAddress: result.lab?.address,
                        labPhone: result.lab?.phone,
                        patientFullName: result.patient?.fullName,
                        patientGender: result.patient?.gender,
                        patientBirthDate: result.patient?.birthDate,
                        patientAge: result.patient?.age,
                        orderId: result.order?.id,
                        sampleTakenAt: result.order?.sampleTakenAt,
                        reportDate: result.order?.reportDate,
                        updatedAt: new Date(),
                    })
                    .where(eq(analyses.id, analysisId))
            })

            await redis.publish(
                `analysis:${analysisId}`,
                JSON.stringify({ status: 'done', analysisId })
            )
            log.info('job done')
        } catch (err) {
            log.error({ err }, 'job failed')
            await db
                .update(analyses)
                .set({ status: 'failed', updatedAt: new Date() })
                .where(eq(analyses.id, analysisId))
            // Не глушим ошибку публикации — просто логируем, чтобы не скрыть оригинальную
            redis
                .publish(`analysis:${analysisId}`, JSON.stringify({ status: 'failed', analysisId }))
                .catch((pubErr: Error) =>
                    log.warn({ err: pubErr }, 'Failed to publish failed status')
                )
            throw err
        }
    },
    {
        connection: { host: config.REDIS_HOST, port: config.REDIS_PORT },
        concurrency: 3,
        limiter: { max: 10, duration: 60_000 },
    }
)

process.on('SIGTERM', async () => {
    logger.info('SIGTERM received, shutting down worker')
    try {
        await worker.close()
        process.exit(0)
    } catch (err) {
        logger.error({ err }, 'Error during worker shutdown')
        process.exit(1)
    }
})
