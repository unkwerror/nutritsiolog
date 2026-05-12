import pino, { type Logger } from 'pino'
import { config } from './config.js'

const logger: Logger = pino({
    level: config.LOG_LEVEL,
    redact: {
        paths: [
            'email',
            'phone',
            'password',
            'hash',
            'token',
            '*.email',
            '*.phone',
            '*.password',
            '*.hash',
            '*.token',
            'req.headers.authorization',
            'req.headers.cookie',
        ],
        censor: '[REDACTED]'
    }
})

export default logger
