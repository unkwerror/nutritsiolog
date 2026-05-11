import './utils/proxy.js'
import { Worker } from 'bullmq'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { eq } from 'drizzle-orm'

import { getFileBuffer } from './services/storage.js'
import { parseLabResult } from './services/ocr.js'
import { analyses, markers } from './db/schema.js'

const sql = postgres(process.env.DATABASE_URL)
const db = drizzle(sql)

new Worker('analysis', async (job) => {
    const { analysisId, fileKey, mimeType } = job.data

    try {
        const buffer = await getFileBuffer(fileKey)
        const result = await parseLabResult(buffer, mimeType)

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
                .set({ status: 'done', updatedAt: new Date() })
                .where(eq(analyses.id, analysisId))
        })

    } catch (err) {
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
