import { QuestionnaireRepository } from './repository.js'
import { computeTags } from './tags.js'
import { QuestionnaireAnswersSchema } from './schemas.js'
import { ValidationError } from '../../core/errors.js'

export class QuestionnaireService {
    constructor(private repo: QuestionnaireRepository) {}

    async submit(userId: string, rawAnswers: unknown) {
        const parsed = QuestionnaireAnswersSchema.safeParse(rawAnswers)
        if (!parsed.success) {
            throw new ValidationError('INVALID_ANSWERS', 'Invalid questionnaire answers')
        }
        const answers = parsed.data
        const tags = computeTags(answers)
        return this.repo.upsert(userId, answers, tags)
    }

    async getMyLatest(userId: string) {
        return this.repo.findLatestByUser(userId)
    }
}
