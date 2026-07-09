import { eq, desc } from 'drizzle-orm'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import { questionnaireResponses } from '../../db/schema.js'
import type { QuestionnaireAnswers } from './schemas.js'

type DB = PostgresJsDatabase

export class QuestionnaireRepository {
    constructor(private db: DB) {}

    async upsert(userId: string, answers: QuestionnaireAnswers, tags: string[]) {
        const [row] = await this.db
            .insert(questionnaireResponses)
            .values({ userId, answers, tags })
            .returning()
        if (!row) throw new Error('Insert returned no rows')
        return row
    }

    async findLatestByUser(userId: string) {
        const [row] = await this.db
            .select()
            .from(questionnaireResponses)
            .where(eq(questionnaireResponses.userId, userId))
            .orderBy(desc(questionnaireResponses.createdAt))
            .limit(1)
        return row ?? null
    }

    // История заполнений без тяжёлого answers-jsonb — для динамики
    async findAllByUser(userId: string, limit = 50) {
        return this.db
            .select({
                id: questionnaireResponses.id,
                tags: questionnaireResponses.tags,
                createdAt: questionnaireResponses.createdAt,
            })
            .from(questionnaireResponses)
            .where(eq(questionnaireResponses.userId, userId))
            .orderBy(desc(questionnaireResponses.createdAt))
            .limit(limit)
    }
}
