import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm'
import { type PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import { analyses, questionnaireResponses, users } from '../../db/schema.js'

type DB = PostgresJsDatabase

// Экранируем спецсимволы LIKE, чтобы '%'/'_' в запросе искались буквально
// (escape по умолчанию в Postgres — обратный слэш).
function escapeLike(term: string): string {
    return term.replace(/[%_\\]/g, (c) => `\\${c}`)
}

export class AdminRepository {
    constructor(private db: DB) {}

    // Файл анализа по id (без фильтра по пользователю — доступ только у админа).
    async findAnalysisFile(id: number) {
        const [row] = await this.db
            .select({ fileKey: analyses.fileKey, fileMimeType: analyses.fileMimeType })
            .from(analyses)
            .where(eq(analyses.id, id))
        return row ?? null
    }

    /**
     * Поиск по почте, имени, фамилии, отчеству. Несколько слов — каждое должно
     * найтись в «стоге» (ФИО + email), поэтому "иван петров" найдёт Иван Петров.
     *
     * Счётчики (анализы, наличие анкеты) считаем отдельными сгруппированными
     * запросами по найденным id и склеиваем в JS — коррелированные подзапросы в
     * raw sql небезопасны: drizzle подставляет колонки без префикса таблицы.
     */
    async searchUsers(params: { query?: string; limit: number; offset: number }) {
        const { query, limit, offset } = params

        // Внутри одной таблицы users неуточнённые имена колонок однозначны.
        const haystack = sql`(
            coalesce(${users.firstName}, '') || ' ' ||
            coalesce(${users.lastName}, '')  || ' ' ||
            coalesce(${users.middleName}, '')|| ' ' ||
            coalesce(${users.email}, '')
        )`

        const terms = (query ?? '').split(/\s+/).filter(Boolean)
        const filters = [isNull(users.deletedAt)]
        for (const t of terms) {
            filters.push(sql`${haystack} ilike ${`%${escapeLike(t)}%`}`)
        }
        const where = and(...filters)

        const [countRow] = await this.db
            .select({ count: sql<number>`count(*)::int` })
            .from(users)
            .where(where)
        const total = countRow?.count ?? 0

        const rows = await this.db
            .select({
                id: users.id,
                firstName: users.firstName,
                lastName: users.lastName,
                middleName: users.middleName,
                email: users.email,
                phone: users.phone,
                gender: users.gender,
                createdAt: users.createdAt,
            })
            .from(users)
            .where(where)
            .orderBy(desc(users.createdAt))
            .limit(limit)
            .offset(offset)

        if (rows.length === 0) return { total, rows: [] }

        const ids = rows.map((r) => r.id)

        const counts = await this.db
            .select({ userId: analyses.userId, count: sql<number>`count(*)::int` })
            .from(analyses)
            .where(and(inArray(analyses.userId, ids), eq(analyses.isArchived, false)))
            .groupBy(analyses.userId)
        const countByUser = new Map(counts.map((c) => [c.userId, c.count]))

        const withQuestionnaire = await this.db
            .selectDistinct({ userId: questionnaireResponses.userId })
            .from(questionnaireResponses)
            .where(inArray(questionnaireResponses.userId, ids))
        const questionnaireUsers = new Set(withQuestionnaire.map((r) => r.userId))

        return {
            total,
            rows: rows.map((r) => ({
                ...r,
                analysesCount: countByUser.get(r.id) ?? 0,
                hasQuestionnaire: questionnaireUsers.has(r.id),
            })),
        }
    }
}
