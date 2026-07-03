import { fileTypeFromBuffer } from 'file-type'
import { type StoragePort } from './infrastructure/storage.js'
import { type QueuePort } from './infrastructure/queue.js'
import { type AnalysisRepository } from './repository.js'
import { type QuestionnaireRepository } from '../questionnaire/repository.js'
import { assessMarkers, type AssessableMarker } from '../profile/assessment.js'
import { type Gender } from '../profile/optimums.js'
import { AnalysisNotFoundError, NothingUploadedError } from './errors.js'
import {
    NotFoundError,
    ValidationError,
    ConflictError,
    PG_UNIQUE_VIOLATION,
} from '../../core/errors.js'

const ALLOWED_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png'] as const

type FileInput = {
    buffer: Buffer
    mimeType: string
    originalName: string
}

type CreateAnalysisOptions = {
    analysisType?: string
    ocrProvider?: string
}

type MarkerEditInput = {
    value?: number | null
    valueText?: string | null
    unit?: string | null
    referenceMin?: number | null
    referenceMax?: number | null
    name?: string
    comment?: string | null
}

type MarkerAddInput = {
    name: string
    value?: number | null
    unit?: string | null
    section?: string | null
    comment?: string | null
    isOutOfRange?: boolean
    outOfRangeDirection?: 'low' | 'high' | null
}

// Нормализуем гендер из бланка/анкеты к 'male' | 'female' для гендерных оптимумов
function normalizeGender(raw: string | null | undefined): Gender | null {
    if (!raw) return null
    const s = raw.trim().toLowerCase()
    if (s === 'male' || s === 'm' || s.startsWith('муж')) return 'male'
    if (s === 'female' || s === 'f' || s.startsWith('жен')) return 'female'
    return null
}

export class AnalysisService {
    constructor(
        private repo: AnalysisRepository,
        private storage: StoragePort,
        private queue: QueuePort,
        // Опционально: для персонализации оценки маркеров (гендер + теги анкеты)
        private questionnaireRepo?: QuestionnaireRepository
    ) {}

    async createAnalysis(userId: string, files: FileInput[], opts: CreateAnalysisOptions = {}) {
        if (files.length === 0) throw new NothingUploadedError()

        // Сначала валидируем ВСЕ файлы, потом сохраняем: иначе при невалидном
        // втором файле первый уже создан и поставлен в очередь, а клиент видит 400
        const validated: Array<{ file: FileInput; mime: string }> = []
        for (const file of files) {
            // 10.3: validate MIME by magic bytes, not client-provided Content-Type
            const detected = await fileTypeFromBuffer(file.buffer)
            if (!detected || !(ALLOWED_MIME_TYPES as readonly string[]).includes(detected.mime)) {
                throw new ValidationError(
                    'INVALID_FILE_TYPE',
                    `Unsupported file type: ${detected?.mime ?? 'unknown'}`
                )
            }
            validated.push({ file, mime: detected.mime })
        }

        // Файлы обрабатываем параллельно: загрузка в MinIO + insert + enqueue не
        // зависят друг от друга между файлами. Promise.all сохраняет порядок.
        const results = await Promise.all(
            validated.map(async ({ file, mime }) => {
                const fileKey = await this.storage.upload(file.buffer, file.originalName, mime)
                const analysis = await this.repo.insert({
                    userId,
                    fileKey,
                    fileOriginalName: file.originalName,
                    fileMimeType: mime,
                    fileSize: file.buffer.length,
                    analysisType: opts.analysisType,
                    typeSource: opts.analysisType ? 'manual' : 'ai',
                    ocrProvider: opts.ocrProvider,
                })

                await this.queue.add({
                    analysisId: analysis.id,
                    fileKey,
                    mimeType: mime,
                    analysisType: opts.analysisType,
                    ocrProvider: opts.ocrProvider,
                })

                return { analysisId: analysis.id, status: 'pending' }
            })
        )

        return results.length === 1 ? results[0]! : results
    }

    async listAnalyses(userId: string) {
        return this.repo.findAllByUser(userId)
    }

    async getAnalysis(id: number, userId: string) {
        const analysis = await this.repo.findByIdAndUser(id, userId)
        if (!analysis) throw new AnalysisNotFoundError()
        const analysisMarkers = await this.repo.findMarkersByAnalysisId(id)

        // Персонализация: гендер (анкета → бланк) и теги анкеты для сигналов.
        // Оценку строим по собственным оптимумам нутрициолога (решение 032).
        let gender = normalizeGender(analysis.patientGender)
        let tags: string[] = []
        if (this.questionnaireRepo) {
            const questionnaire = await this.questionnaireRepo.findLatestByUser(userId)
            if (questionnaire) {
                const answers = questionnaire.answers as { gender?: string } | null
                gender = normalizeGender(answers?.gender) ?? gender
                tags = (questionnaire.tags as string[]) ?? []
            }
        }

        const assessInput: AssessableMarker[] = analysisMarkers.map((m) => ({
            name: m.name,
            code: m.code,
            value: m.value,
            isOutOfRange: m.isOutOfRange,
            outOfRangeDirection: m.outOfRangeDirection,
            referenceMin: m.referenceMin,
            referenceMax: m.referenceMax,
            section: m.section,
        }))
        const assessments = assessMarkers(assessInput, gender, tags)

        const markersWithAssessment = analysisMarkers.map((m, i) => ({
            ...m,
            assessment: assessments[i]!,
        }))

        return { ...analysis, markers: markersWithAssessment }
    }

    // Manually add a marker to a recognised analysis. isEdited=true marks it as
    // user-supplied (not from OCR). isOutOfRange comes straight from the user here.
    async addMarker(analysisId: number, userId: string, input: MarkerAddInput) {
        const analysis = await this.repo.findByIdAndUser(analysisId, userId)
        if (!analysis) throw new AnalysisNotFoundError()

        const isOutOfRange = input.isOutOfRange ?? false
        try {
            const created = await this.repo.insertMarker({
                analysisId,
                name: input.name,
                value:
                    input.value !== undefined && input.value !== null ? String(input.value) : null,
                unit: input.unit ?? null,
                section: input.section ?? null,
                comment: input.comment ?? null,
                isOutOfRange,
                outOfRangeDirection: isOutOfRange ? (input.outOfRangeDirection ?? null) : null,
                isEdited: true,
            })
            if (!created) throw new Error('Insert returned no rows')
            return created
        } catch (err) {
            if (
                err &&
                typeof err === 'object' &&
                'code' in err &&
                err.code === PG_UNIQUE_VIOLATION
            ) {
                throw new ConflictError('MARKER_EXISTS', 'Маркер с таким названием уже есть')
            }
            throw err
        }
    }

    // Append-only edit (decisions 034/039): никакого UPDATE значений — старая
    // ревизия помечается is_current=false, вставляется новая строка-ревизия
    // с is_edited=true и original_value = исходное OCR-значение.
    async updateMarker(markerId: number, userId: string, input: MarkerEditInput) {
        const existing = await this.repo.findMarkerWithOwner(markerId, userId)
        // Редактировать можно только текущую ревизию: GET отдаёт только их,
        // а правка устаревшего id породила бы вторую «текущую» строку
        if (!existing || !existing.isCurrent)
            throw new NotFoundError('MARKER_NOT_FOUND', 'Marker not found')

        // Пересчёт нужен и при смене значения, не только референсов: иначе
        // исправленное юзером значение сохраняет старый флаг «вне нормы»
        // и профиль продолжает считать его критичным
        const affectsRange =
            input.value !== undefined ||
            input.referenceMin !== undefined ||
            input.referenceMax !== undefined

        let isOutOfRange = existing.isOutOfRange
        let outOfRangeDirection = existing.outOfRangeDirection

        if (affectsRange) {
            const mergedValue =
                input.value !== undefined
                    ? input.value
                    : existing.value !== null
                      ? Number(existing.value)
                      : null
            const mergedMin =
                input.referenceMin !== undefined
                    ? input.referenceMin
                    : existing.referenceMin !== null
                      ? Number(existing.referenceMin)
                      : null
            const mergedMax =
                input.referenceMax !== undefined
                    ? input.referenceMax
                    : existing.referenceMax !== null
                      ? Number(existing.referenceMax)
                      : null

            const tooLow =
                mergedValue !== null &&
                mergedMin !== null &&
                Number.isFinite(mergedValue) &&
                Number.isFinite(mergedMin) &&
                mergedValue < mergedMin
            const tooHigh =
                mergedValue !== null &&
                mergedMax !== null &&
                Number.isFinite(mergedValue) &&
                Number.isFinite(mergedMax) &&
                mergedValue > mergedMax

            isOutOfRange = tooLow || tooHigh
            outOfRangeDirection = tooLow ? 'low' : tooHigh ? 'high' : null
        }

        // originalValue фиксирует исходное OCR-значение: у первой правки берём
        // value старой строки, у последующих — переносим уже зафиксированное
        // (иначе rename первым шагом навсегда терял исходное значение)
        const originalValue = existing.originalValue ?? existing.value

        // Новая ревизия = старая строка + правки юзера (merge по полям)
        const inserted = await this.repo
            .insertMarkerRevision(existing.id, {
                analysisId: existing.analysisId,
                name: input.name !== undefined ? input.name : existing.name,
                code: existing.code,
                section: existing.section,
                value:
                    input.value !== undefined
                        ? input.value !== null
                            ? String(input.value)
                            : null
                        : existing.value,
                // Текстовый результат: берём из правки, иначе переносим прежний
                valueText:
                    input.valueText !== undefined ? input.valueText : existing.valueText,
                unit: input.unit !== undefined ? input.unit : existing.unit,
                referenceMin:
                    input.referenceMin !== undefined
                        ? input.referenceMin !== null
                            ? String(input.referenceMin)
                            : null
                        : existing.referenceMin,
                referenceMax:
                    input.referenceMax !== undefined
                        ? input.referenceMax !== null
                            ? String(input.referenceMax)
                            : null
                        : existing.referenceMax,
                referenceRaw: existing.referenceRaw,
                isOutOfRange,
                outOfRangeDirection,
                isEdited: true,
                originalValue,
                revision: existing.revision + 1,
                comment: input.comment !== undefined ? input.comment : existing.comment,
                method: existing.method,
            })
            .catch((err: unknown) => {
                if (
                    err &&
                    typeof err === 'object' &&
                    'code' in err &&
                    err.code === PG_UNIQUE_VIOLATION
                ) {
                    throw new ConflictError('MARKER_EXISTS', 'Маркер с таким названием уже есть')
                }
                throw err
            })

        if (!inserted) throw new NotFoundError('MARKER_NOT_FOUND', 'Marker not found')
        return inserted
    }
}
