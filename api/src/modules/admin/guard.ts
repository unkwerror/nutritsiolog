import { type FastifyRequest, type FastifyReply } from 'fastify'
import { config } from '../../core/config.js'
import { ForbiddenError } from '../../core/errors.js'

/**
 * Доступ к админке привязан к почте (решение «привязка админских экранов к почте»).
 * Список разрешённых email'ов — в config.ADMIN_EMAILS (ENV ADMIN_EMAILS, через запятую).
 */
export function isAdminEmail(email: string | null | undefined): boolean {
    if (!email) return false
    return config.ADMIN_EMAILS.includes(email.toLowerCase())
}

/**
 * preHandler, который ставится ПОСЛЕ fastify.authenticate.
 * authenticate уже положил request.user из JWT (там есть email) — лишнего запроса в БД нет.
 * Не админ → 403 (доменная ошибка, errorHandler отдаст единый формат).
 */
export async function requireAdmin(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
    if (!isAdminEmail(request.user?.email)) {
        throw new ForbiddenError('ADMIN_FORBIDDEN', 'Admin access required')
    }
}
