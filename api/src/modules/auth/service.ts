import { issueOtp, checkOtp, peekOtp } from './strategies/otp.js'
import { type UsersRepository } from './repository.js'
import { OtpInvalidError, UserNeedsRegistrationError, UserAlreadyExistsError } from './errors.js'
import { ConflictError, PG_UNIQUE_VIOLATION } from '../../core/errors.js'
import { sendOtpEmail } from '../../core/mailer.js'
import { type SmsPort } from '../../core/sms/index.js'
import { type RequestOtpBody, type VerifyOtpBody, type RegisterBody } from './schemas.js'

type ChannelInput = { channel: 'email'; email: string } | { channel: 'phone'; phone: string }

export class AuthService {
    // SmsPort — через конструктор (решение 027), создаётся в composition root
    constructor(
        private repo: UsersRepository,
        private sms: SmsPort
    ) {}

    // Разворачивает union-канал в единый вид: ключ OTP в Redis, способ
    // доставки кода и поиск пользователя по идентификатору канала.
    private resolveChannel(data: ChannelInput) {
        if (data.channel === 'email') {
            const email = data.email.toLowerCase()
            return {
                key: `email:${email}`,
                deliver: (code: string) => sendOtpEmail(email, code),
                find: () => this.repo.findByEmail(email),
            }
        }
        const phone = data.phone // уже нормализован в E.164 (PhoneRuSchema)
        return {
            key: `phone:${phone}`,
            deliver: (code: string) =>
                this.sms.send(phone, `Ваш код: ${code}. Никому не сообщайте его.`),
            find: () => this.repo.findByPhone(phone),
        }
    }

    async requestOtp(data: RequestOtpBody): Promise<{ isNewUser: boolean }> {
        const ch = this.resolveChannel(data)
        const existing = await ch.find()
        await issueOtp(ch.key, ch.deliver)
        return { isNewUser: !existing }
    }

    async verifyOtp(data: VerifyOtpBody): Promise<{ id: string; email: string | null }> {
        const ch = this.resolveChannel(data)
        const user = await ch.find()

        if (!user) {
            // Проверяем код не сжигая его — пользователь должен пойти на /register
            const valid = await peekOtp(ch.key, data.code)
            if (!valid) throw new OtpInvalidError()
            throw new UserNeedsRegistrationError()
        }

        const valid = await checkOtp(ch.key, data.code)
        if (!valid) throw new OtpInvalidError()

        if (data.channel === 'email') await this.repo.setEmailVerified(user.id)
        else await this.repo.setPhoneVerified(user.id)

        return { id: user.id, email: user.email ?? null }
    }

    async register(data: RegisterBody): Promise<{ id: string; email: string | null }> {
        const email = 'email' in data && data.email ? data.email.toLowerCase() : null
        const phone = 'phone' in data && data.phone ? data.phone : null

        // Уникальность по обоим идентификаторам, какие присутствуют
        if (email) {
            const existing = await this.repo.findByEmail(email)
            if (existing) throw new UserAlreadyExistsError()
        }
        if (phone) {
            const phoneTaken = await this.repo.findByPhone(phone)
            if (phoneTaken) throw new ConflictError('PHONE_TAKEN', 'Этот телефон уже используется')
        }

        const ch = this.resolveChannel(data)
        const valid = await checkOtp(ch.key, data.code)
        if (!valid) throw new OtpInvalidError()

        // Гонка двух параллельных register с одним идентификатором: find-then-create
        // не атомарен, ловим 23505 вместо 500
        const user = await this.repo
            .create({
                email,
                phone,
                firstName: data.firstName,
                lastName: data.lastName,
                consentPd: data.consentPd,
                consentMedicalData: data.consentMedicalData,
            })
            .catch((err: unknown) => {
                if (
                    err &&
                    typeof err === 'object' &&
                    'code' in err &&
                    err.code === PG_UNIQUE_VIOLATION
                ) {
                    throw new UserAlreadyExistsError()
                }
                throw err
            })

        // Верифицирован только тот канал, по которому пришёл код
        if (data.channel === 'email') await this.repo.setEmailVerified(user.id)
        else await this.repo.setPhoneVerified(user.id)

        return { id: user.id, email: user.email ?? null }
    }
}
