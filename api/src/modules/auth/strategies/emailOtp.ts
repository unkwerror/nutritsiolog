import { redis } from '../../../core/redis.js'
import { sendOtpEmail } from '../../../core/mailer.js'
import { RateLimitError } from '../../../core/errors.js'

const OTP_TTL_SEC = 10 * 60
const RATE_TTL_SEC = 15 * 60
const MAX_REQUESTS = 3
const MAX_ATTEMPTS = 5

type OtpData = { code: string; attempts: number }

function generateCode(): string {
    return String(Math.floor(100000 + Math.random() * 900000))
}

const otpKey = (id: string) => `otp:${id}`
const rateKey = (id: string) => `otp_rate:${id}`

export async function sendOtp(email: string): Promise<void> {
    const count = await redis.incr(rateKey(email))
    if (count === 1) await redis.expire(rateKey(email), RATE_TTL_SEC)
    if (count > MAX_REQUESTS) {
        throw new RateLimitError('OTP_RATE_LIMITED', 'Too many OTP requests, try again later')
    }

    const code = generateCode()
    await redis.setex(
        otpKey(email),
        OTP_TTL_SEC,
        JSON.stringify({ code, attempts: 0 } satisfies OtpData)
    )

    await sendOtpEmail(email, code)
}

export async function checkOtp(email: string, code: string): Promise<boolean> {
    const key = otpKey(email)
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
