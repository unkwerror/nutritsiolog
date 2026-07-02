import { matchCatalogKey, evaluateMarker, type Evaluation } from './matcher.js'
import { SECTION_TITLES } from './optimums.js'

export type SignalFoods = { add?: string[]; avoid?: string[] }

export type Signal = {
    id: string
    category: string
    // Ключ группы для фильтрации и иконок на фронте
    categoryKey: 'nutrition' | 'vitamins' | 'metabolism' | 'hormones' | 'inflammation' | 'lifestyle'
    title: string
    // Короткое резюме (одна фраза)
    text: string
    // Развёрнутые шаги — раскрываются в карточке
    detail: string[]
    foods?: SignalFoods
    severity: 'info' | 'warning' | 'critical'
    sources: string[]
}

type MarkerResult = {
    code: string | null
    name: string
    value: string | null
    isOutOfRange: boolean
    outOfRangeDirection: 'low' | 'high' | null
    referenceMin?: string | null
    referenceMax?: string | null
    section?: string | null
}

function parseValue(v: string | null): number | null {
    if (v === null) return null
    const n = Number(v.replace(',', '.'))
    return Number.isFinite(n) ? n : null
}

// Оценка всех маркеров: по справочнику оптимумов (решение 032), а для маркеров
// без оптимума или вне справочника — по норме из распознанного бланка (fallback).
// Возвращает карту key → Evaluation (первое совпадение на ключ).
export function evaluateMarkers(
    markers: MarkerResult[],
    gender: 'male' | 'female' | null
): Map<string, Evaluation> {
    const evals = new Map<string, Evaluation>()
    for (const m of markers) {
        const labRange = {
            min: parseValue(m.referenceMin ?? null),
            max: parseValue(m.referenceMax ?? null),
            isOutOfRange: m.isOutOfRange,
            direction: m.outOfRangeDirection,
        }
        const key = matchCatalogKey(m.name, m.code)
        if (key) {
            if (evals.has(key)) continue
            const ev = evaluateMarker(key, parseValue(m.value), gender, labRange)
            if (ev) evals.set(key, ev)
        } else {
            // Маркер вне справочника — оцениваем по бланку, если есть сигнал отклонения
            const synthKey = `lab:${m.name.toLowerCase()}`
            if (evals.has(synthKey)) continue
            evals.set(synthKey, {
                key: synthKey,
                display: m.name,
                // Единый раздел «Прочие» для маркеров вне справочника, чтобы не
                // смешивать коды разделов с сырыми названиями из бланка
                section: 'other',
                isOutOfRange: m.isOutOfRange,
                direction: m.outOfRangeDirection,
                optimum: { min: labRange.min, max: labRange.max },
                source: 'lab',
            })
        }
    }
    return evals
}

export function generateSignals(
    markers: MarkerResult[],
    questionnaireTags: string[],
    gender: 'male' | 'female' | null
): Signal[] {
    const signals: Signal[] = []
    const tags = new Set(questionnaireTags)

    // Оцениваем по СОБСТВЕННЫМ оптимумам (решение 032), а не по нормам из бланка
    const evals = evaluateMarkers(markers, gender)

    const isLow = (key: string) => {
        const e = evals.get(key)
        return e?.isOutOfRange === true && e.direction === 'low'
    }
    const isHigh = (key: string) => {
        const e = evals.get(key)
        return e?.isOutOfRange === true && e.direction === 'high'
    }
    const markerMap = { has: (key: string) => evals.has(key) }
    const get = (key: string) => (evals.has(key) ? { isOutOfRange: evals.get(key)!.isOutOfRange } : undefined)

    // ── Vitamin D ──────────────────────────────────────────────────────────
    if (isLow('VIT_D')) {
        signals.push({
            id: 'vit_d_low',
            category: 'Витамины',
            categoryKey: 'vitamins',
            title: 'Дефицит витамина D',
            text: 'Уровень витамина D ниже оптимального.',
            detail: [
                'D3 с витамином K2, 2000–4000 МЕ в день.',
                'Принимать с жирной едой в первой половине дня.',
                'Регулярно бывать на солнце с открытыми руками 15+ минут (10–14 часов).',
                'Повторный контроль через 3 месяца.',
            ],
            severity: 'warning',
            sources: ['VIT_D'],
        })
    }

    // ── Iron / Ferritin ────────────────────────────────────────────────────
    if (isLow('HGB') || isLow('FERRITIN') || isLow('IRON')) {
        const src = (['HGB', 'FERRITIN', 'IRON'] as const).filter((k) => isLow(k))
        signals.push({
            id: 'iron_low',
            category: 'Кровь',
            categoryKey: 'vitamins',
            title: 'Дефицит железа',
            text: 'Показатели железа ниже оптимума.',
            detail: [
                'Витамин C с каждым приёмом пищи усиливает усвоение железа.',
                'Кофе и чай — не раньше чем через час после еды, они блокируют всасывание.',
            ],
            foods: {
                add: ['Красное мясо: баранина, говядина', 'Печень', 'Тёмная листовая зелень'],
            },
            severity: isLow('HGB') ? 'critical' : 'warning',
            sources: src,
        })
    }

    // ── B12 ────────────────────────────────────────────────────────────────
    if (isLow('B12')) {
        signals.push({
            id: 'b12_low',
            category: 'Витамины',
            categoryKey: 'vitamins',
            title: 'Дефицит витамина B12',
            text: 'Низкий B12 — частая причина усталости и тумана в голове.',
            detail: [
                'Метилкобаламин (не цианокобаламин) 1000 мкг в день под язык.',
                'Проверить уровень гомоцистеина и фолата.',
            ],
            severity: 'warning',
            sources: ['B12'],
        })
    }

    // ── Thyroid ────────────────────────────────────────────────────────────
    if (isHigh('TSH') || isLow('T4_FREE')) {
        signals.push({
            id: 'thyroid_risk',
            category: 'Щитовидная железа',
            categoryKey: 'hormones',
            title: 'Риск гипотиреоза',
            text: 'Показатели щитовидной железы требуют внимания.',
            detail: [
                'Рекомендуется консультация эндокринолога.',
                'Селен: 2–3 бразильских ореха в день.',
                'Обеспечить достаточный йод и цинк.',
            ],
            foods: { add: ['Морские водоросли', 'Морская рыба', 'Бразильские орехи'] },
            severity: 'critical',
            sources: (['TSH', 'T4_FREE'] as const).filter((k) => get(k)?.isOutOfRange),
        })
    } else if (tags.has('THYROID_RISK') && !markerMap.has('TSH')) {
        signals.push({
            id: 'thyroid_symptoms',
            category: 'Щитовидная железа',
            categoryKey: 'hormones',
            title: 'Симптомы риска гипотиреоза',
            text: 'Усталость, зябкость и выпадение волос — возможные нарушения щитовидной железы.',
            detail: ['Рекомендуем сдать ТТГ, Т4 свободный и Т3.'],
            severity: 'info',
            sources: ['questionnaire:THYROID_RISK'],
        })
    }

    // ── Cortisol / Adrenal ─────────────────────────────────────────────────
    if (isHigh('CORTISOL') || tags.has('ADRENAL_STRESS')) {
        signals.push({
            id: 'cortisol_high',
            category: 'Стресс и надпочечники',
            categoryKey: 'hormones',
            title: 'Повышенный кортизол',
            text: 'Высокий кортизол или признаки хронического стресса.',
            detail: [
                'Кофе — не более 1–2 чашек до 14:00.',
                'Адаптогены: ашваганда 300–500 мг, магний глицинат 400 мг вечером.',
                'Дыхание 4-7-8 по 10 минут перед сном, дневной отдых 15 минут.',
                'Информационная гигиена: меньше новостей и конфликтного контента.',
            ],
            severity: 'warning',
            sources: [isHigh('CORTISOL') ? 'CORTISOL' : 'questionnaire:ADRENAL_STRESS'],
        })
    }

    // ── Glucose / Insulin resistance ───────────────────────────────────────
    if (isHigh('GLUCOSE') || isHigh('INSULIN')) {
        signals.push({
            id: 'insulin_resistance',
            category: 'Метаболизм',
            categoryKey: 'metabolism',
            title: 'Риск инсулинорезистентности',
            text: 'Повышенная глюкоза или инсулин.',
            detail: [
                'Убрать перекусы, интервалы 4–5 часов между едой.',
                'Исключить быстрые углеводы; общий ГИ рациона держать ниже 45.',
                'Берберин 500 мг 2 раза в день с едой.',
                'Физическая нагрузка 15–20 минут после каждого приёма пищи.',
            ],
            foods: {
                avoid: ['Сахар и подсластители', 'Белый рис, картофель, манка', 'Фруктовые соки'],
                add: ['Гречка, киноа, амарант', 'Зелень и овощи', 'Белок с полезными жирами'],
            },
            severity: 'critical',
            sources: (['GLUCOSE', 'INSULIN'] as const).filter((k) => isHigh(k)),
        })
    }

    // ── Lipids ─────────────────────────────────────────────────────────────
    if (isHigh('CHOLESTEROL') || isHigh('LDL') || isHigh('TRIGLYCERIDES')) {
        signals.push({
            id: 'dyslipidemia',
            category: 'Сердце и сосуды',
            categoryKey: 'metabolism',
            title: 'Дислипидемия',
            text: 'Повышенные жиры крови.',
            detail: [
                'Омега-3 (EPA+DHA) 2–3 г в день.',
                'Исключить трансжиры и рафинированные масла.',
                'Добавить клетчатку: овсяные отруби, семена льна.',
            ],
            foods: {
                add: ['Жирная рыба 3 раза в неделю', 'Авокадо', 'Семена льна'],
                avoid: ['Трансжиры', 'Рафинированные масла'],
            },
            severity: isHigh('LDL') ? 'critical' : 'warning',
            sources: (['CHOLESTEROL', 'LDL', 'TRIGLYCERIDES'] as const).filter((k) => isHigh(k)),
        })
    }
    if (isLow('HDL')) {
        signals.push({
            id: 'hdl_low',
            category: 'Сердце и сосуды',
            categoryKey: 'metabolism',
            title: 'Низкий защитный холестерин (ЛПВП)',
            text: 'ЛПВП ниже нормы — повышает сердечно-сосудистый риск.',
            detail: [
                'Аэробные нагрузки 150 минут в неделю.',
                'Полезные жиры каждый день.',
            ],
            foods: { add: ['Авокадо', 'Оливковое масло Extra Virgin', 'Орехи'] },
            severity: 'warning',
            sources: ['HDL'],
        })
    }

    // ── CRP / Inflammation ─────────────────────────────────────────────────
    if (isHigh('CRP')) {
        signals.push({
            id: 'inflammation_crp',
            category: 'Воспаление',
            categoryKey: 'inflammation',
            title: 'Системное воспаление (СРБ повышен)',
            text: 'Хроническое воспаление — корень многих метаболических нарушений.',
            detail: [
                'Куркумин 500–1000 мг в день с чёрным перцем.',
                'Омега-3 обязательно.',
                'Глютен временно исключить на 4 недели.',
            ],
            foods: {
                avoid: ['Сахар', 'Рафинированные масла', 'Глютен (временно)'],
                add: ['Жирная рыба', 'Зелень и овощи', 'Куркума'],
            },
            severity: 'critical',
            sources: ['CRP'],
        })
    } else if (tags.has('INFLAMMATION')) {
        signals.push({
            id: 'inflammation_symptoms',
            category: 'Воспаление',
            categoryKey: 'inflammation',
            title: 'Симптомы воспаления',
            text: 'Боли в суставах и мышцах указывают на возможное воспаление.',
            detail: [
                'Рекомендуем сдать СРБ высокочувствительный.',
                'Уже сейчас: омега-3, куркумин, противовоспалительная диета.',
            ],
            foods: {
                avoid: ['Сахар', 'Глютен', 'Молочные продукты из коровьего молока'],
                add: ['Жирная рыба', 'Зелень', 'Полезные жиры'],
            },
            severity: 'info',
            sources: ['questionnaire:INFLAMMATION'],
        })
    }

    // ── Magnesium ──────────────────────────────────────────────────────────
    if (isLow('MAGNESIUM') || tags.has('SLEEP_QUALITY_LOW') || tags.has('MOOD_IMBALANCE')) {
        signals.push({
            id: 'magnesium_low',
            category: 'Нутриенты',
            categoryKey: 'vitamins',
            title: 'Вероятный дефицит магния',
            text: 'Магний участвует в 300+ реакциях: сон, судороги, тревожность, усталость.',
            detail: ['Магний глицинат или малат 400 мг вечером.'],
            foods: { add: ['Тёмный шоколад >70%', 'Тыквенные семечки', 'Зелёная листовая зелень'] },
            severity: 'info',
            sources: [isLow('MAGNESIUM') ? 'MAGNESIUM' : 'questionnaire'],
        })
    }

    // ── Lifestyle-based ────────────────────────────────────────────────────
    if (tags.has('SLEEP_DEFICIT')) {
        signals.push({
            id: 'sleep_deficit',
            category: 'Сон и восстановление',
            categoryKey: 'lifestyle',
            title: 'Дефицит сна',
            text: 'Недосып повышает кортизол, нарушает метаболизм глюкозы, усиливает воспаление.',
            detail: [
                'Целевой минимум 7 часов, ложиться до 23:00.',
                'Магний глицинат + мелатонин 0,5 мг за 30 минут до сна.',
                'Вечером — тёплый свет, без гаджетов за час до сна.',
            ],
            severity: 'warning',
            sources: ['questionnaire:SLEEP_DEFICIT'],
        })
    }

    if (tags.has('DEHYDRATION_RISK')) {
        signals.push({
            id: 'dehydration',
            category: 'Гидратация',
            categoryKey: 'lifestyle',
            title: 'Недостаточно воды',
            text: 'Цель — 1,5–2 л чистой воды в день между приёмами пищи.',
            detail: [
                'Начинать день со стакана тёплой воды с лимоном натощак.',
                'Пить по полстакана каждый час; травяные чаи в счёт.',
                'Не пить холодное и не запивать еду.',
            ],
            severity: 'info',
            sources: ['questionnaire:DEHYDRATION_RISK'],
        })
    }

    if (tags.has('EATING_PATTERN_ISSUE')) {
        signals.push({
            id: 'late_dinner',
            category: 'Пищевое поведение',
            categoryKey: 'nutrition',
            title: 'Поздний ужин',
            text: 'Ужин менее чем за 2 часа до сна нарушает пищеварение и ночной липолиз.',
            detail: [
                'Перенести последний приём пищи на 3–4 часа до сна.',
                'Лучшее время ужина — 19:00; твёрдые сыры на ужин не рекомендуются.',
            ],
            severity: 'warning',
            sources: ['questionnaire:EATING_PATTERN_ISSUE'],
        })
    }

    if (tags.has('DIGESTIVE')) {
        signals.push({
            id: 'digestive',
            category: 'Пищеварение',
            categoryKey: 'nutrition',
            title: 'Нарушение пищеварения',
            text: 'Вздутие и тяжесть после еды — признаки ферментной недостаточности или дисбиоза.',
            detail: [
                'Пробиотики 5–10 млрд КОЕ в день, ферменты с едой.',
                'Тщательно пережёвывать; исключить глютен и молочку на 4 недели для теста.',
            ],
            foods: { add: ['Квашеная капуста', 'Кефир (не коровий)', 'Зелень'] },
            severity: 'warning',
            sources: ['questionnaire:DIGESTIVE'],
        })
    }

    if (tags.has('GOAL_LOSE_WEIGHT')) {
        signals.push({
            id: 'weight_loss',
            category: 'Управление весом',
            categoryKey: 'metabolism',
            title: 'Стратегия снижения веса',
            text: '3-разовое питание без перекусов — базовый принцип.',
            detail: [
                'Белок 1,5 г/кг веса на каждый приём.',
                'Исключить сахар, рафинированные масла, быстрые углеводы.',
                'Интервальное голодание 16:8 рассмотреть после 4–6 недель базы.',
            ],
            severity: 'info',
            sources: ['questionnaire:GOAL_LOSE'],
        })
    }

    // Deduplicate by id
    const seen = new Set<string>()
    return signals.filter((s) => {
        if (seen.has(s.id)) return false
        seen.add(s.id)
        return true
    })
}

// Итоговый индекс здоровья 0–100 — ТОЛЬКО по объективным данным анализов
// (отклонения маркеров от оптимумов). Сигналы образа жизни из анкеты его не
// понижают: это подсказки, а не патология. Если анализов нет — score = null.
export function computeHealthScore(evals: Map<string, Evaluation>): number | null {
    if (evals.size === 0) return null
    let penalty = 0
    for (const e of evals.values()) {
        if (e.isOutOfRange) penalty += 100 / evals.size
    }
    return Math.max(20, Math.round(100 - penalty))
}

export type SectionScore = { section: string; title: string; total: number; outOfRange: number; score: number }

// Балл по каждому разделу анализов — для «журнальной» разбивки на фронте.
export function computeSectionScores(evals: Map<string, Evaluation>): SectionScore[] {
    const bySection = new Map<string, { total: number; out: number }>()
    for (const e of evals.values()) {
        const agg = bySection.get(e.section) ?? { total: 0, out: 0 }
        agg.total += 1
        if (e.isOutOfRange) agg.out += 1
        bySection.set(e.section, agg)
    }
    return [...bySection.entries()]
        .map(([section, { total, out }]) => ({
            section,
            title: SECTION_TITLES[section] ?? section,
            total,
            outOfRange: out,
            score: total > 0 ? Math.round(100 - (out / total) * 100) : 100,
        }))
        .sort((a, b) => a.score - b.score)
}
