import { Queue } from 'bullmq'
import { config } from '../core/config.js'

export const analysisQueue = new Queue('analysis', {
    connection: {
        host: config.REDIS_HOST,
        port: config.REDIS_PORT,
    },
    defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: { age: 24 * 3600, count: 1000 },
        removeOnFail:     { age: 7 * 24 * 3600 },
    },
})
