import {
    pgTable,
    pgEnum,
    uuid,
    integer,
    varchar,
    text,
    numeric,
    boolean,
    timestamp,
    date,
    index,
    uniqueIndex,
    jsonb,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

export const genderEnum = pgEnum('gender', ['male', 'female'])

export const analysisStatusEnum = pgEnum('analysis_status', [
    'pending',
    'processing',
    'done',
    'failed',
])

export const analysisTypeEnum = pgEnum('analysis_type', [
    'cbc', // Общий анализ крови
    'biochemistry', // Биохимия
    'thyroid', // Гормоны щитовидной железы
    'hormones', // Половые гормоны
    'vitamins', // Витамины и микроэлементы
    'coagulation', // Коагулограмма
    'urinalysis', // Общий анализ мочи
    'lipid', // Липидный профиль
    'immunology', // Иммунология
    'other', // Другое
])

export const outOfRangeDirectionEnum = pgEnum('out_of_range_direction', ['low', 'high'])

export const users = pgTable(
    'users',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        firstName: varchar('first_name', { length: 100 }).notNull(),
        lastName: varchar('last_name', { length: 100 }).notNull(),
        middleName: varchar('middle_name', { length: 100 }),
        gender: genderEnum('gender'),
        dateOfBirth: date('date_of_birth'),
        timezone: varchar('timezone', { length: 50 }).notNull().default('Europe/Moscow'),

        phone: varchar('phone', { length: 25 }).unique(),
        email: varchar('email', { length: 255 }).unique(),

        emailVerifiedAt: timestamp('email_verified_at'),
        phoneVerifiedAt: timestamp('phone_verified_at'),

        password: varchar('password', { length: 255 }),
        consentPd: boolean('consent_pd').notNull().default(false),
        consentMedicalData: boolean('consent_medical_data').notNull().default(false),

        createdAt: timestamp('created_at').defaultNow().notNull(),
        updatedAt: timestamp('updated_at').defaultNow().notNull(),
        deletedAt: timestamp('deleted_at'),
    },
    (table) => [index('users_email_idx').on(table.email), index('users_phone_idx').on(table.phone)]
)

export const analyses = pgTable(
    'analyses',
    {
        id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
        userId: uuid('user_id')
            .notNull()
            .references(() => users.id),

        labName: varchar('lab_name', { length: 255 }),
        labAddress: text('lab_address'),
        labPhone: varchar('lab_phone', { length: 100 }),

        patientFullName: varchar('patient_full_name', { length: 255 }),
        patientGender: genderEnum('patient_gender'),
        patientBirthDate: varchar('patient_birth_date', { length: 20 }),
        patientAge: integer('patient_age'),

        orderId: varchar('order_id', { length: 100 }),
        sampleTakenAt: varchar('sample_taken_at', { length: 50 }),
        reportDate: varchar('report_date', { length: 50 }),

        fileKey: varchar('file_key', { length: 500 }).notNull(),
        fileOriginalName: varchar('file_original_name', { length: 255 }),
        fileMimeType: varchar('file_mime_type', { length: 100 }),
        fileSize: integer('file_size'),

        status: analysisStatusEnum('status').notNull().default('pending'),
        // detectedTypes: auto-detected from OCR section names (canonical for frontend filtering)
        detectedTypes: analysisTypeEnum('detected_types').array(),
        // analysisType: manual override/hint from user at upload time
        analysisType: varchar('analysis_type', { length: 20 }),
        typeSource: varchar('type_source', { length: 10 }).notNull().default('manual'),
        ocrProvider: varchar('ocr_provider', { length: 20 }),
        ocrRawText: text('ocr_raw_text'),
        isArchived: boolean('is_archived').notNull().default(false),

        createdAt: timestamp('created_at').defaultNow().notNull(),
        updatedAt: timestamp('updated_at').defaultNow().notNull(),
    },
    (table) => [index('analyses_user_id_is_archived_idx').on(table.userId, table.isArchived)]
)

export const markers = pgTable(
    'markers',
    {
        id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
        analysisId: integer('analysis_id')
            .notNull()
            .references(() => analyses.id),

        name: varchar('name', { length: 255 }).notNull(),
        code: varchar('code', { length: 50 }),
        section: varchar('section', { length: 100 }),

        value: numeric('value', { precision: 12, scale: 4 }),
        // Качественный/текстовый результат («не обнаружено», «жёлтый», «немного»,
        // «обнаружены», «<34», «0-1») — для маркеров, у которых результат не число.
        valueText: text('value_text'),
        unit: varchar('unit', { length: 50 }),
        referenceMin: numeric('reference_min', { precision: 12, scale: 4 }),
        referenceMax: numeric('reference_max', { precision: 12, scale: 4 }),
        referenceRaw: varchar('reference_raw', { length: 255 }),

        isOutOfRange: boolean('is_out_of_range').notNull().default(false),
        outOfRangeDirection: outOfRangeDirectionEnum('out_of_range_direction'),

        isEdited: boolean('is_edited').notNull().default(false),
        originalValue: numeric('original_value', { precision: 12, scale: 4 }),

        // Решение 032: ссылка на собственный справочник (проставляется воркером
        // через MarkerMatcher). Nullable — если маркер не сматчился.
        catalogId: integer('catalog_id').references(() => markerCatalog.id),

        // Append-only versioning (decisions 034/039): edits INSERT a new revision,
        // the previous row is only flipped to is_current=false (history preserved).
        revision: integer('revision').notNull().default(1),
        isCurrent: boolean('is_current').notNull().default(true),

        comment: text('comment'),
        method: varchar('method', { length: 255 }),

        createdAt: timestamp('created_at').defaultNow().notNull(),
    },
    (table) => [
        index('markers_analysis_id_idx').on(table.analysisId),
        // Partial unique: only ONE current revision per (analysisId, name, method);
        // old revisions stay in the table without conflicting.
        // NULLS NOT DISTINCT (hand-written in migration 0007): two markers with
        // same (analysisId, name, method=null) conflict
        uniqueIndex('markers_analysis_id_name_method_current_unique')
            .on(table.analysisId, table.name, table.method)
            .where(sql`${table.isCurrent} = true`),
    ]
)

export const questionnaireResponses = pgTable(
    'questionnaire_responses',
    {
        id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
        userId: uuid('user_id')
            .notNull()
            .references(() => users.id),
        answers: jsonb('answers').notNull(),
        tags: jsonb('tags')
            .notNull()
            .$default(() => []),
        createdAt: timestamp('created_at').defaultNow().notNull(),
        updatedAt: timestamp('updated_at').defaultNow().notNull(),
    },
    (table) => [index('questionnaire_user_id_idx').on(table.userId)]
)

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert

export type Analysis = typeof analyses.$inferSelect
export type NewAnalysis = typeof analyses.$inferInsert

export type Marker = typeof markers.$inferSelect
export type NewMarker = typeof markers.$inferInsert

export type QuestionnaireResponse = typeof questionnaireResponses.$inferSelect
export type NewQuestionnaireResponse = typeof questionnaireResponses.$inferInsert

// ── Справочник маркеров и оптимумов (решение 032) ─────────────────────────────

export const optimumGenderEnum = pgEnum('optimum_gender', ['all', 'male', 'female'])

export const markerSections = pgTable('marker_sections', {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    code: varchar('code', { length: 30 }).notNull().unique(),
    title: varchar('title', { length: 120 }).notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
})

export const markerCatalog = pgTable(
    'marker_catalog',
    {
        id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
        key: varchar('key', { length: 40 }).notNull().unique(),
        sectionCode: varchar('section_code', { length: 30 }).notNull(),
        display: varchar('display', { length: 200 }).notNull(),
        unit: varchar('unit', { length: 50 }),
        aliases: jsonb('aliases')
            .notNull()
            .$default(() => []),
    },
    (table) => [index('marker_catalog_section_idx').on(table.sectionCode)]
)

export const markerOptimums = pgTable(
    'marker_optimums',
    {
        id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
        catalogId: integer('catalog_id')
            .notNull()
            .references(() => markerCatalog.id),
        gender: optimumGenderEnum('gender').notNull().default('all'),
        optimumMin: numeric('optimum_min', { precision: 12, scale: 4 }),
        optimumMax: numeric('optimum_max', { precision: 12, scale: 4 }),
        unit: varchar('unit', { length: 50 }),
    },
    (table) => [
        uniqueIndex('marker_optimums_catalog_gender_unique').on(table.catalogId, table.gender),
    ]
)

// ── История расчётов профиля (решения 033/034 — append-only) ──────────────────

export const profileCalculations = pgTable(
    'profile_calculations',
    {
        id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
        userId: uuid('user_id')
            .notNull()
            .references(() => users.id),
        profileType: varchar('profile_type', { length: 30 }).notNull(),
        healthScore: integer('health_score'),
        sectionScores: jsonb('section_scores')
            .notNull()
            .$default(() => []),
        signals: jsonb('signals')
            .notNull()
            .$default(() => []),
        findings: jsonb('findings')
            .notNull()
            .$default(() => []),
        tags: jsonb('tags')
            .notNull()
            .$default(() => []),
        triggerSource: varchar('trigger_source', { length: 30 }).notNull(),
        calculatedAt: timestamp('calculated_at').defaultNow().notNull(),
    },
    (table) => [index('profile_calc_user_idx').on(table.userId, table.calculatedAt)]
)

// ── Редактируемый контент рекомендаций (мой пункт улучшений #5) ────────────────
// Нутрициолог правит тексты через БД без деплоя; код служит фолбэком-сидом.

export const recommendationContent = pgTable(
    'recommendation_content',
    {
        id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
        kind: varchar('kind', { length: 20 }).notNull(), // 'program' | 'signal' | 'food' | 'tip'
        key: varchar('key', { length: 60 }).notNull().unique(),
        title: varchar('title', { length: 200 }),
        body: jsonb('body').notNull(),
        isActive: boolean('is_active').notNull().default(true),
        sortOrder: integer('sort_order').notNull().default(0),
        updatedAt: timestamp('updated_at').defaultNow().notNull(),
    },
    (table) => [index('rec_content_kind_idx').on(table.kind)]
)

// ── Лиды на индивидуальную консультацию ─────────────────────────────────────────
// Лид всегда сохраняется в БД (виден в админке); письмо-уведомление — best-effort
// на адрес из app_settings.

export const leads = pgTable(
    'leads',
    {
        id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
        userId: uuid('user_id')
            .notNull()
            .references(() => users.id),
        message: text('message'),
        processedAt: timestamp('processed_at'),
        createdAt: timestamp('created_at').defaultNow().notNull(),
    },
    (table) => [index('leads_created_at_idx').on(table.createdAt)]
)

// Key-value настройки, редактируемые из админки без деплоя.
// Ключи: 'lead_notification_email'.
export const appSettings = pgTable('app_settings', {
    key: varchar('key', { length: 100 }).primaryKey(),
    value: text('value').notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export type MarkerSection = typeof markerSections.$inferSelect
export type MarkerCatalog = typeof markerCatalog.$inferSelect
export type NewMarkerCatalog = typeof markerCatalog.$inferInsert
export type MarkerOptimum = typeof markerOptimums.$inferSelect
export type ProfileCalculation = typeof profileCalculations.$inferSelect
export type NewProfileCalculation = typeof profileCalculations.$inferInsert
export type RecommendationContent = typeof recommendationContent.$inferSelect
