import { NotFoundError } from '../../core/errors.js'
import { type AnalysisRepository } from '../analysis/repository.js'
import { type QuestionnaireRepository } from '../questionnaire/repository.js'
import { type UsersRepository } from '../auth/repository.js'
import { type ProfileService } from '../profile/service.js'
import { type AdminRepository } from './repository.js'
import { buildProfilePdf } from './pdf.js'
import type { SearchUsersQuery, UserDetail } from './schemas.js'

export class AdminService {
    constructor(
        private adminRepo: AdminRepository,
        private usersRepo: UsersRepository,
        private analysisRepo: AnalysisRepository,
        private questionnaireRepo: QuestionnaireRepository,
        private profileService: ProfileService
    ) {}

    async searchUsers(params: SearchUsersQuery) {
        const { total, rows } = await this.adminRepo.searchUsers({
            query: params.q,
            limit: params.limit,
            offset: params.offset,
        })
        return { total, limit: params.limit, offset: params.offset, users: rows }
    }

    /** Полная карточка: профиль + анализы с маркерами + анкета + рекомендации. */
    async getUserDetail(userId: string): Promise<UserDetail> {
        const user = await this.usersRepo.findByIdPublic(userId)
        if (!user) throw new NotFoundError('USER_NOT_FOUND', 'User not found')

        const [analysesList, questionnaire, recommendations] = await Promise.all([
            this.analysisRepo.findAllByUser(userId),
            this.questionnaireRepo.findLatestByUser(userId),
            this.profileService.getRecommendations(userId),
        ])

        // Маркеры всех анализов одним запросом (без N+1 по каждому анализу)
        const markersByAnalysis = await this.analysisRepo.findMarkersByAnalysisIds(
            analysesList.map((a) => a.id)
        )

        const analyses = analysesList.map((a) => {
            const markers = markersByAnalysis.get(a.id) ?? []
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
                    valueText: m.valueText,
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
        const qRow = await this.questionnaireRepo.findLatestByUser(userId)
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
