import { type PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import { NotFoundError } from '../../core/errors.js'
import { AnalysisRepository } from '../analysis/repository.js'
import { QuestionnaireRepository } from '../questionnaire/repository.js'
import { UsersRepository } from '../auth/repository.js'
import { ProfileService } from '../profile/service.js'
import { AdminRepository } from './repository.js'
import { buildProfilePdf } from './pdf.js'
import type { SearchUsersQuery, UserDetail } from './schemas.js'

type DB = PostgresJsDatabase

export class AdminService {
    constructor(private db: DB) {}

    async searchUsers(params: SearchUsersQuery) {
        const repo = new AdminRepository(this.db)
        const { total, rows } = await repo.searchUsers({
            query: params.q,
            limit: params.limit,
            offset: params.offset,
        })
        return { total, limit: params.limit, offset: params.offset, users: rows }
    }

    /** Полная карточка: профиль + анализы с маркерами + анкета + рекомендации. */
    async getUserDetail(userId: string): Promise<UserDetail> {
        const user = await new UsersRepository(this.db).findByIdPublic(userId)
        if (!user) throw new NotFoundError('USER_NOT_FOUND', 'User not found')

        const analysisRepo = new AnalysisRepository(this.db)
        const [analysesList, questionnaire, recommendations] = await Promise.all([
            analysisRepo.findAllByUser(userId),
            new QuestionnaireRepository(this.db).findLatestByUser(userId),
            new ProfileService(this.db).getRecommendations(userId),
        ])

        const analyses = await Promise.all(
            analysesList.map(async (a) => {
                const markers = await analysisRepo.findMarkersByAnalysisId(a.id)
                return {
                    id: a.id,
                    status: a.status,
                    detectedTypes: a.detectedTypes,
                    labName: a.labName,
                    createdAt: a.createdAt,
                    markers: markers.map((m) => ({
                        id: m.id,
                        name: m.name,
                        code: m.code,
                        section: m.section,
                        value: m.value,
                        unit: m.unit,
                        referenceRaw: m.referenceRaw,
                        isOutOfRange: m.isOutOfRange,
                        outOfRangeDirection: m.outOfRangeDirection,
                        isEdited: m.isEdited,
                        comment: m.comment,
                        method: m.method,
                    })),
                }
            })
        )

        return {
            user,
            analyses,
            questionnaire: questionnaire
                ? { tags: questionnaire.tags as string[], createdAt: questionnaire.createdAt }
                : null,
            recommendations,
        }
    }

    async getProfilePdf(userId: string): Promise<{ buffer: Buffer; fileName: string }> {
        const detail = await this.getUserDetail(userId)
        const qRow = await new QuestionnaireRepository(this.db).findLatestByUser(userId)
        const answers =
            qRow && typeof qRow.answers === 'object' && qRow.answers !== null
                ? (qRow.answers as Record<string, unknown>)
                : null
        const buffer = await buildProfilePdf(detail, answers)
        const slug = [detail.user.lastName, detail.user.firstName]
            .filter(Boolean)
            .join('_')
            .replace(/[^\p{L}\p{N}_-]/gu, '')
        return { buffer, fileName: `profile_${slug || detail.user.id}.pdf` }
    }
}
