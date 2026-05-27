import { z }                  from 'zod'
import { OcrValidationError }  from './errors.js'

// Converts any value to number, returning null for non-finite results ("не обнаружено", "21 год", etc.)
const safeNumber = z.preprocess(
    (v: unknown) => {
        if (v === null || v === undefined || v === '') return null
        const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.'))
        return Number.isFinite(n) ? n : null
    },
    z.number().nullable()
)

const labSchema = z.object({
    name:    z.string(),
    address: z.string().nullable(),
    phone:   z.string().nullable()
})

const patientSchema = z.object({
    fullName:  z.string(),
    gender:    z.enum(['male', 'female']).nullable(),
    birthDate: z.string().nullable(),
    age:       safeNumber
})

const orderSchema = z.object({
    id:            z.string().nullable(),
    sampleTakenAt: z.string().nullable(),
    reportDate:    z.string().nullable()
})

const markerSchema = z.object({
    name:                z.string(),
    code:                z.string().nullable(),
    section:             z.string(),
    value:               safeNumber,
    unit:                z.string().nullable(),
    referenceMin:        safeNumber.optional().transform(v => v ?? null),
    referenceMax:        safeNumber.optional().transform(v => v ?? null),
    referenceRaw:        z.string().nullable().optional().transform(v => v ?? null),
    isOutOfRange:        z.boolean().nullable().transform(v => v ?? false),
    outOfRangeDirection: z.enum(['low', 'high']).nullable(),
    comment:             z.string().nullable(),
    method:              z.string().nullable()
})

const labResultSchema = z.object({
    lab:     labSchema,
    patient: patientSchema,
    order:   orderSchema,
    markers: z.array(markerSchema)
})

export type Marker    = z.infer<typeof markerSchema>
export type LabResult = z.infer<typeof labResultSchema>

export function validateLabResult(raw: unknown): LabResult {
    if (typeof raw === 'object' && raw !== null && 'notALabResult' in raw) {
        throw new OcrValidationError('NOT_LAB_RESULT: Document is not a medical lab result')
    }

    const result = labResultSchema.safeParse(raw)
    if (!result.success) {
        throw new OcrValidationError(`Invalid OCR response schema: ${result.error.message}`)
    }

    return result.data
}
