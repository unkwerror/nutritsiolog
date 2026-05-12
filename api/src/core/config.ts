import { z } from 'zod'

const ConfigSchema = z.object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT:     z.coerce.number().default(3001),

    DATABASE_URL: z.string().min(1),
    JWT_SECRET:   z.string().min(32),

    REDIS_HOST: z.string().min(1),
    REDIS_PORT: z.coerce.number().default(6379),

    MINIO_ENDPOINT:   z.string().min(1),
    MINIO_PORT:       z.coerce.number().default(9000),
    MINIO_USE_SSL:    z.string().transform(v => v === 'true').default(false),
    MINIO_ACCESS_KEY: z.string().min(1),
    MINIO_SECRET_KEY: z.string().min(1),
    MINIO_BUCKET:     z.string().min(1),

    OCR_PROVIDER:   z.enum(['gemini', 'mock', 'yandex']).default('gemini'),
    GEMINI_API_KEY: z.string().optional(),
    SOCKS_PROXY:    z.string().optional(),

    CORS_ORIGIN: z.string().default('http://localhost:3000'),
    LOG_LEVEL:   z.enum(['trace', 'debug', 'info', 'warn', 'error']).default('info'),
})

export type Config = z.infer<typeof ConfigSchema>

function parseConfig(): Config {
    const result = ConfigSchema.safeParse(process.env)

    if (!result.success) {
        console.error('Invalid environment configuration:')
        for (const issue of result.error.issues) {
            console.error(`  ${issue.path.join('.')}: ${issue.message}`)
        }
        process.exit(1)
    }

    return result.data
}

export const config = parseConfig()
