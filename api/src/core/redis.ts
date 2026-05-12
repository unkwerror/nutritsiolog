import { Redis } from 'ioredis'
import { config } from './config.js'
import logger from './logger.js'

export const redis = new Redis({
    host: config.REDIS_HOST,
    port: config.REDIS_PORT,
    lazyConnect: true,
})

redis.on('error', (err: Error) => logger.error({ err }, 'Redis client error'))
