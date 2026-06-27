import { z } from 'zod'

const ConfigSchema = z.object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.coerce.number().default(3001),

    DATABASE_URL: z.string().min(1),
    JWT_SECRET: z.string().min(32),

    REDIS_HOST: z.string().min(1),
    REDIS_PORT: z.coerce.number().default(6379),

    MINIO_ENDPOINT: z.string().min(1),
    MINIO_PORT: z.coerce.number().default(9000),
    MINIO_USE_SSL: z
        .string()
        .transform((v) => v === 'true')
        .default(false),
    MINIO_ACCESS_KEY: z.string().min(1),
    MINIO_SECRET_KEY: z.string().min(1),
    MINIO_BUCKET: z.string().min(1),

    OCR_PROVIDER: z.enum(['gemini', 'mock', 'yandex']).default('gemini'),
    GEMINI_API_KEY: z.string().optional(),
    SOCKS_PROXY: z.string().optional(),

    YANDEX_API_KEY: z.string().optional(),
    YANDEX_FOLDER_ID: z.string().optional(),

    DEMO_ACCESS_KEY: z.string().optional(),

    // Список email'ов с доступом к админ-панели (через запятую).
    // Доступ привязан к почте: requireAdmin сверяет request.user.email с этим списком.
    ADMIN_EMAILS: z
        .string()
        .default('')
        .transform((s) =>
            s
                .split(',')
                .map((e) => e.trim().toLowerCase())
                .filter(Boolean)
        ),

    CORS_ORIGIN: z.string().default('http://localhost:3000'),
    LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error']).default('info'),

    SMTP_HOST: z.string().default('localhost'),
    SMTP_PORT: z.coerce.number().default(1025),
    SMTP_USER: z.string().optional(),
    SMTP_PASS: z.string().optional(),
    SMTP_FROM: z.string().default('noreply@nutritsiolog.local'),
})

export type Config = z.infer<typeof ConfigSchema>

function parseConfig(): Config {
    const result = ConfigSchema.safeParse(process.env)

    if (!result.success) {
        process.stderr.write('Invalid environment configuration:\n')
        for (const issue of result.error.issues) {
            process.stderr.write(`  ${issue.path.join('.')}: ${issue.message}\n`)
        }
        process.exit(1)
    }

    return result.data
}

export const config = parseConfig()
