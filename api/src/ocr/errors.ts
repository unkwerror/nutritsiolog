export class OcrProviderError extends Error {
    constructor(message: string, public readonly statusCode?: number) {
        super(message)
        this.name = 'OcrProviderError'
    }
}

export class OcrValidationError extends Error {
    constructor(message: string) {
        super(message)
        this.name = 'OcrValidationError'
    }
}

export class OcrTimeoutError extends Error {
    constructor(message: string) {
        super(message)
        this.name = 'OcrTimeoutError'
    }
}
