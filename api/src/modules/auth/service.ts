import { sendOtp, checkOtp, peekOtp } from './strategies/emailOtp.js'
import { type UsersRepository } from './repository.js'
import { OtpInvalidError, UserNeedsRegistrationError, UserAlreadyExistsError } from './errors.js'
import { ConflictError, PG_UNIQUE_VIOLATION } from '../../core/errors.js'
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

        const phone = data.phone.trim()
        const phoneTaken = await this.repo.findByPhone(phone)
        if (phoneTaken) throw new ConflictError('PHONE_TAKEN', 'Этот телефон уже используется')

        const valid = await checkOtp(email, data.code)
        if (!valid) throw new OtpInvalidError()

        // Гонка двух параллельных register с одним email: find-then-create
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

        await this.repo.setEmailVerified(user.id)
        return { id: user.id, email: user.email ?? null }
    }
}
