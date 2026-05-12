import { redis }         from '../../core/redis.js'
import { sendOtpEmail }  from '../../core/mailer.js'
import { RateLimitError } from '../../core/errors.js'
import { config }        from '../../core/config.js'
import logger            from '../../core/logger.js'

const OTP_TTL_SEC  = 10 * 60   // 10 минут
const RATE_TTL_SEC = 15 * 60   // окно для rate-limit
const MAX_REQUESTS = 3          // кодов за окно
const MAX_ATTEMPTS = 5          // попыток ввода до блокировки кода

type OtpData = { code: string; attempts: number }

function generateCode(): string {
    return String(Math.floor(100000 + Math.random() * 900000))
}

const otpKey  = (id: string) => `otp:${id}`
const rateKey = (id: string) => `otp_rate:${id}`

export async function sendOtp(identifier: string, type: 'email' | 'phone'): Promise<void> {
    const count = await redis.incr(rateKey(identifier))
    if (count === 1) await redis.expire(rateKey(identifier), RATE_TTL_SEC)
    if (count > MAX_REQUESTS) {
        throw new RateLimitError('OTP_RATE_LIMITED', 'Too many OTP requests, try again later')
    }

    const code = generateCode()
    await redis.setex(otpKey(identifier), OTP_TTL_SEC, JSON.stringify({ code, attempts: 0 } satisfies OtpData))

    if (type === 'email') {
        await sendOtpEmail(identifier, code)
    } else {
        // SMS фаза 2 — SMS.ru
        logger.warn({ identifier }, 'SMS OTP not implemented yet')
        if (config.NODE_ENV !== 'production') {
            logger.info({ code }, 'DEV: OTP code for phone')
        }
    }
}

export async function checkOtp(identifier: string, code: string): Promise<boolean> {
    const key = otpKey(identifier)
    const raw = await redis.get(key)
    if (!raw) return false

    const data = JSON.parse(raw) as OtpData
    data.attempts++

    if (data.attempts >= MAX_ATTEMPTS) {
        await redis.del(key)
        return false
    }

    if (data.code !== code) {
        await redis.setex(key, OTP_TTL_SEC, JSON.stringify(data))
        return false
    }

    await redis.del(key)
    return true
}
