import { z } from 'zod'

const labSchema = z.object({
    name: z.string(),
    address: z.string().nullable(),
    phone: z.string().nullable()
})

const patientSchema = z.object({
    fullName: z.string(),
    gender: z.enum(['male', 'female']).nullable(),
    birthDate: z.string().nullable(),
    age: z.coerce.number().nullable()
})

const orderSchema = z.object({
    id: z.string().nullable(),
    sampleTakenAt: z.string().nullable(),
    reportDate: z.string().nullable()
})

const markerSchema = z.object({
    name: z.string(),
    code: z.string().nullable(),
    section: z.string(),
    value: z.coerce.number().nullable(),
    unit: z.string().nullable(),
    referenceMin: z.coerce.number().nullable(),
    referenceMax: z.coerce.number().nullable(),
    referenceRaw: z.string().nullable(),
    isOutOfRange: z.boolean(),
    outOfRangeDirection: z.enum(['low', 'high']).nullable(),
    comment: z.string().nullable(),
    method: z.string().nullable()
})

const labResultSchema = z.object({
    lab: labSchema,
    patient: patientSchema,
    order: orderSchema,
    markers: z.array(markerSchema)
})

export type Marker    = z.infer<typeof markerSchema>
export type LabResult = z.infer<typeof labResultSchema>


function correctMarker(marker: Marker): Marker {
    if (marker.value === null) return marker

    const tooLow = marker.referenceMin !== null && marker.value < marker.referenceMin
    const tooHigh = marker.referenceMax !== null && marker.value > marker.referenceMax
    const computedOOR = tooLow || tooHigh

    if (computedOOR === marker.isOutOfRange) return marker

    return {
        ...marker,
        isOutOfRange: computedOOR,
        outOfRangeDirection: tooLow ? 'low' : tooHigh ? 'high' : null
    }
}

export function validateLabResult(raw: unknown): LabResult {
    const result = labResultSchema.safeParse(raw)
    if (!result.success) {
        throw new Error(`Invalid Gemini response: ${result.error.message}`)
    }
    return {
        ...result.data,
        markers: result.data.markers.map(correctMarker)
    }
}
