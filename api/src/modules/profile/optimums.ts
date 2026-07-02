// АВТОГЕНЕРАЦИЯ из docs/анализы (оптимумы).xlsx — собственный справочник оптимумов
// нутрициолога (решение 032). Матчинг — по точным именам, без коллизий подстрок.

export type Gender = 'male' | 'female'
export type OptRange = { min: number | null; max: number | null }

export type CatalogEntry = {
    key: string
    section: string
    display: string
    unit: string | null
    aliases: string[]
    optimum: { all?: OptRange; male?: OptRange; female?: OptRange }
}

export const SECTION_TITLES: Record<string, string> = {
    cbc: "Общий анализ крови",
    protein: "Белковый обмен",
    carb: "Углеводный обмен",
    liver: "Печень и поджелудочная",
    lipid: "Липидный профиль",
    thyroid: "Щитовидная железа",
    electrolytes: "Электролиты и минералы",
    iron: "Запасы железа",
    inflammation: "Воспаление",
    other: "Прочие показатели",
}

export const MARKER_CATALOG: CatalogEntry[] = [
    { key: 'RBC', section: 'cbc', display: "эритроциты", unit: "10^12/л", aliases: ["эритроциты"], optimum: { female: { min: 3.9, max: 4.5 }, male: { min: 4.2, max: 4.9 } } },
    { key: 'MCV', section: 'cbc', display: "средний объем эритроцита (MCV)", unit: "фемтолитры (фл)", aliases: ["mcv", "средний объем эритроцита (mcv)"], optimum: { all: { min: 82.0, max: 88.9 } } },
    { key: 'MCH', section: 'cbc', display: "среднее содержание гемоглобина в одном эритроците (MCH)", unit: "пикограммы (пг)", aliases: ["mch", "среднее содержание гемоглобина в одном эритроците (mch)"], optimum: { all: { min: 28.0, max: 31.9 } } },
    { key: 'MCHC', section: 'cbc', display: "средняя концентрация гемоглобина в эритроцитах (МСНС)", unit: "г/л", aliases: ["mchc", "средняя концентрация гемоглобина в эритроцитах (мснс)"], optimum: { all: { min: 320.0, max: 360.0 } } },
    { key: 'HGB', section: 'cbc', display: "гемоглобин", unit: "г/л", aliases: ["hb", "hgb", "гемоглобин"], optimum: { female: { min: 135.0, max: 145.0 }, male: { min: 140.0, max: 150.0 } } },
    { key: 'HCT', section: 'cbc', display: "гематокрит", unit: "%", aliases: ["hct", "гематокрит"], optimum: { female: { min: 37.0, max: 44.0 }, male: { min: 40.0, max: 48.0 } } },
    { key: 'CPU', section: 'cbc', display: "цветовой показатель", unit: null, aliases: ["цветовой показатель"], optimum: { all: { min: 0.85, max: 1.05 } } },
    { key: 'RDW', section: 'cbc', display: "процент распределения эритроцитов по величине (RDW-CV)", unit: "%", aliases: ["rdw", "rdw-cv", "процент распределения эритроцитов по величине (rdw-cv)"], optimum: { all: { min: 11.0, max: 13.0 } } },
    { key: 'PDW', section: 'cbc', display: "диапазон между самым маленьким и самым большим эритроцитом (RDW-SD)", unit: "фемтолитры (фл)", aliases: ["диапазон между самым маленьким и самым большим эритроцитом (rdw-sd)"], optimum: { all: { min: 37.0, max: 42.0 } } },
    { key: 'RETIC', section: 'cbc', display: "ретикулоциты", unit: "%", aliases: ["retic", "ретикулоциты"], optimum: { all: { min: 0.05, max: 1.5 } } },
    { key: 'PLT', section: 'cbc', display: "тромбоциты", unit: "10^9/л", aliases: ["plt", "тромбоциты"], optimum: { all: { min: 200.0, max: 385.0 } } },
    { key: 'WBC', section: 'cbc', display: "лейкоциты", unit: "10^9/л", aliases: ["wbc", "лейкоциты"], optimum: { female: { min: 4.0, max: 10.0 }, male: { min: 4.0, max: 9.0 } } },
    { key: 'NEUT_ABS', section: 'cbc', display: "нейтрофилы абс", unit: "10^9/л", aliases: ["нейтрофилы абс"], optimum: { all: { min: 2.0, max: 6.0 } } },
    { key: 'NEUT_PCT', section: 'cbc', display: "нейтрофилы %", unit: "%", aliases: ["нейтрофилы %"], optimum: { all: { min: 45.0, max: 74.0 } } },
    { key: 'EOS_ABS', section: 'cbc', display: "эозинофилы абс", unit: "10^9/л", aliases: ["эозинофилы абс"], optimum: { all: { min: 0.04, max: 0.5 } } },
    { key: 'EOS_PCT', section: 'cbc', display: "эозинофилы %", unit: "%", aliases: ["эозинофилы %"], optimum: { all: { min: 0.0, max: 2.0 } } },
    { key: 'BASO_ABS', section: 'cbc', display: "базофилы абс", unit: "10^9/л", aliases: ["базофилы абс"], optimum: { all: { min: 0.01, max: 0.09 } } },
    { key: 'BASO_PCT', section: 'cbc', display: "базофилы %", unit: "%", aliases: ["базофилы %"], optimum: { all: { min: 0.0, max: 1.0 } } },
    { key: 'LYMPH_ABS', section: 'cbc', display: "лимфоциты абс", unit: "10^9/л", aliases: ["лимфоциты абс"], optimum: { all: { min: 1.2, max: 4.5 } } },
    { key: 'LYMPH_PCT', section: 'cbc', display: "лимфоциты %", unit: "%", aliases: ["лимфоциты %"], optimum: { all: { min: 18.0, max: 40.0 } } },
    { key: 'MONO_ABS', section: 'cbc', display: "моноциты абс", unit: "10^9/л", aliases: ["моноциты абс"], optimum: { all: { min: 0.08, max: 0.6 } } },
    { key: 'MONO_PCT', section: 'cbc', display: "моноциты %", unit: "%", aliases: ["моноциты %"], optimum: { all: { min: 2.0, max: 8.0 } } },
    { key: 'ESR', section: 'cbc', display: "СОЭ", unit: "мм/ч", aliases: ["esr", "соэ"], optimum: { all: { min: 2.0, max: 6.0 } } },
    { key: 'TP', section: 'protein', display: "общий белок", unit: "г/л", aliases: ["общий белок"], optimum: { all: { min: 70.0, max: 74.0 } } },
    { key: 'ALB', section: 'protein', display: "альбумины", unit: "г/л", aliases: ["albumin", "альбумины"], optimum: { all: { min: 40.0, max: 50.0 } } },
    { key: 'GLOB', section: 'protein', display: "глобулины", unit: "г/л", aliases: ["глобулины"], optimum: { all: { min: 24.0, max: 28.0 } } },
    { key: 'UREA', section: 'protein', display: "мочевина", unit: "ммоль/л", aliases: ["urea", "мочевина"], optimum: { all: { min: 3.57, max: 5.71 } } },
    { key: 'URIC_ACID', section: 'protein', display: "мочевая кислота", unit: "мкмоль/л", aliases: ["uric acid", "мочевая кислота"], optimum: { male: { min: 208.0, max: 351.0 }, female: { min: 178.0, max: 327.0 } } },
    { key: 'CREAT', section: 'protein', display: "креатинин", unit: "мкмоль/л", aliases: ["creatinine", "креатинин"], optimum: { all: { min: 70.7, max: 97.2 } } },
    { key: 'GLUCOSE', section: 'carb', display: "глюкоза", unit: "ммоль/л", aliases: ["glu", "glucose", "глюкоза"], optimum: { all: { min: 4.16, max: 4.77 } } },
    { key: 'INSULIN', section: 'carb', display: "инсулин", unit: "мкЕД/мл", aliases: ["insulin", "инсулин"], optimum: { all: { min: 2.0, max: 5.0 } } },
    { key: 'HBA1C', section: 'carb', display: "гликированный гемоглобин", unit: "ммоль/л", aliases: ["hba1c", "гликированный гемоглобин"], optimum: { all: { min: 4.8, max: 6.2 } } },
    { key: 'LEPTIN', section: 'carb', display: "лептин", unit: "нг/мл", aliases: ["leptin", "лептин"], optimum: { male: { min: 1.2, max: 9.5 }, female: { min: 4.2, max: 4.2 } } },
    { key: 'AST', section: 'liver', display: "АСТ", unit: "ед/л", aliases: ["asat", "ast", "аст"], optimum: { all: { min: 10.0, max: 26.0 } } },
    { key: 'ALT', section: 'liver', display: "АЛТ", unit: "ед/л", aliases: ["alat", "alt", "алт"], optimum: { all: { min: 10.0, max: 26.0 } } },
    { key: 'ALP', section: 'liver', display: "ЩФ", unit: "ед/л", aliases: ["alp", "щф"], optimum: { all: { min: 70.0, max: 100.0 } } },
    { key: 'GGT', section: 'liver', display: "ГГТП", unit: "ед/л", aliases: ["ggt", "ггтп"], optimum: { all: { min: 10.0, max: 30.0 } } },
    { key: 'LDH', section: 'liver', display: "ЛДГ", unit: "ед/л", aliases: ["ldh", "лдг"], optimum: { all: { min: 140.0, max: 200.0 } } },
    { key: 'TBIL', section: 'liver', display: "общий билирубин", unit: "мкмоль/л", aliases: ["общий билирубин"], optimum: { all: { min: 5.1, max: 15.4 } } },
    { key: 'IBIL', section: 'liver', display: "непрямой билирубин", unit: "мкмоль/л", aliases: ["непрямой билирубин"], optimum: { all: { min: 1.7, max: 12.0 } } },
    { key: 'DBIL', section: 'liver', display: "прямой билирубин", unit: "мкмоль/л", aliases: ["прямой билирубин"], optimum: { all: { min: 0.0, max: 3.25 } } },
    { key: 'AMYLASE', section: 'liver', display: "альфа-амилаза", unit: "ед/л", aliases: ["amylase", "альфа-амилаза"], optimum: { all: { min: 28.0, max: 100.0 } } },
    { key: 'CHOLESTEROL', section: 'lipid', display: "общий холестерин", unit: "ммоль/л", aliases: ["cholesterol", "общий холестерин", "хс"], optimum: { all: { min: 4.14, max: 4.65 } } },
    { key: 'HDL', section: 'lipid', display: "ЛПВП", unit: "ммоль/л", aliases: ["hdl", "лпвп"], optimum: { all: { min: 1.42, max: 1.81 } } },
    { key: 'LDL', section: 'lipid', display: "ЛПНП", unit: "ммоль/л", aliases: ["ldl", "лпнп"], optimum: { all: { min: 2.07, max: 2.59 } } },
    { key: 'TRIGLYCERIDES', section: 'lipid', display: "ТГ", unit: "ммоль/л", aliases: ["triglycerides", "тг", "триглицериды"], optimum: { all: { min: 0.79, max: 0.9 } } },
    { key: 'TSH', section: 'thyroid', display: "ТТГ", unit: "мкМЕ/мл", aliases: ["tsh", "тиреотропный", "ттг"], optimum: { all: { min: 0.9, max: 1.9 } } },
    { key: 'T3_FREE', section: 'thyroid', display: "свободный Т3", unit: "пмоль/л", aliases: ["ft3", "свободный т3"], optimum: { all: { min: 4.6, max: 5.38 } } },
    { key: 'T4_FREE', section: 'thyroid', display: "свободный Т4", unit: "пмоль/л", aliases: ["ft4", "свободный т4"], optimum: { all: { min: 12.9, max: 19.0 } } },
    { key: 'T3_TOTAL', section: 'thyroid', display: "общий Т3", unit: "нмоль/л", aliases: ["общий т3"], optimum: { all: { min: 1.4, max: 2.6 } } },
    { key: 'T4_TOTAL', section: 'thyroid', display: "общий Т4", unit: "нмоль/л", aliases: ["общий т4"], optimum: { all: { min: 77.0, max: 153.0 } } },
    { key: 'RT3', section: 'thyroid', display: "реверсивный Т3", unit: "нмоль/л", aliases: ["реверсивный т3"], optimum: { all: { min: 0.15, max: 0.38 } } },
    { key: 'ANTI_TPO', section: 'thyroid', display: "АТ к ТПО", unit: "ед/мл", aliases: ["anti-tpo", "ат к тпо", "ат-тпо"], optimum: { all: { min: 0.0, max: 20.0 } } },
    { key: 'ANTI_TG', section: 'thyroid', display: "АТ к ТГ", unit: "ед/мл", aliases: ["ат к тг", "ат-тг"], optimum: { all: { min: 0.0, max: 1.0 } } },
    { key: 'ANTI_RTSH', section: 'thyroid', display: "АТ а рТТГ", unit: "ед/мл", aliases: ["ат а рттг"], optimum: { all: { min: 0.0, max: 1.75 } } },
    { key: 'SODIUM', section: 'electrolytes', display: "натрий", unit: "ммоль/л", aliases: ["sodium", "натрий"], optimum: { all: { min: 135.0, max: 142.0 } } },
    { key: 'POTASSIUM', section: 'electrolytes', display: "калий", unit: "ммоль/л", aliases: ["potassium", "калий"], optimum: { all: { min: 4.0, max: 4.5 } } },
    { key: 'CHLORIDE', section: 'electrolytes', display: "хлор", unit: "ммоль/л", aliases: ["chloride", "хлор"], optimum: { all: { min: 100.0, max: 106.0 } } },
    { key: 'MAGNESIUM', section: 'electrolytes', display: "магний", unit: "ммоль/л", aliases: ["magnesium", "магний"], optimum: { all: { min: 0.91, max: 1.04 } } },
    { key: 'CALCIUM', section: 'electrolytes', display: "кальций сывороточный", unit: "ммоль/л", aliases: ["calcium", "кальций сывороточный"], optimum: { all: { min: 2.3, max: 2.5 } } },
    { key: 'CALCIUM_ION', section: 'electrolytes', display: "кальций ионизированный", unit: "ммоль/л", aliases: ["кальций ионизированный"], optimum: { all: { min: 1.2, max: 1.4 } } },
    { key: 'PHOSPHORUS', section: 'electrolytes', display: "фосфор", unit: "ммоль/л", aliases: ["фосфор"], optimum: { all: { min: 0.97, max: 1.29 } } },
    { key: 'COPPER', section: 'electrolytes', display: "медь", unit: "мкмоль/л", aliases: ["copper", "медь"], optimum: { all: { min: 10.99, max: 27.48 } } },
    { key: 'ZINC', section: 'electrolytes', display: "цинк", unit: "мкмоль/л", aliases: ["zinc", "цинк"], optimum: { all: { min: 12.23, max: 15.29 } } },
    { key: 'IRON', section: 'iron', display: "сывороточное железо", unit: "мкмоль/л", aliases: ["iron", "железо", "сывороточное железо"], optimum: { all: { min: 15.22, max: 23.27 } } },
    { key: 'TRANSFERRIN', section: 'iron', display: "трансферрин", unit: "мкмоль/л", aliases: ["transferrin", "трансферрин"], optimum: { all: { min: 25.0, max: 46.0 } } },
    { key: 'TSAT', section: 'iron', display: "процент насыщения трансферрина", unit: "%", aliases: ["процент насыщения трансферрина"], optimum: { all: { min: 20.0, max: 30.0 } } },
    { key: 'FERRITIN', section: 'iron', display: "ферритин", unit: "мг/л", aliases: ["ferritin", "ферритин"], optimum: { all: { min: 45.0, max: 75.0 } } },
    { key: 'TIBC', section: 'iron', display: "ОЖСС", unit: "мкмоль/л", aliases: ["tibc", "ожсс"], optimum: { all: { min: 44.8, max: 62.7 } } },
    { key: 'UIBC', section: 'iron', display: "ЛЖСС", unit: "мкмоль/л", aliases: ["uibc", "лжсс"], optimum: { all: { min: 23.3, max: 53.7 } } },
    { key: 'CRP_STD', section: 'inflammation', display: "СРБ обычный", unit: "нмоль/л", aliases: ["срб обычный"], optimum: { all: { min: 0.0, max: 42.86 } } },
    { key: 'CRP', section: 'inflammation', display: "СРБ ультрачувствительный", unit: "мг/л", aliases: ["crp", "с-реактивный", "срб", "срб ультрачувствительный"], optimum: { male: { min: 0.0, max: 0.55 }, female: { min: 0.0, max: 1.5 } } },
    { key: 'HOMOCYSTEINE', section: 'inflammation', display: "гомоцистеин", unit: "мкмоль/л", aliases: ["homocysteine", "гомоцистеин"], optimum: { all: { min: 5.0, max: 7.5 } } },
    { key: 'FIBRINOGEN', section: 'inflammation', display: "фибриноген", unit: "мкмоль/л", aliases: ["fibrinogen", "фибриноген"], optimum: { all: { min: 8.67, max: 10.85 } } },
]
