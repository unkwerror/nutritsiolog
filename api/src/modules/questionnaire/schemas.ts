import { z } from 'zod'

export const QuestionnaireAnswersSchema = z.object({
    // Step 1: Basic
    gender: z.enum(['male', 'female']),
    dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    heightCm: z.number().int().min(100).max(250),
    weightKg: z.number().min(30).max(300),
    waistCm: z.number().int().min(40).max(200).optional(),
    // Множественный выбор цели (может быть несколько)
    goal: z
        .array(z.enum(['lose_weight', 'maintain', 'gain', 'energy_sleep', 'gut_health']))
        .min(1)
        .max(5),
    // Step 2: Lifestyle
    activityLevel: z.enum(['sedentary', 'light', 'moderate', 'high']),
    sleepDuration: z.enum(['lt6', '6-7', '7-8', 'gt8']),
    sleepQuality: z.enum(['excellent', 'normal', 'interrupted', 'poor']),
    bedtime: z.enum(['before_23', '23-00', 'after_00']),
    // Step 3: Diet
    mealsPerDay: z.enum(['1-2', '3', '4-5', 'gt5']),
    dinnerToSleep: z.enum(['lt2h', '2-3h', 'gt3h']),
    waterLiters: z.enum(['lt1.5', '1.5-2', 'gt2']),
    caffeine: z.enum(['0', '1-2', '3-4', 'gt5']),
    smoking: z.enum(['no', 'quit', 'yes']),
    emotionalEating: z.enum(['never', 'rarely', 'often', 'always']),
    // Step 4: Symptoms
    symptoms: z.array(
        z.enum([
            'fatigue',
            'bloating',
            'gut_issues',
            'hair_skin_nails',
            'edema',
            'mood_anxiety',
            'headaches_brainfog',
            'low_immunity',
            'joint_muscle_pain',
            'cold_extremities',
        ])
    ),
    // Step 5: Medical
    medications: z.enum(['no', 'hormones', 'blood_pressure', 'sugar', 'other']),
    supplements: z.enum(['no', 'regular', 'sometimes']),
    cycleStatus: z.enum(['regular', 'irregular', 'menopause', 'pregnancy']).optional(),
    pms: z.enum(['none', 'moderate', 'severe']).optional(),
})

export type QuestionnaireAnswers = z.infer<typeof QuestionnaireAnswersSchema>
