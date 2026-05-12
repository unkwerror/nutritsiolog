import { z }                  from 'zod'
import logger                  from '../core/logger.js'
import { OcrValidationError }  from './errors.js'

const labSchema = z.object({
    name:    z.string(),
    address: z.string().nullable(),
    phone:   z.string().nullable()
})

const patientSchema = z.object({
    fullName:  z.string(),
    gender:    z.enum(['male', 'female']).nullable(),
    birthDate: z.string().nullable(),
    age:       z.coerce.number().nullable()
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
    value:               z.coerce.number().nullable(),
    unit:                z.string().nullable(),
    referenceMin:        z.coerce.number().nullable(),
    referenceMax:        z.coerce.number().nullable(),
    referenceRaw:        z.string().nullable(),
    isOutOfRange:        z.boolean(),
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

// Разумные границы для известных маркеров — ловим галлюцинации Gemini
const SANITY_RANGES: Partial<Record<string, { min?: number; max?: number }>> = {
    HGB:  { min: 0, max: 500 },
    FERR: { min: 0 },
    WBC:  { min: 0, max: 1000 },
    GLU:  { min: 0, max: 200 },
    TSH:  { min: 0, max: 500 },
}

function sanityCheck(marker: Marker): void {
    if (marker.value === null || !marker.code) return
    const range = SANITY_RANGES[marker.code]
    if (!range) return

    const tooLow  = range.min !== undefined && marker.value < range.min
    const tooHigh = range.max !== undefined && marker.value > range.max

    if (tooLow || tooHigh) {
        throw new OcrValidationError(
            `Marker ${marker.code} value ${marker.value} is outside sanity range [${range.min ?? '-∞'}, ${range.max ?? '+∞'}]`
        )
    }
}

function correctMarker(marker: Marker): Marker {
    if (marker.value === null) return marker

    const tooLow      = marker.referenceMin !== null && marker.value < marker.referenceMin
    const tooHigh     = marker.referenceMax !== null && marker.value > marker.referenceMax
    const computedOOR = tooLow || tooHigh

    if (computedOOR !== marker.isOutOfRange) {
        logger.warn(
            { markerName: marker.name, geminiIsOutOfRange: marker.isOutOfRange, computedIsOutOfRange: computedOOR },
            'OCR isOutOfRange mismatch'
        )
    }

    if (computedOOR === marker.isOutOfRange) return marker

    return {
        ...marker,
        isOutOfRange:        computedOOR,
        outOfRangeDirection: tooLow ? 'low' : tooHigh ? 'high' : null
    }
}

export function validateLabResult(raw: unknown): LabResult {
    if (typeof raw === 'object' && raw !== null && 'notALabResult' in raw) {
        throw new OcrValidationError('NOT_LAB_RESULT: Document is not a medical lab result')
    }

    const result = labResultSchema.safeParse(raw)
    if (!result.success) {
        throw new OcrValidationError(`Invalid OCR response schema: ${result.error.message}`)
    }

    const corrected = result.data.markers.map(correctMarker)
    corrected.forEach(sanityCheck)

    return { ...result.data, markers: corrected }
}
