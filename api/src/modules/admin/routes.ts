import { z } from 'zod'
import { type FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { AdminService } from './service.js'
import { requireAdmin } from './guard.js'
import { SearchUsersQuery, SearchUsersResponse, UserDetailResponse } from './schemas.js'

const IdParams = z.object({ id: z.uuid() })

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
            const svc = new AdminService(request.server.db)
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
            const svc = new AdminService(request.server.db)
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
            const svc = new AdminService(request.server.db)
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
}

export default adminRoutes
