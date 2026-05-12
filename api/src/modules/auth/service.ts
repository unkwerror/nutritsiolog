import { sendOtp, checkOtp }                            from './otp.js'
import { type UsersRepository }                         from './repository.js'
import { OtpInvalidError, RegistrationIncompleteError } from './errors.js'
import { type RequestOtpBody, type VerifyOtpBody }      from './schemas.js'

function normalizeIdentifier(email?: string, phone?: string): { identifier: string; type: 'email' | 'phone' } {
    if (email) return { identifier: email.toLowerCase(), type: 'email' }
    return { identifier: phone!.replace(/[^\d+]/g, ''), type: 'phone' }
}

export class AuthService {
    constructor(private repo: UsersRepository) {}

    async requestOtp(data: RequestOtpBody): Promise<{ isNewUser: boolean }> {
        const { identifier, type } = normalizeIdentifier(data.email, data.phone)

        const existing = type === 'email'
            ? await this.repo.findByEmail(identifier)
            : await this.repo.findByPhone(identifier)

        await sendOtp(identifier, type)

        return { isNewUser: !existing }
    }

    async verifyOtp(data: VerifyOtpBody): Promise<{ id: string; email: string | null }> {
        const { identifier, type } = normalizeIdentifier(data.email, data.phone)

        const valid = await checkOtp(identifier, data.code)
        if (!valid) throw new OtpInvalidError()

        let user = type === 'email'
            ? await this.repo.findByEmail(identifier)
            : await this.repo.findByPhone(identifier)

        if (!user) {
            if (!data.firstName || !data.lastName || !data.consentPd) {
                throw new RegistrationIncompleteError()
            }
            user = await this.repo.create({
                email:     type === 'email' ? identifier : undefined,
                phone:     type === 'phone' ? identifier : undefined,
                firstName: data.firstName,
                lastName:  data.lastName,
                consentPd: data.consentPd,
            })
        }

        if (type === 'email') {
            await this.repo.setEmailVerified(user.id)
        } else {
            await this.repo.setPhoneVerified(user.id)
        }

        return { id: user.id, email: user.email ?? null }
    }
}
