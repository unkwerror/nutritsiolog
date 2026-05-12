import { eq, and }                from 'drizzle-orm'
import { type PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import { analyses }                from '../../db/schema.js'

type DB      = PostgresJsDatabase
type NewAnalysis = {
    userId:           string
    fileKey:          string
    fileOriginalName: string
    fileMimeType:     string
    fileSize:         number
}

export class AnalysisRepository {
    constructor(private db: DB) {}

    async insert(data: NewAnalysis) {
        const [analysis] = await this.db.insert(analyses).values({
            ...data,
            status: 'pending'
        }).returning()
        if (!analysis) throw new Error('Insert returned no rows')
        return analysis
    }

    async findByIdAndUser(id: number, userId: string) {
        const [analysis] = await this.db
            .select()
            .from(analyses)
            .where(and(eq(analyses.id, id), eq(analyses.userId, userId)))
        return analysis ?? null
    }
}
