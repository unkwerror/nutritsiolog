import { eq, desc, sql } from 'drizzle-orm'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import { leads, appSettings, users } from '../../db/schema.js'

type DB = PostgresJsDatabase

// Ключи app_settings — константы, чтобы не расползались строки по коду
export const SETTING_LEAD_EMAIL = 'lead_notification_email'

export class LeadRepository {
    constructor(private db: DB) {}

    async create(userId: string, message: string | null) {
        const [row] = await this.db.insert(leads).values({ userId, message }).returning()
        if (!row) throw new Error('Insert returned no rows')
        return row
    }

    // Для админки: лиды с контактами пользователя, свежие сверху
    async findAllWithUser(limit = 100) {
        return this.db
            .select({
                id: leads.id,
                message: leads.message,
                processedAt: leads.processedAt,
                createdAt: leads.createdAt,
                userId: users.id,
                firstName: users.firstName,
                lastName: users.lastName,
                email: users.email,
                phone: users.phone,
            })
            .from(leads)
            .innerJoin(users, eq(leads.userId, users.id))
            .orderBy(desc(leads.createdAt))
            .limit(limit)
    }

    async setProcessed(id: number, processed: boolean) {
        const [row] = await this.db
            .update(leads)
            .set({ processedAt: processed ? new Date() : null })
            .where(eq(leads.id, id))
            .returning()
        return row ?? null
    }

    async getSetting(key: string): Promise<string | null> {
        const [row] = await this.db
            .select({ value: appSettings.value })
            .from(appSettings)
            .where(eq(appSettings.key, key))
            .limit(1)
        return row?.value ?? null
    }

    async setSetting(key: string, value: string): Promise<void> {
        await this.db
            .insert(appSettings)
            .values({ key, value })
            .onConflictDoUpdate({
                target: appSettings.key,
                set: { value, updatedAt: sql`now()` },
            })
    }
}
