import { sendOtp, checkOtp } from './strategies/emailOtp.js'
import { type UsersRepository } from './repository.js'
import { OtpInvalidError, RegistrationIncompleteError } from './errors.js'
import { type RequestOtpBody, type VerifyOtpBody } from './schemas.js'

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

        const valid = await checkOtp(email, data.code)
        if (!valid) throw new OtpInvalidError()

        let user = await this.repo.findByEmail(email)

        if (!user) {
            if (!data.firstName || !data.lastName || !data.consentPd) {
                throw new RegistrationIncompleteError()
            }
            user = await this.repo.create({
                email,
                firstName: data.firstName,
                lastName: data.lastName,
                consentPd: data.consentPd,
            })
        }

        await this.repo.setEmailVerified(user.id)

        return { id: user.id, email: user.email ?? null }
    }
}
