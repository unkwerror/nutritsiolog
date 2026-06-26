import { Queue } from 'bullmq'
import { config } from '../../../core/config.js'

export interface AnalysisJobPayload {
    analysisId: number
    fileKey: string
    mimeType: string
    analysisType?: string
    ocrProvider?: string
}

export interface QueuePort {
    add(payload: AnalysisJobPayload): Promise<void>
}

export class BullMQQueue implements QueuePort {
    private queue: Queue<AnalysisJobPayload>

    constructor() {
        this.queue = new Queue<AnalysisJobPayload>('analysis', {
            connection: {
                host: config.REDIS_HOST,
                port: config.REDIS_PORT,
            },
            defaultJobOptions: {
                attempts: 3,
                backoff: { type: 'exponential', delay: 5000 },
                removeOnComplete: { age: 24 * 3600, count: 1000 },
                removeOnFail: { age: 7 * 24 * 3600 },
            },
        })
    }

    async add(payload: AnalysisJobPayload): Promise<void> {
        await this.queue.add('parse', payload)
    }
}
