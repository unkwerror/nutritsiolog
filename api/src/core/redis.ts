import { Redis } from 'ioredis'
import { config } from './config.js'
import logger from './logger.js'

const redisConfig = { host: config.REDIS_HOST, port: config.REDIS_PORT, lazyConnect: true }

export const redis = new Redis(redisConfig)
redis.on('error', (err: Error) => logger.error({ err }, 'Redis client error'))

// Отдельное подключение для subscribe — ioredis запрещает другие команды в subscriber-режиме
export function createSubscriber(): Redis {
    const sub = new Redis(redisConfig)
    sub.on('error', (err: Error) => logger.error({ err }, 'Redis subscriber error'))
    return sub
}
