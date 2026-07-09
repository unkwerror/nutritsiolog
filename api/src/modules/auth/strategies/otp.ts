import { redis } from '../../../core/redis.js'
import { sendOtpEmail } from '../../../core/mailer.js'
import { RateLimitError } from '../../../core/errors.js'

const OTP_TTL_SEC = 10 * 60
const RATE_TTL_SEC = 15 * 60
const MAX_REQUESTS = 3
const MAX_ATTEMPTS = 5

function generateCode(): string {
    return String(Math.floor(100000 + Math.random() * 900000))
}

const otpKey = (id: string) => `otp:${id}`
const rateKey = (id: string) => `otp_rate:${id}`
const attemptsKey = (id: string) => `otp_attempts:${id}`

export async function sendOtp(email: string): Promise<void> {
    const count = await redis.incr(rateKey(email))
    if (count === 1) await redis.expire(rateKey(email), RATE_TTL_SEC)
    if (count > MAX_REQUESTS) {
        throw new RateLimitError('OTP_RATE_LIMITED', 'Too many OTP requests, try again later')
    }

    const code = generateCode()
    // Новый код обнуляет счётчик попыток
    await redis.del(attemptsKey(email))
    await redis.setex(otpKey(email), OTP_TTL_SEC, code)

    await sendOtpEmail(email, code)
}

// Атомарный учёт попыток через INCR: параллельные verify-запросы не могут
// обойти лимит (раньше read-modify-write через GET/SETEX давал гонку),
// а TTL кода при неудачной попытке больше не продлевается.
async function registerAttempt(email: string): Promise<boolean> {
    const attempts = await redis.incr(attemptsKey(email))
    if (attempts === 1) await redis.expire(attemptsKey(email), OTP_TTL_SEC)
    if (attempts > MAX_ATTEMPTS) {
        await redis.del(otpKey(email))
        return false
    }
    return true
}

// Проверяет код и удаляет его (финальное потребление)
export async function checkOtp(email: string, code: string): Promise<boolean> {
    if (!(await registerAttempt(email))) return false

    const stored = await redis.get(otpKey(email))
    if (stored === null) return false

    if (stored === code) {
        await redis.del(otpKey(email), attemptsKey(email))
        return true
    }
    return false
}

// Проверяет код без удаления — для verify-otp у незарегистрированных юзеров
export async function peekOtp(email: string, code: string): Promise<boolean> {
    if (!(await registerAttempt(email))) return false

    const stored = await redis.get(otpKey(email))
    return stored !== null && stored === code
}
