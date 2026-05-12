export class AppError extends Error {
    constructor(
        public readonly code: string,
        public readonly statusCode: number,
        message: string,
        public readonly details?: unknown
    ) {
        super(message)
        this.name = this.constructor.name
    }
}

export class ValidationError extends AppError {
    constructor(code: string, message = 'Validation failed', details?: unknown) {
        super(code, 400, message, details)
    }
}

export class UnauthorizedError extends AppError {
    constructor(code: string, message = 'Unauthorized') {
        super(code, 401, message)
    }
}

export class ForbiddenError extends AppError {
    constructor(code: string, message = 'Forbidden') {
        super(code, 403, message)
    }
}

export class NotFoundError extends AppError {
    constructor(code: string, message = 'Not found') {
        super(code, 404, message)
    }
}

export class ConflictError extends AppError {
    constructor(code: string, message = 'Conflict') {
        super(code, 409, message)
    }
}

export class RateLimitError extends AppError {
    constructor(code: string, message = 'Too many requests') {
        super(code, 429, message)
    }
}

export const PG_UNIQUE_VIOLATION = '23505'
