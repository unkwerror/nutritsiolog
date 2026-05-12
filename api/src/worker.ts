import './core/proxy.js'
import { Worker } from 'bullmq'
import { eq } from 'drizzle-orm'

import { getFileBuffer } from './services/storage.js'
import { createOcrService } from './ocr/index.js'
import { analyses, markers } from './db/schema.js'
import { db } from './db/client.js'
import { config } from './core/config.js'
import logger from './core/logger.js'

const ocrService = createOcrService(config)

type AnalysisJobData = {
    analysisId: number
    fileKey: string
    mimeType: string
}

const worker = new Worker<AnalysisJobData>(
    'analysis',
    async (job) => {
        const { analysisId, fileKey, mimeType } = job.data
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

        try {
            const buffer = await getFileBuffer(fileKey)
            const result = await ocrService.parseLabResult(buffer, mimeType)

            log.info({ markerCount: result.markers.length }, 'parsed markers')

            await db.transaction(async (tx) => {
                await tx.insert(markers).values(
                    result.markers.map((marker) => ({
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

            log.info('job done')
        } catch (err) {
            log.error({ err }, 'job failed')
            await db
                .update(analyses)
                .set({ status: 'failed', updatedAt: new Date() })
                .where(eq(analyses.id, analysisId))
            throw err
        }
    },
    {
        connection: { host: config.REDIS_HOST, port: config.REDIS_PORT },
        concurrency: 1,
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
