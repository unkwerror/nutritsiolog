import { UnauthorizedError, ValidationError } from '../../core/errors.js'

export class OtpInvalidError extends UnauthorizedError {
    constructor() { super('OTP_INVALID', 'Invalid or expired code') }
}

export class RegistrationIncompleteError extends ValidationError {
    constructor() {
        super('AUTH_REGISTRATION_INCOMPLETE', 'firstName, lastName and consentPd are required for new users')
    }
}
