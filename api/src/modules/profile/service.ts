import { AnalysisRepository } from '../analysis/repository.js'
import { QuestionnaireRepository } from '../questionnaire/repository.js'
import { generateSignals, type Signal } from './rules.js'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'

type DB = PostgresJsDatabase

export class ProfileService {
    constructor(private db: DB) {}

    async getRecommendations(userId: string): Promise<{
        signals: Signal[]
        hasQuestionnaire: boolean
        hasAnalyses: boolean
    }> {
        const analysisRepo = new AnalysisRepository(this.db)
        const questionnaireRepo = new QuestionnaireRepository(this.db)

        const [analysisList, questionnaire] = await Promise.all([
            analysisRepo.findAllByUser(userId),
            questionnaireRepo.findLatestByUser(userId),
        ])

        const doneAnalyses = analysisList.filter((a) => a.status === 'done')

        // Collect all markers from done analyses
        const allMarkers: Array<{
            code: string | null
            name: string
            value: string | null
            isOutOfRange: boolean
            outOfRangeDirection: 'low' | 'high' | null
        }> = []

        for (const analysis of doneAnalyses) {
            const markers = await analysisRepo.findMarkersByAnalysisId(analysis.id)
            for (const m of markers) {
                allMarkers.push({
                    code: m.code,
                    name: m.name,
                    value: m.value,
                    isOutOfRange: m.isOutOfRange,
                    outOfRangeDirection: m.outOfRangeDirection as 'low' | 'high' | null,
                })
            }
        }

        const tags = questionnaire ? (questionnaire.tags as string[]) : []
        const answers = questionnaire?.answers as { gender?: string } | null
        const gender = (answers?.gender as 'male' | 'female' | null) ?? null

        const signals = generateSignals(allMarkers, tags, gender)

        return {
            signals,
            hasQuestionnaire: !!questionnaire,
            hasAnalyses: doneAnalyses.length > 0,
        }
    }
}
