import './core/proxy.js'
import { UnrecoverableError, Worker } from 'bullmq'
import { eq } from 'drizzle-orm'

import { OcrValidationError } from './ocr/errors.js'

import { MinioStorage } from './modules/analysis/infrastructure/storage.js'

const storage = new MinioStorage()
import { createOcrService } from './ocr/index.js'
import { analyses, markers, type analysisTypeEnum } from './db/schema.js'
import { db } from './db/client.js'
import { redis } from './core/redis.js'
import { config } from './core/config.js'
import logger from './core/logger.js'
import { matchCatalogKey } from './modules/profile/matcher.js'
import { ProfileRepository } from './modules/profile/repository.js'

const profileRepo = new ProfileRepository(db)

type AnalysisType = (typeof analysisTypeEnum.enumValues)[number]

const SECTION_TO_TYPE: Record<string, AnalysisType> = {
    'Общий анализ крови': 'cbc',
    Биохимия: 'biochemistry',
    'Гормоны щитовидной железы': 'thyroid',
    'Половые гормоны': 'hormones',
    'Витамины и микроэлементы': 'vitamins',
    Коагулограмма: 'coagulation',
    'Общий анализ мочи': 'urinalysis',
    'Липидный профиль': 'lipid',
    Иммунология: 'immunology',
    Другое: 'other',
}

const ocrService = createOcrService(config)

type AnalysisJobData = {
    analysisId: number
    fileKey: string
    mimeType: string
    analysisType?: string
    ocrProvider?: string
}

const worker = new Worker<AnalysisJobData>(
    'analysis',
    async (job) => {
        const { analysisId, fileKey, mimeType, analysisType, ocrProvider } = job.data
        const log = logger.child({ jobId: job.id, analysisId })

        log.info('job started')

        // Idempotency: если job уже обработан (retry после успешного commit) — пропускаем
        const [current] = await db
            .select({ status: analyses.status })
            .from(analyses)
            .where(eq(analyses.id, analysisId))

        if (!current) {
            log.warn('analysis not found, skipping')
            return
        }

        if (current.status === 'done') {
            log.info('already processed, skipping')
            return
        }

        // Публикация статуса + процента выполнения (0–100) в SSE. Прогресс —
        // fire-and-forget: сбой Redis не должен ронять обработку.
        // Последний процент кладём в Redis-ключ, чтобы клиент, переоткрывший
        // страницу в середине обработки, увидел актуальный прогресс сразу (иначе
        // он ловит только редкие чекпоинты и бар «стоит» на 0%).
        const publish = (status: string, progress?: number) => {
            if (progress !== undefined) {
                redis
                    .set(`analysis:progress:${analysisId}`, String(progress), 'EX', 3600)
                    .catch((e: Error) => log.warn({ err: e }, 'Failed to store progress'))
            }
            return redis
                .publish(
                    `analysis:${analysisId}`,
                    JSON.stringify(
                        progress !== undefined
                            ? { status, analysisId, progress }
                            : { status, analysisId }
                    )
                )
                .catch((pubErr: Error) => log.warn({ err: pubErr }, 'Failed to publish status'))
        }

        // Mark as processing so UI badge updates
        await db
            .update(analyses)
            .set({ status: 'processing', updatedAt: new Date() })
            .where(eq(analyses.id, analysisId))

        await publish('processing', 8)
        log.info('status set to processing')

        try {
            const buffer = await storage.getBuffer(fileKey)
            void publish('processing', 20)

            const result = await ocrService.parseLabResult(
                buffer,
                mimeType,
                analysisType,
                // Прогресс OCR (0..1) → 20–80% общей шкалы
                (f) => void publish('processing', Math.round(20 + Math.min(1, Math.max(0, f)) * 60))
            )
            void publish('processing', 82)

            log.info({ markerCount: result.markers.length }, 'parsed markers')

            // Deduplicate by (name, method) — OCR may return the same marker twice
            const seen = new Set<string>()
            const uniqueMarkers = result.markers.filter(
                (m: { name: string; method: string | null }) => {
                    const key = `${m.name}|${m.method ?? ''}`
                    if (seen.has(key)) return false
                    seen.add(key)
                    return true
                }
            )

            // Map OCR section names to canonical analysisTypeEnum values
            const detectedTypes = [
                ...new Set(
                    uniqueMarkers
                        .map((m: { section: string | null }) => SECTION_TO_TYPE[m.section ?? ''])
                        .filter((t): t is AnalysisType => t !== undefined)
                ),
            ]

            // Решение 032: маппинг маркеров на собственный справочник (catalog_id)
            const catalogKeyToId = await profileRepo.loadCatalogKeyToId()

            await db.transaction(async (tx) => {
                // onConflictDoNothing: при retry после сбоя между commit и publish
                // повторная вставка не падает на уникальном индексе (analysis_id, name, method)
                await tx.insert(markers).values(
                    uniqueMarkers.map((marker) => {
                        const catalogKey = matchCatalogKey(marker.name, marker.code)
                        const catalogId = catalogKey
                            ? (catalogKeyToId.get(catalogKey) ?? null)
                            : null
                        return {
                            analysisId,
                            name: marker.name,
                            code: marker.code,
                            section: marker.section,
                            value: marker.value !== null ? String(marker.value) : null,
                            valueText: marker.valueText,
                            unit: marker.unit,
                            referenceMin:
                                marker.referenceMin !== null ? String(marker.referenceMin) : null,
                            referenceMax:
                                marker.referenceMax !== null ? String(marker.referenceMax) : null,
                            referenceRaw: marker.referenceRaw,
                            isOutOfRange: marker.isOutOfRange,
                            outOfRangeDirection: marker.outOfRangeDirection,
                            comment: marker.comment,
                            method: marker.method,
                            catalogId,
                        }
                    })
                ).onConflictDoNothing()

                await tx
                    .update(analyses)
                    .set({
                        status: 'done',
                        detectedTypes,
                        ocrProvider: ocrProvider ?? config.OCR_PROVIDER,
                        labName: result.lab?.name,
                        labAddress: result.lab?.address,
                        labPhone: result.lab?.phone,
                        patientFullName: result.patient?.fullName,
                        patientGender: result.patient?.gender,
                        patientBirthDate: result.patient?.birthDate,
                        patientAge: result.patient?.age,
                        orderId: result.order?.id,
                        sampleTakenAt: result.order?.sampleTakenAt,
                        reportDate: result.order?.reportDate,
                        updatedAt: new Date(),
                    })
                    .where(eq(analyses.id, analysisId))
            })

            void publish('processing', 96)

        } catch (err) {
            log.error({ err }, 'job failed')
            await db
                .update(analyses)
                .set({ status: 'failed', updatedAt: new Date() })
                .where(eq(analyses.id, analysisId))
            // Не глушим ошибку публикации — просто логируем, чтобы не скрыть оригинальную
            void publish('failed')
            // Невалидный результат OCR (не бланк анализа, кривая схема) детерминирован —
            // повторные платные прогоны Vision+GPT не помогут
            if (err instanceof OcrValidationError) {
                throw new UnrecoverableError(err.message)
            }
            throw err
        }

        // Publish после commit — вне try: сбой Redis здесь не должен перевести
        // успешно сохранённый анализ в failed (и повторно вставлять маркеры)
        void publish('done', 100)
        log.info('job done')
    },
    {
        connection: { host: config.REDIS_HOST, port: config.REDIS_PORT },
        concurrency: 3,
        limiter: { max: 10, duration: 60_000 },
    }
)

// PM2 по умолчанию шлёт SIGINT — без него graceful shutdown не срабатывал
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
    process.on(signal, async () => {
        logger.info(`${signal} received, shutting down worker`)
        try {
            await worker.close()
            process.exit(0)
        } catch (err) {
            logger.error({ err }, 'Error during worker shutdown')
            process.exit(1)
        }
    })
}
