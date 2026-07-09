import { config } from '../config.js'
import logger from '../logger.js'
import { AppError } from '../errors.js'
import { type SmsPort } from './types.js'

const SEND_TIMEOUT_MS = 10_000

// SMS Aero API v2: basic auth email:api_key, JSON-ответ { success: boolean }.
// Имя отправителя (sign) по умолчанию «SMS Aero» — работает без модерации.
export class SmsAeroAdapter implements SmsPort {
    private readonly authHeader: string

    constructor() {
        // Валидность пары гарантирует superRefine в config.ts
        const credentials = `${config.SMSAERO_EMAIL}:${config.SMSAERO_API_KEY}`
        this.authHeader = `Basic ${Buffer.from(credentials).toString('base64')}`
    }

    async send(phoneE164: string, text: string): Promise<void> {
        // API принимает номер без «+»
        const number = phoneE164.replace(/^\+/, '')
        const url = new URL('https://gate.smsaero.ru/v2/sms/send')
        url.searchParams.set('number', number)
        url.searchParams.set('text', text)
        url.searchParams.set('sign', config.SMSAERO_SIGN)

        let res: Response
        try {
            res = await fetch(url, {
                headers: { Authorization: this.authHeader, Accept: 'application/json' },
                signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
            })
        } catch (err) {
            logger.error({ err, phone: phoneE164 }, 'smsaero request failed')
            throw new AppError('SMS_SEND_FAILED', 502, 'Не удалось отправить SMS')
        }

        const body = (await res.json().catch(() => null)) as {
            success?: boolean
            message?: string
        } | null

        if (!res.ok || !body?.success) {
            // Текст SMS (код!) в логи не пишем — только метаданные
            logger.error(
                { phone: phoneE164, status: res.status, providerMessage: body?.message },
                'smsaero rejected message'
            )
            throw new AppError('SMS_SEND_FAILED', 502, 'Не удалось отправить SMS')
        }

        logger.info({ phone: phoneE164 }, 'sms sent')
    }
}
