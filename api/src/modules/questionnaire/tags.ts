import type { QuestionnaireAnswers } from './schemas.js'

export function computeTags(a: QuestionnaireAnswers): string[] {
    const tags: string[] = []

    // Sleep
    if (a.sleepDuration === 'lt6') tags.push('SLEEP_DEFICIT')
    else if (
        a.sleepDuration === '6-7' &&
        (a.sleepQuality === 'interrupted' || a.sleepQuality === 'poor')
    )
        tags.push('SLEEP_DEFICIT')
    if (a.sleepQuality === 'interrupted' || a.sleepQuality === 'poor')
        tags.push('SLEEP_QUALITY_LOW')
    if (a.bedtime === 'after_00') tags.push('CIRCADIAN_DISRUPTION')

    // Activity
    if (a.activityLevel === 'sedentary') tags.push('LIFESTYLE_SEDENTARY')
    if (a.activityLevel === 'high' || a.activityLevel === 'moderate') tags.push('ACTIVE')

    // Diet
    if (a.dinnerToSleep === 'lt2h') tags.push('EATING_PATTERN_ISSUE')
    if (a.waterLiters === 'lt1.5') tags.push('DEHYDRATION_RISK')
    if (a.caffeine === '3-4' || a.caffeine === 'gt5') tags.push('STIMULANT_OVERUSE')
    if (a.smoking === 'yes') tags.push('SMOKING')
    if (a.emotionalEating === 'often' || a.emotionalEating === 'always') tags.push('STRESS_EATING')
    if (a.mealsPerDay === '1-2') tags.push('MEAL_FREQUENCY_LOW')

    // Symptoms
    const s = a.symptoms
    if (s.includes('fatigue')) tags.push('FATIGUE')
    if (s.includes('bloating') || s.includes('gut_issues')) tags.push('DIGESTIVE')
    if (s.includes('hair_skin_nails')) tags.push('SKIN_HAIR_NAILS')
    if (s.includes('edema')) tags.push('FLUID_RETENTION')
    if (s.includes('mood_anxiety')) tags.push('MOOD_IMBALANCE')
    if (s.includes('headaches_brainfog')) tags.push('NEURO_INFLAMMATION')
    if (s.includes('low_immunity')) tags.push('IMMUNITY_LOW')
    if (s.includes('joint_muscle_pain')) tags.push('INFLAMMATION')
    if (s.includes('cold_extremities')) tags.push('CIRCULATION_ISSUE')

    // Composite thyroid risk
    if (s.includes('fatigue') && s.includes('cold_extremities') && s.includes('hair_skin_nails')) {
        tags.push('THYROID_RISK')
    }
    // Adrenal stress
    if (
        (a.caffeine === '3-4' || a.caffeine === 'gt5') &&
        (a.emotionalEating === 'often' || a.emotionalEating === 'always')
    ) {
        tags.push('ADRENAL_STRESS')
    }

    // Medical
    if (a.medications !== 'no') tags.push('ON_MEDICATIONS')
    if (a.cycleStatus === 'menopause') tags.push('MENOPAUSE')
    if (a.pms === 'moderate' || a.pms === 'severe') tags.push('HORMONAL_IMBALANCE')

    // Goals (множественный выбор)
    for (const g of a.goal) tags.push(`GOAL_${g.toUpperCase()}`)

    return [...new Set(tags)]
}
