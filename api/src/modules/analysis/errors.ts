import { NotFoundError, ValidationError } from '../../core/errors.js'

export class AnalysisNotFoundError extends NotFoundError {
    constructor() { super('ANALYSIS_NOT_FOUND') }
}

export class NothingUploadedError extends ValidationError {
    constructor() { super('ANALYSIS_NOTHING_UPLOADED', 'No files uploaded') }
}
