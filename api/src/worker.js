import './utils/proxy.js'
import { Worker } from 'bullmq'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { eq } from 'drizzle-orm'

import { getFileBuffer }           from './services/storage.js'
import { parseLabResult }          from './services/ocr.js'
import { analyses, markers }       from './db/schema.js'
import logger                      from './utils/logger.js'

const sql = postgres(process.env.DATABASE_URL)
const db  = drizzle(sql)

const worker = new Worker('analysis', async (job) => {
    const { analysisId, fileKey, mimeType } = job.data
    const log = logger.child({ jobId: job.id, analysisId })

    log.info('job started')

    try {
        const buffer = await getFileBuffer(fileKey)
        const result = await parseLabResult(buffer, mimeType)

        log.info({ markerCount: result.markers.length }, 'parsed markers')

        await db.transaction(async (tx) => {
            await tx.insert(markers).values(
                result.markers.map(marker => ({
                    analysisId,
                    name:                marker.name,
                    code:                marker.code,
                    section:             marker.section,
                    value:               marker.value,
                    unit:                marker.unit,
                    referenceMin:        marker.referenceMin,
                    referenceMax:        marker.referenceMax,
                    referenceRaw:        marker.referenceRaw,
                    isOutOfRange:        marker.isOutOfRange,
                    outOfRangeDirection: marker.outOfRangeDirection,
                    comment:             marker.comment,
                    method:              marker.method
                }))
            )

            await tx.update(analyses)
                .set({
                    status:           'done',
                    labName:          result.lab?.name,
                    labAddress:       result.lab?.address,
                    labPhone:         result.lab?.phone,
                    patientFullName:  result.patient?.fullName,
                    patientGender:    result.patient?.gender,
                    patientBirthDate: result.patient?.birthDate,
                    patientAge:       result.patient?.age,
                    orderId:          result.order?.id,
                    sampleTakenAt:    result.order?.sampleTakenAt,
                    reportDate:       result.order?.reportDate,
                    updatedAt:        new Date()
                })
                .where(eq(analyses.id, analysisId))
        })

        log.info('job done')

    } catch (err) {
        log.error({ err }, 'job failed')
        await db.update(analyses)
            .set({ status: 'failed', updatedAt: new Date() })
            .where(eq(analyses.id, analysisId))
        throw err
    }

}, {
    connection: {
        host: process.env.REDIS_HOST,
        port: Number(process.env.REDIS_PORT)
    }
})

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
