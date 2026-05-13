import { sendOtp, checkOtp, peekOtp } from './strategies/emailOtp.js'
import { type UsersRepository } from './repository.js'
import { OtpInvalidError, UserNeedsRegistrationError, UserAlreadyExistsError } from './errors.js'
import { type RequestOtpBody, type VerifyOtpBody, type RegisterBody } from './schemas.js'

export class AuthService {
    constructor(private repo: UsersRepository) {}

    async requestOtp(data: RequestOtpBody): Promise<{ isNewUser: boolean }> {
        const email = data.email.toLowerCase()
        const existing = await this.repo.findByEmail(email)
        await sendOtp(email)
        return { isNewUser: !existing }
    }

    async verifyOtp(data: VerifyOtpBody): Promise<{ id: string; email: string | null }> {
        const email = data.email.toLowerCase()

        const user = await this.repo.findByEmail(email)

        if (!user) {
            // Проверяем код не сжигая его — пользователь должен пойти на /register
            const valid = await peekOtp(email, data.code)
            if (!valid) throw new OtpInvalidError()
            throw new UserNeedsRegistrationError()
        }

        const valid = await checkOtp(email, data.code)
        if (!valid) throw new OtpInvalidError()

        await this.repo.setEmailVerified(user.id)
        return { id: user.id, email: user.email ?? null }
    }

    async register(data: RegisterBody): Promise<{ id: string; email: string | null }> {
        const email = data.email.toLowerCase()

        const existing = await this.repo.findByEmail(email)
        if (existing) throw new UserAlreadyExistsError()

        const valid = await checkOtp(email, data.code)
        if (!valid) throw new OtpInvalidError()

        const user = await this.repo.create({
            email,
            firstName: data.firstName,
            lastName: data.lastName,
            consentPd: data.consentPd,
        })

        await this.repo.setEmailVerified(user.id)
        return { id: user.id, email: user.email ?? null }
    }
}
