import { redis } from '../../core/redis.js'
import logger from '../../core/logger.js'
import { RateLimitError, NotFoundError } from '../../core/errors.js'
import { type UsersRepository } from '../auth/repository.js'
import { type LeadRepository, SETTING_LEAD_EMAIL } from './repository.js'

const LEAD_RATE_TTL_SEC = 24 * 60 * 60
const MAX_LEADS_PER_DAY = 3

const rateKey = (userId: string) => `lead_rate:${userId}`

// Порт доставки уведомления — реализация в core/mailer.ts (решение 027)
export interface LeadMailerPort {
    sendLeadEmail(input: {
        to: string
        user: { firstName: string; lastName: string; email: string | null; phone: string | null }
        message: string | null
    }): Promise<void>
}

export class LeadService {
    constructor(
        private repo: LeadRepository,
        private users: UsersRepository,
        private mailer: LeadMailerPort
    ) {}

    async submitConsultationLead(userId: string, message?: string): Promise<void> {
        const count = await redis.incr(rateKey(userId))
        if (count === 1) await redis.expire(rateKey(userId), LEAD_RATE_TTL_SEC)
        if (count > MAX_LEADS_PER_DAY) {
            throw new RateLimitError(
                'LEAD_RATE_LIMITED',
                'Заявка уже отправлена — нутрициолог свяжется с вами'
            )
        }

        const user = await this.users.findById(userId)
        if (!user) throw new NotFoundError('USER_NOT_FOUND', 'User not found')

        const lead = await this.repo.create(userId, message?.trim() || null)

        // Письмо — best-effort: лид уже в БД и виден в админке,
        // упавший SMTP не должен превращаться в 500 для клиента.
        const to = await this.repo.getSetting(SETTING_LEAD_EMAIL)
        if (!to) {
            logger.info({ leadId: lead.id }, 'lead saved, notification email not configured')
            return
        }
        try {
            await this.mailer.sendLeadEmail({
                to,
                user: {
                    firstName: user.firstName,
                    lastName: user.lastName,
                    email: user.email,
                    phone: user.phone,
                },
                message: lead.message,
            })
        } catch (err) {
            logger.error({ err, leadId: lead.id }, 'lead notification email failed')
        }
    }
}
