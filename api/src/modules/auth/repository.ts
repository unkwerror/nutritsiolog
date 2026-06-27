import { eq } from 'drizzle-orm'
import { type PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import { users } from '../../db/schema.js'

type DB = PostgresJsDatabase
type NewUser = Pick<
    typeof users.$inferInsert,
    'email' | 'phone' | 'firstName' | 'lastName' | 'consentPd' | 'consentMedicalData'
>

export class UsersRepository {
    constructor(private db: DB) {}

    async findByEmail(email: string) {
        const [user] = await this.db.select().from(users).where(eq(users.email, email))
        return user ?? null
    }

    async findByPhone(phone: string) {
        const [user] = await this.db.select().from(users).where(eq(users.phone, phone))
        return user ?? null
    }

    async create(data: NewUser) {
        const [user] = await this.db.insert(users).values(data).returning()
        if (!user) throw new Error('Insert returned no rows')
        return user
    }

    async findById(id: string) {
        const [user] = await this.db.select().from(users).where(eq(users.id, id))
        return user ?? null
    }

    async findByIdPublic(id: string) {
        const [user] = await this.db
            .select({
                id: users.id,
                firstName: users.firstName,
                lastName: users.lastName,
                middleName: users.middleName,
                gender: users.gender,
                dateOfBirth: users.dateOfBirth,
                timezone: users.timezone,
                email: users.email,
                phone: users.phone,
                emailVerifiedAt: users.emailVerifiedAt,
                phoneVerifiedAt: users.phoneVerifiedAt,
                consentPd: users.consentPd,
                consentMedicalData: users.consentMedicalData,
                createdAt: users.createdAt,
                updatedAt: users.updatedAt,
            })
            .from(users)
            .where(eq(users.id, id))
        return user ?? null
    }

    async updateProfile(
        id: string,
        data: Partial<
            Pick<
                typeof users.$inferInsert,
                'firstName' | 'lastName' | 'middleName' | 'gender' | 'dateOfBirth' | 'phone'
            >
        >
    ) {
        const [user] = await this.db
            .update(users)
            .set({ ...data, updatedAt: new Date() })
            .where(eq(users.id, id))
            .returning()
        return user ?? null
    }

    async setEmailVerified(id: string) {
        await this.db
            .update(users)
            .set({ emailVerifiedAt: new Date(), updatedAt: new Date() })
            .where(eq(users.id, id))
    }

    async setPhoneVerified(id: string) {
        await this.db
            .update(users)
            .set({ phoneVerifiedAt: new Date(), updatedAt: new Date() })
            .where(eq(users.id, id))
    }
}
