import { setTimeout as delay } from 'node:timers/promises'
import { Agent, fetch as undiciFetch } from 'undici'
import { config } from '../config.js'
import logger from '../logger.js'
import { AppError } from '../errors.js'
import { type SmsPort, type SmsSendContext } from './types.js'

const API_ORIGIN = 'https://gate.smsaero.ru'
const ATTEMPT_TIMEOUT_MS = 8_000
const MAX_ATTEMPTS = 3
const BACKOFF_BASE_MS = 400
const JITTER_MS = 200

// SMS Aero API v2: basic auth email:api_key, JSON-ответ { success: boolean }.
// Имя отправителя (sign) по умолчанию «SMS Aero» — работает без модерации.
export class SmsAeroAdapter implements SmsPort {
    private readonly authHeader: string

    // Собственный пул с keep-alive: TCP+TLS к gate.smsaero.ru не платится на каждый
    // запрос/ретрай. Отдельный dispatcher — глобальный может быть SOCKS-прокси
    // для Gemini (core/proxy.ts), SMS Aero должен ходить напрямую.
    private readonly dispatcher = new Agent({
        keepAliveTimeout: 30_000,
        connect: { timeout: 5_000 },
    })

    constructor() {
        // Валидность пары гарантирует superRefine в config.ts
        const credentials = `${config.SMSAERO_EMAIL}:${config.SMSAERO_API_KEY}`
        this.authHeader = `Basic ${Buffer.from(credentials).toString('base64')}`
        this.warmup()
    }

    // Прогрев на старте процесса: DNS + TCP + TLS выполняются заранее, заодно
    // проверяется валидность ключа. Ошибка не роняет процесс — только warn.
    private warmup(): void {
        const started = Date.now()
        void undiciFetch(`${API_ORIGIN}/v2/auth`, {
            headers: { Authorization: this.authHeader, Accept: 'application/json' },
            dispatcher: this.dispatcher,
            signal: AbortSignal.timeout(ATTEMPT_TIMEOUT_MS),
        })
            .then((res) =>
                logger.info(
                    { status: res.status, durationMs: Date.now() - started },
                    'smsaero warmup done'
                )
            )
            .catch((err: unknown) => logger.warn({ err }, 'smsaero warmup failed'))
    }

    async send(phoneE164: string, text: string, ctx: SmsSendContext = {}): Promise<void> {
        const log = logger.child({ requestId: ctx.requestId, phone: phoneE164 })
        // API принимает номер без «+»
        const number = phoneE164.replace(/^\+/, '')

        for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
            const started = Date.now()
            log.info({ attempt }, 'smsaero api call started')
            try {
                // Код — в теле POST, а не в query: не светится в access-логах
                // промежуточных узлов. Текст SMS и API-ключ в логи не пишем.
                const res = await undiciFetch(`${API_ORIGIN}/v2/sms/send`, {
                    method: 'POST',
                    headers: {
                        Authorization: this.authHeader,
                        'Content-Type': 'application/json',
                        Accept: 'application/json',
                    },
                    body: JSON.stringify({ number, text, sign: config.SMSAERO_SIGN }),
                    dispatcher: this.dispatcher,
                    signal: AbortSignal.timeout(ATTEMPT_TIMEOUT_MS),
                })

                const body = (await res.json().catch(() => null)) as {
                    success?: boolean
                    data?: { id?: number; status?: number; extendStatus?: string }
                    message?: string
                } | null

                if (res.ok && body?.success) {
                    log.info(
                        {
                            attempt,
                            durationMs: Date.now() - started,
                            smsId: body.data?.id,
                            smsStatus: body.data?.status,
                            smsExtendStatus: body.data?.extendStatus,
                        },
                        'sms sent'
                    )
                    return
                }

                // 5xx/429 — временное, повтор имеет смысл; 4xx (ключ, номер) — нет
                const retryable = res.status >= 500 || res.status === 429
                log.error(
                    {
                        attempt,
                        durationMs: Date.now() - started,
                        status: res.status,
                        providerMessage: body?.message,
                        retryable,
                    },
                    'smsaero rejected message'
                )
                if (!retryable) break
            } catch (err) {
                // Сетевая ошибка или таймаут — повторяем с backoff
                log.error(
                    { err, attempt, durationMs: Date.now() - started },
                    'smsaero request failed'
                )
            }

            if (attempt < MAX_ATTEMPTS) {
                await delay(BACKOFF_BASE_MS * attempt + Math.floor(Math.random() * JITTER_MS))
            }
        }

        throw new AppError('SMS_SEND_FAILED', 502, 'Не удалось отправить SMS')
    }
}
