import { z } from 'zod'
import { type FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { type PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import { AnalysisRepository } from '../analysis/repository.js'
import { QuestionnaireRepository } from '../questionnaire/repository.js'
import { UsersRepository } from '../auth/repository.js'
import { ProfileService } from '../profile/service.js'
import { AdminRepository } from './repository.js'
import { AdminService } from './service.js'
import { MinioStorage } from '../analysis/infrastructure/storage.js'
import { BullMQQueue } from '../analysis/infrastructure/queue.js'
import { requireAdmin } from './guard.js'
import { NotFoundError } from '../../core/errors.js'
import { SearchUsersQuery, SearchUsersResponse, UserDetailResponse } from './schemas.js'

const storage = new MinioStorage()
const queue = new BullMQQueue()

const IdParams = z.object({ id: z.uuid() })

// DI: сервис получает зависимости через конструктор (как AnalysisService в analysis/routes.ts)
function buildAdminService(db: PostgresJsDatabase) {
    return new AdminService(
        new AdminRepository(db),
        new UsersRepository(db),
        new AnalysisRepository(db),
        new QuestionnaireRepository(db),
        ProfileService.fromDb(db)
    )
}

const adminRoutes: FastifyPluginAsyncZod = async (fastify) => {
    const gate = { preHandler: [fastify.authenticate, requireAdmin] }

    // Проверка прав — фронт прячет/показывает админ-навигацию по этому ответу.
    fastify.get(
        '/admin/me',
        {
            ...gate,
            schema: {
                tags: ['Admin'],
                security: [{ bearerAuth: [] }],
                response: {
                    200: z.object({ email: z.string().nullable(), isAdmin: z.literal(true) }),
                },
            },
        },
        async (request, reply) => {
            return reply.send({ email: request.user.email, isAdmin: true })
        }
    )

    // Поиск по почте / имени / фамилии.
    fastify.get(
        '/admin/users',
        {
            ...gate,
            schema: {
                tags: ['Admin'],
                security: [{ bearerAuth: [] }],
                querystring: SearchUsersQuery,
                response: { 200: SearchUsersResponse },
            },
        },
        async (request, reply) => {
            const svc = buildAdminService(request.server.db)
            return reply.send(await svc.searchUsers(request.query))
        }
    )

    // Полная карточка пользователя: профиль + анализы + анкета + рекомендации.
    fastify.get(
        '/admin/users/:id',
        {
            ...gate,
            schema: {
                tags: ['Admin'],
                security: [{ bearerAuth: [] }],
                params: IdParams,
                response: { 200: UserDetailResponse },
            },
        },
        async (request, reply) => {
            const svc = buildAdminService(request.server.db)
            return reply.send(await svc.getUserDetail(request.params.id))
        }
    )

    // Выгрузка нутрициологического профиля пользователя в PDF.
    fastify.get(
        '/admin/users/:id/profile.pdf',
        {
            ...gate,
            schema: {
                tags: ['Admin'],
                security: [{ bearerAuth: [] }],
                params: IdParams,
                description: 'Скачать профиль пользователя в PDF',
            },
        },
        async (request, reply) => {
            const svc = buildAdminService(request.server.db)
            const { buffer, fileName } = await svc.getProfilePdf(request.params.id)
            // RFC 5987: имя файла может быть кириллическим — даём UTF-8 кодировку + ASCII-фоллбэк.
            const asciiFallback = fileName.replace(/[^\x20-\x7E]/g, '_')
            return reply
                .header('Content-Type', 'application/pdf')
                .header(
                    'Content-Disposition',
                    `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(fileName)}`
                )
                .send(buffer)
        }
    )

    // Исходный файл анализа любого пользователя (для визуального просмотра в консоли).
    fastify.get(
        '/admin/analyses/:id/file',
        {
            ...gate,
            schema: {
                tags: ['Admin'],
                security: [{ bearerAuth: [] }],
                params: z.object({ id: z.coerce.number().int().positive() }),
                description: 'Исходный файл анализа (PDF/JPEG/PNG) для просмотра в админке',
            },
        },
        async (request, reply) => {
            const repo = new AdminRepository(request.server.db)
            const file = await repo.findAnalysisFile(request.params.id)
            if (!file) throw new NotFoundError('ANALYSIS_NOT_FOUND', 'Анализ не найден')
            const buffer = await storage.getBuffer(file.fileKey)
            return reply
                .header('Content-Type', file.fileMimeType ?? 'application/octet-stream')
                .header('Content-Disposition', `inline; filename="analysis-${request.params.id}"`)
                .header('Cache-Control', 'private, max-age=60')
                .send(buffer)
        }
    )

    // Повторное распознавание анализа (только админ). Уводит текущие маркеры в
    // историю и заново ставит файл в OCR-очередь — чтобы подхватить улучшения
    // распознавания (например, текстовые поля) без повторной загрузки.
    fastify.post(
        '/admin/analyses/:id/reprocess',
        {
            ...gate,
            schema: {
                tags: ['Admin'],
                security: [{ bearerAuth: [] }],
                params: z.object({ id: z.coerce.number().int().positive() }),
                response: { 200: z.object({ analysisId: z.number(), status: z.string() }) },
            },
        },
        async (request, reply) => {
            const repo = new AdminRepository(request.server.db)
            const a = await repo.findAnalysisForReprocess(request.params.id)
            if (!a) throw new NotFoundError('ANALYSIS_NOT_FOUND', 'Анализ не найден')
            await repo.resetForReprocess(request.params.id)
            await queue.add({
                analysisId: request.params.id,
                fileKey: a.fileKey,
                mimeType: a.fileMimeType ?? 'application/pdf',
                analysisType: a.analysisType ?? undefined,
                ocrProvider: a.ocrProvider ?? undefined,
            })
            return reply.send({ analysisId: request.params.id, status: 'pending' })
        }
    )
}

export default adminRoutes
