import { UnauthorizedError, NotFoundError, ConflictError } from '../../core/errors.js'

export class OtpInvalidError extends UnauthorizedError {
    constructor() {
        super('OTP_INVALID', 'Invalid or expired code')
    }
}

export class UserNeedsRegistrationError extends NotFoundError {
    constructor() {
        super('USER_NEEDS_REGISTRATION', 'User not found, please register')
    }
}

export class UserAlreadyExistsError extends ConflictError {
    constructor() {
        super('AUTH_USER_ALREADY_EXISTS', 'User already registered, use verify-otp to sign in')
    }
}
