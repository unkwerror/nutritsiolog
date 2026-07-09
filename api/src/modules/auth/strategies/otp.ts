import { redis } from '../../../core/redis.js'
import { RateLimitError } from '../../../core/errors.js'

// Общая OTP-механика для любого канала (email / SMS): генерация, лимиты,
// проверка. Идентификатор — opaque-ключ вида `email:{addr}` / `phone:{+7…}`,
// доставку кода выполняет переданный колбэк (решение 027: канал — зависимость).

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

export async function issueOtp(
    id: string,
    deliver: (code: string) => Promise<void>
): Promise<void> {
    const count = await redis.incr(rateKey(id))
    if (count === 1) await redis.expire(rateKey(id), RATE_TTL_SEC)
    if (count > MAX_REQUESTS) {
        throw new RateLimitError('OTP_RATE_LIMITED', 'Too many OTP requests, try again later')
    }

    const code = generateCode()
    // Новый код обнуляет счётчик попыток
    await redis.del(attemptsKey(id))
    await redis.setex(otpKey(id), OTP_TTL_SEC, code)

    await deliver(code)
}

// Атомарный учёт попыток через INCR: параллельные verify-запросы не могут
// обойти лимит (раньше read-modify-write через GET/SETEX давал гонку),
// а TTL кода при неудачной попытке больше не продлевается.
async function registerAttempt(id: string): Promise<boolean> {
    const attempts = await redis.incr(attemptsKey(id))
    if (attempts === 1) await redis.expire(attemptsKey(id), OTP_TTL_SEC)
    if (attempts > MAX_ATTEMPTS) {
        await redis.del(otpKey(id))
        return false
    }
    return true
}

// Проверяет код и удаляет его (финальное потребление)
export async function checkOtp(id: string, code: string): Promise<boolean> {
    if (!(await registerAttempt(id))) return false

    const stored = await redis.get(otpKey(id))
    if (stored === null) return false

    if (stored === code) {
        await redis.del(otpKey(id), attemptsKey(id))
        return true
    }
    return false
}

// Проверяет код без удаления — для verify-otp у незарегистрированных юзеров
export async function peekOtp(id: string, code: string): Promise<boolean> {
    if (!(await registerAttempt(id))) return false

    const stored = await redis.get(otpKey(id))
    return stored !== null && stored === code
}
