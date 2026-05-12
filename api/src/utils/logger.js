import pino from 'pino'

const logger = pino({
    level: process.env.LOG_LEVEL || 'info',
    redact: {
        paths: [
            'password',
            'hash',
            'token',
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
