import {
    pgTable, pgEnum,
    uuid, integer, varchar, text, numeric, boolean, timestamp, date,
    index, uniqueIndex
} from 'drizzle-orm/pg-core'

export const genderEnum = pgEnum('gender', ['male', 'female'])

export const users = pgTable('users', {
    id:         uuid('id').primaryKey().defaultRandom(),
    firstName:  varchar('first_name',  { length: 100 }).notNull(),
    lastName:   varchar('last_name',   { length: 100 }).notNull(),
    middleName: varchar('middle_name', { length: 100 }),
    gender:     genderEnum('gender'),
    dateOfBirth: date('date_of_birth'),
    timezone:   varchar('timezone', { length: 50 }).notNull().default('Europe/Moscow'),

    phone: varchar('phone', { length: 25  }).unique(),
    email: varchar('email', { length: 255 }).unique(),

    emailVerifiedAt: timestamp('email_verified_at'),
    phoneVerifiedAt: timestamp('phone_verified_at'),

    password:          varchar('password', { length: 255 }),
    consentPd:         boolean('consent_pd').notNull().default(false),
    consentMedicalData: boolean('consent_medical_data').notNull().default(false),

    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    deletedAt: timestamp('deleted_at')
}, (table) => [
    index('users_email_idx').on(table.email),
    index('users_phone_idx').on(table.phone),
])

export const analyses = pgTable('analyses', {
    id:     integer('id').primaryKey().generatedAlwaysAsIdentity(),
    userId: uuid('user_id').notNull().references(() => users.id),

    labName:    varchar('lab_name',    { length: 255 }),
    labAddress: text('lab_address'),
    labPhone:   varchar('lab_phone',   { length: 25  }),

    patientFullName:  varchar('patient_full_name',  { length: 255 }),
    patientGender:    varchar('patient_gender',      { length: 10  }),
    patientBirthDate: varchar('patient_birth_date',  { length: 20  }),
    patientAge:       integer('patient_age'),

    orderId:       varchar('order_id',       { length: 100 }),
    sampleTakenAt: varchar('sample_taken_at', { length: 50  }),
    reportDate:    varchar('report_date',     { length: 50  }),

    fileKey:          varchar('file_key',           { length: 500 }).notNull(),
    fileOriginalName: varchar('file_original_name', { length: 255 }),
    fileMimeType:     varchar('file_mime_type',      { length: 100 }),
    fileSize:         integer('file_size'),

    status:     varchar('status', { length: 20 }).notNull().default('pending'),
    isArchived: boolean('is_archived').notNull().default(false),

    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull()
}, (table) => [
    index('analyses_user_id_is_archived_idx').on(table.userId, table.isArchived),
])

export const markers = pgTable('markers', {
    id:         integer('id').primaryKey().generatedAlwaysAsIdentity(),
    analysisId: integer('analysis_id').notNull().references(() => analyses.id),

    name:    varchar('name',    { length: 255 }).notNull(),
    code:    varchar('code',    { length: 50  }),
    section: varchar('section', { length: 100 }),

    value:        numeric('value',         { precision: 12, scale: 4 }),
    unit:         varchar('unit',          { length: 50 }),
    referenceMin: numeric('reference_min', { precision: 12, scale: 4 }),
    referenceMax: numeric('reference_max', { precision: 12, scale: 4 }),
    referenceRaw: varchar('reference_raw', { length: 255 }),

    isOutOfRange:        boolean('is_out_of_range').notNull().default(false),
    outOfRangeDirection: varchar('out_of_range_direction', { length: 10 }),

    comment: text('comment'),
    method:  varchar('method', { length: 255 })
}, (table) => [
    index('markers_analysis_id_idx').on(table.analysisId),
    uniqueIndex('markers_analysis_id_name_unique').on(table.analysisId, table.name),
])

export type User        = typeof users.$inferSelect
export type NewUser     = typeof users.$inferInsert

export type Analysis    = typeof analyses.$inferSelect
export type NewAnalysis = typeof analyses.$inferInsert

export type Marker      = typeof markers.$inferSelect
export type NewMarker   = typeof markers.$inferInsert
