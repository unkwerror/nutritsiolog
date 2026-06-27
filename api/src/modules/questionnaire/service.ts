import { QuestionnaireRepository } from './repository.js'
import { UsersRepository } from '../auth/repository.js'
import { computeTags } from './tags.js'
import { QuestionnaireAnswersSchema } from './schemas.js'
import { ValidationError } from '../../core/errors.js'

export class QuestionnaireService {
    constructor(
        private repo: QuestionnaireRepository,
        private users: UsersRepository
    ) {}

    async submit(userId: string, rawAnswers: unknown) {
        const parsed = QuestionnaireAnswersSchema.safeParse(rawAnswers)
        if (!parsed.success) {
            throw new ValidationError('INVALID_ANSWERS', 'Invalid questionnaire answers')
        }
        const answers = parsed.data
        const tags = computeTags(answers)
        const saved = await this.repo.upsert(userId, answers, tags)
        // Подтягиваем поля идентичности, которые собирает анкета, в профиль —
        // чтобы экран профиля отражал пол и дату рождения из анкеты.
        await this.users.updateProfile(userId, {
            gender: answers.gender,
            dateOfBirth: answers.dateOfBirth,
        })
        return saved
    }

    async getMyLatest(userId: string) {
        return this.repo.findLatestByUser(userId)
    }
}
