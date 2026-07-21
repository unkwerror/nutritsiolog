import logger from '../logger.js'
import { transporter } from '../mailer.js'
import { config } from '../config.js'
import { type SmsPort, type SmsSendContext } from './types.js'

// Dev-заглушка (аналог MockAdapter в OCR, решение 007): SMS не уходит,
// текст виден в логах и в Mailpit — письмо на sms-{номер}@sms.local.
export class MockSmsAdapter implements SmsPort {
    async send(phoneE164: string, text: string, ctx: SmsSendContext = {}): Promise<void> {
        logger.info({ phone: phoneE164, text, requestId: ctx.requestId }, 'mock sms')
        try {
            await transporter.sendMail({
                from: config.SMTP_FROM,
                to: `sms-${phoneE164.replace(/\D/g, '')}@sms.local`,
                subject: `SMS для ${phoneE164}`,
                text,
            })
        } catch {
            // Mailpit недоступен — не критично, код уже в логах
        }
    }
}
