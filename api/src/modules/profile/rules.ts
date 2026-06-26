export type Signal = {
    category: string
    title: string
    text: string
    severity: 'info' | 'warning' | 'critical'
    sources: string[]
}

type MarkerResult = {
    code: string | null
    name: string
    value: string | null
    isOutOfRange: boolean
    outOfRangeDirection: 'low' | 'high' | null
}

// Marker name/code → canonical key for matching
const MARKER_ALIASES: Record<string, string[]> = {
    VIT_D: ['25-oh витамин d', 'витамин d', '25(oh)d', 'витамин d3', '25-гидроксивитамин d'],
    HGB: ['гемоглобин', 'hemoglobin', 'hgb', 'hb'],
    FERRITIN: ['ферритин', 'ferritin'],
    B12: ['витамин b12', 'кобаламин', 'b12', 'vitamin b12'],
    TSH: ['ттг', 'тиреотропный гормон', 'tsh'],
    T4_FREE: ['т4 свободный', 'свободный т4', 'ft4', 'т4 св'],
    CORTISOL: ['кортизол', 'cortisol'],
    INSULIN: ['инсулин', 'insulin'],
    GLUCOSE: ['глюкоза', 'glucose', 'глюкоза в крови'],
    OMEGA3: ['омега-3', 'омега 3', 'omega-3'],
    MAGNESIUM: ['магний', 'magnesium', 'mg'],
    ZINC: ['цинк', 'zinc', 'zn'],
    IRON: ['железо', 'iron', 'fe'],
    ALT: ['алт', 'аланинаминотрансфераза', 'alt', 'alat'],
    AST: ['аст', 'аспартатаминотрансфераза', 'ast', 'asat'],
    CHOLESTEROL: ['холестерин общий', 'общий холестерин', 'cholesterol total'],
    LDL: ['лпнп', 'ldl', 'лпнп-холестерин'],
    HDL: ['лпвп', 'hdl', 'лпвп-холестерин'],
    TRIGLYCERIDES: ['триглицериды', 'triglycerides', 'tg'],
    CRP: ['срб', 'crp', 'c-реактивный белок', 'с-реактивный белок'],
    URIC_ACID: ['мочевая кислота', 'uric acid'],
    TESTOSTERONE: ['тестостерон общий', 'тестостерон', 'testosterone'],
    ESTRADIOL: ['эстрадиол', 'estradiol', 'e2'],
    FOLIC_ACID: ['фолиевая кислота', 'folate', 'фолат'],
}

function matchMarkerKey(m: MarkerResult): string | null {
    const nameLower = (m.name ?? '').toLowerCase()
    const codeLower = (m.code ?? '').toLowerCase()
    for (const [key, aliases] of Object.entries(MARKER_ALIASES)) {
        if (aliases.some((a) => nameLower.includes(a) || codeLower.includes(a))) return key
    }
    return null
}

export function generateSignals(
    markers: MarkerResult[],
    questionnaireTags: string[],
    _gender: 'male' | 'female' | null
): Signal[] {
    const signals: Signal[] = []
    const tags = new Set(questionnaireTags)

    // Index markers by canonical key (first match wins)
    const markerMap = new Map<string, MarkerResult>()
    for (const m of markers) {
        const key = matchMarkerKey(m)
        if (key && !markerMap.has(key)) markerMap.set(key, m)
    }

    const get = (key: string) => markerMap.get(key)
    const isLow = (key: string) => {
        const m = get(key)
        return m?.isOutOfRange === true && m.outOfRangeDirection === 'low'
    }
    const isHigh = (key: string) => {
        const m = get(key)
        return m?.isOutOfRange === true && m.outOfRangeDirection === 'high'
    }

    // ── Vitamin D ──────────────────────────────────────────────────────────
    if (isLow('VIT_D')) {
        signals.push({
            category: 'Витамины',
            title: 'Дефицит витамина D',
            text: 'Уровень витамина D ниже оптимального. Рекомендуется 2000–4000 МЕ/день (D3 с K2), принимать с жирной едой в первой половине дня. Через 3 месяца — повторный контроль.',
            severity: 'warning',
            sources: ['VIT_D'],
        })
    }

    // ── Iron / Ferritin ────────────────────────────────────────────────────
    if (isLow('HGB') || isLow('FERRITIN') || isLow('IRON')) {
        const src = (['HGB', 'FERRITIN', 'IRON'] as const).filter((k) => isLow(k))
        signals.push({
            category: 'Кровь',
            title: 'Дефицит железа',
            text: 'Показатели железа ниже оптимума. Увеличьте потребление красного мяса (баранина, говядина), печени, тёмной листовой зелени. Витамин C с каждым приёмом пищи усиливает усвоение. Избегайте кофе/чая за час до и после еды — они блокируют всасывание железа.',
            severity: isLow('HGB') ? 'critical' : 'warning',
            sources: src,
        })
    }

    // ── B12 ────────────────────────────────────────────────────────────────
    if (isLow('B12')) {
        signals.push({
            category: 'Витамины',
            title: 'Дефицит витамина B12',
            text: 'Низкий B12 — частая причина усталости, тумана в голове, плохого настроения. Приоритет: метилкобаламин (не цианокобаламин) 1000 мкг/день под язык. Проверить уровень гомоцистеина и фолата.',
            severity: 'warning',
            sources: ['B12'],
        })
    }

    // ── Thyroid ────────────────────────────────────────────────────────────
    if (isHigh('TSH') || isLow('T4_FREE')) {
        signals.push({
            category: 'Щитовидная железа',
            title: 'Риск гипотиреоза',
            text: 'Показатели щитовидной железы требуют внимания. Рекомендуется консультация эндокринолога. Нутрициологически: обеспечить достаточный йод (морские водоросли, морская рыба), селен (2–3 бразильских ореха в день), цинк.',
            severity: 'critical',
            sources: (['TSH', 'T4_FREE'] as const).filter((k) => get(k)?.isOutOfRange),
        })
    } else if (tags.has('THYROID_RISK') && !markerMap.has('TSH')) {
        signals.push({
            category: 'Щитовидная железа',
            title: 'Симптомы риска гипотиреоза',
            text: 'Сочетание симптомов (усталость + зябкость + выпадение волос) указывает на возможные нарушения щитовидной железы. Рекомендуем сдать ТТГ, Т4 свободный и Т3.',
            severity: 'info',
            sources: ['questionnaire:THYROID_RISK'],
        })
    }

    // ── Cortisol / Adrenal ─────────────────────────────────────────────────
    if (isHigh('CORTISOL') || tags.has('ADRENAL_STRESS')) {
        signals.push({
            category: 'Стресс и надпочечники',
            title: 'Повышенный кортизол / надпочечниковый стресс',
            text: 'Высокий кортизол или признаки хронического стресса. Сократите кофе до 1–2 чашек до 14:00. Добавьте адаптогены: ашваганда 300–500 мг, магний глицинат 400 мг вечером. Практики: 10 минут дыхания 4-7-8 перед сном.',
            severity: 'warning',
            sources: [isHigh('CORTISOL') ? 'CORTISOL' : 'questionnaire:ADRENAL_STRESS'],
        })
    }

    // ── Glucose / Insulin resistance ───────────────────────────────────────
    if (isHigh('GLUCOSE') || isHigh('INSULIN')) {
        signals.push({
            category: 'Метаболизм',
            title: 'Риск инсулинорезистентности',
            text: 'Повышенная глюкоза или инсулин. Уберите перекусы, соблюдайте интервалы 4–5 часов между едой, исключите быстрые углеводы. Берберин 500 мг 2×/день с едой может снизить инсулинорезистентность. Физическая нагрузка после каждого приёма пищи 15–20 мин.',
            severity: 'critical',
            sources: (['GLUCOSE', 'INSULIN'] as const).filter((k) => isHigh(k)),
        })
    }

    // ── Lipids ─────────────────────────────────────────────────────────────
    if (isHigh('CHOLESTEROL') || isHigh('LDL') || isHigh('TRIGLYCERIDES')) {
        signals.push({
            category: 'Сердечно-сосудистая система',
            title: 'Дислипидемия',
            text: 'Повышенные жиры крови. Основа: омега-3 жирные кислоты (EPA+DHA 2–3 г/день), жирная рыба 3 раза в неделю. Исключить трансжиры и рафинированные масла. Добавить клетчатку: овсяные отруби, семена льна, авокадо.',
            severity: isHigh('LDL') ? 'critical' : 'warning',
            sources: (['CHOLESTEROL', 'LDL', 'TRIGLYCERIDES'] as const).filter((k) => isHigh(k)),
        })
    }
    if (isLow('HDL')) {
        signals.push({
            category: 'Сердечно-сосудистая система',
            title: 'Низкий ЛПВП (защитный холестерин)',
            text: 'ЛПВП ниже нормы — повышает сердечно-сосудистый риск. Аэробные нагрузки 150 мин/нед обязательны. Полезные жиры: авокадо, оливковое масло Extra Virgin, орехи.',
            severity: 'warning',
            sources: ['HDL'],
        })
    }

    // ── CRP / Inflammation ─────────────────────────────────────────────────
    if (isHigh('CRP')) {
        signals.push({
            category: 'Воспаление',
            title: 'Системное воспаление (СРБ повышен)',
            text: 'Хроническое воспаление — корень большинства метаболических нарушений. Исключите провоспалительные продукты: сахар, рафинированные масла, глютен (временно). Куркумин 500–1000 мг/день с чёрным перцем — природный противовоспалительный агент. Омега-3 обязательно.',
            severity: 'critical',
            sources: ['CRP'],
        })
    } else if (tags.has('INFLAMMATION')) {
        signals.push({
            category: 'Воспаление',
            title: 'Симптомы воспаления',
            text: 'Боли в суставах/мышцах указывают на возможное воспаление. Рекомендуем сдать СРБ высокочувствительный. Уже сейчас: омега-3, куркумин, противовоспалительная диета.',
            severity: 'info',
            sources: ['questionnaire:INFLAMMATION'],
        })
    }

    // ── Magnesium ──────────────────────────────────────────────────────────
    if (isLow('MAGNESIUM') || tags.has('SLEEP_QUALITY_LOW') || tags.has('MOOD_IMBALANCE')) {
        signals.push({
            category: 'Нутриенты',
            title: 'Вероятный дефицит магния',
            text: 'Магний участвует в 300+ ферментативных реакциях. Симптомы дефицита: плохой сон, судороги, тревожность, усталость. Магний глицинат или малат 400 мг вечером. Продукты: тёмный шоколад >70%, тыквенные семечки, зелёная листовая зелень.',
            severity: 'info',
            sources: [isLow('MAGNESIUM') ? 'MAGNESIUM' : 'questionnaire'],
        })
    }

    // ── Lifestyle-based ────────────────────────────────────────────────────
    if (tags.has('SLEEP_DEFICIT')) {
        signals.push({
            category: 'Сон и восстановление',
            title: 'Дефицит сна',
            text: 'Хронический недосып повышает кортизол, нарушает метаболизм глюкозы, усиливает воспаление. Целевой минимум: 7 часов, ложиться до 23:00. Магний глицинат + мелатонин 0,5 мг за 30 минут до сна.',
            severity: 'warning',
            sources: ['questionnaire:SLEEP_DEFICIT'],
        })
    }

    if (tags.has('DEHYDRATION_RISK')) {
        signals.push({
            category: 'Гидратация',
            title: 'Недостаточное потребление воды',
            text: 'Цель — 1,5–2,5 л чистой воды в день (без учёта чая/кофе). Начинайте день со стакана воды с лимоном натощак. Зелёные чаи и травяные настои в счёт.',
            severity: 'info',
            sources: ['questionnaire:DEHYDRATION_RISK'],
        })
    }

    if (tags.has('EATING_PATTERN_ISSUE')) {
        signals.push({
            category: 'Пищевое поведение',
            title: 'Поздний ужин',
            text: 'Ужин менее чем за 2 часа до сна нарушает пищеварение, снижает качество сна и препятствует ночному липолизу. Перенесите последний приём пищи на 3+ часа до сна.',
            severity: 'warning',
            sources: ['questionnaire:EATING_PATTERN_ISSUE'],
        })
    }

    if (tags.has('DIGESTIVE')) {
        signals.push({
            category: 'Пищеварение',
            title: 'Нарушение пищеварения',
            text: 'Вздутие и тяжесть после еды — признаки ферментной недостаточности или дисбиоза. Пробиотики (5–10 млрд КОЕ/день), пищеварительные ферменты с едой, ферментированные продукты (квашеная капуста, кефир). Исключите глютен и молочку на 4 недели для теста.',
            severity: 'warning',
            sources: ['questionnaire:DIGESTIVE'],
        })
    }

    if (tags.has('GOAL_LOSE_WEIGHT')) {
        signals.push({
            category: 'Управление весом',
            title: 'Стратегия снижения веса',
            text: '3-разовое питание без перекусов — базовый принцип. Белок 1,5 г/кг веса на каждый приём. Исключить сахар, рафинированные масла, быстрые углеводы. Прерывистое голодание 16:8 рассмотреть после 4-6 недель базового питания.',
            severity: 'info',
            sources: ['questionnaire:GOAL_LOSE_WEIGHT'],
        })
    }

    // Deduplicate by title
    const seen = new Set<string>()
    return signals.filter((s) => {
        if (seen.has(s.title)) return false
        seen.add(s.title)
        return true
    })
}
