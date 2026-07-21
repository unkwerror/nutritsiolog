import { z } from 'zod'
import { type FastifyPluginAsyncZod } from 'fastify-type-provider-zod'

// Callback-статусы доставки от SMS Aero (URL настраивается в кабинете SMS Aero:
// Настройки → Callback). Эндпоинт только логирует: в связке с логом «sms sent»
// (smsId) по времени видно, сколько занял маршрут оператора до фактической доставки.

// В payload может входить текст SMS (код подтверждения) — вырезаем перед логом
function sanitize(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(sanitize)
    if (value && typeof value === 'object') {
        return Object.fromEntries(
            Object.entries(value as Record<string, unknown>)
                .filter(([key]) => key !== 'text')
                .map(([key, inner]) => [key, sanitize(inner)])
        )
    }
    return value
}

const smsRoutes: FastifyPluginAsyncZod = async (fastify) => {
    // SMS Aero может слать form-urlencoded; парсер действует только внутри плагина
    fastify.addContentTypeParser(
        'application/x-www-form-urlencoded',
        { parseAs: 'string' },
        (_req, body, done) => {
            done(null, Object.fromEntries(new URLSearchParams(String(body))))
        }
    )

    fastify.post(
        '/sms/callback',
        {
            schema: {
                tags: ['Sms'],
                response: { 200: z.object({ ok: z.boolean() }) },
            },
        },
        async (request, reply) => {
            request.log.info({ callback: sanitize(request.body) }, 'smsaero delivery callback')
            return reply.send({ ok: true })
        }
    )
}

export default smsRoutes
