import { Queue } from 'bullmq'

import { config } from '../core/config.js'

export const analysisQueue = new Queue('analysis', {
    connection: {
        host: config.REDIS_HOST,
        port: config.REDIS_PORT
    }
})
