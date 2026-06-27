import { fileURLToPath } from 'node:url'
import PDFDocument from 'pdfkit'
import type { UserDetail } from './schemas.js'

// Шрифты лежат в api/assets/fonts. import.meta.url указывает на этот файл и в dev
// (src/modules/admin/pdf.ts), и в prod (dist/modules/admin/pdf.js) — оба на одну
// глубину под api/, поэтому относительный путь одинаковый.
function fontFile(name: string): string {
    return fileURLToPath(new URL(`../../../assets/fonts/${name}`, import.meta.url))
}

const FONT = {
    serif: 'serif',
    serifBold: 'serif-bold',
    sans: 'sans',
    sansBold: 'sans-bold',
} as const

const COLOR = {
    forest: '#35462f',
    gold: '#ffe692',
    ink: '#1a1a1a',
    body: '#333333',
    muted: '#6d6d6d',
    line: '#e2e6dd',
    sage: '#5c7850',
    critical: '#b03a3a',
    warning: '#c08a1e',
    info: '#5c7850',
} as const

type Severity = UserDetail['recommendations']['signals'][number]['severity']
const SEVERITY: Record<Severity, { label: string; color: string }> = {
    critical: { label: 'Важно', color: COLOR.critical },
    warning: { label: 'Внимание', color: COLOR.warning },
    info: { label: 'Рекомендация', color: COLOR.info },
}

const GENDER: Record<string, string> = { male: 'Мужской', female: 'Женский' }

// ── Questionnaire value maps ─────────────────────────────────────────────────
const MAPS: Record<string, Record<string, string>> = {
    gender: { female: 'Женский', male: 'Мужской' },
    goal: {
        lose_weight: 'Снизить вес',
        maintain: 'Поддержать вес',
        gain: 'Набрать вес',
        energy_sleep: 'Энергия и сон',
        gut_health: 'Нормализовать ЖКТ',
    },
    activityLevel: {
        sedentary: 'Сидячий',
        light: 'Лёгкий',
        moderate: 'Умеренный',
        high: 'Высокий',
    },
    sleepDuration: { lt6: 'Менее 6 ч', '6-7': '6–7 ч', '7-8': '7–8 ч', gt8: 'Более 8 ч' },
    sleepQuality: {
        excellent: 'Отличное',
        normal: 'Нормальное',
        interrupted: 'Прерывистое',
        poor: 'Плохое',
    },
    bedtime: { before_23: 'До 23:00', '23-00': '23:00–00:00', after_00: 'После 00:00' },
    mealsPerDay: { '1-2': '1–2', '3': '3', '4-5': '4–5', gt5: 'Более 5' },
    dinnerToSleep: { lt2h: 'Менее 2 ч', '2-3h': '2–3 ч', gt3h: 'Более 3 ч' },
    waterLiters: { 'lt1.5': 'Менее 1,5 л', '1.5-2': '1,5–2 л', gt2: 'Более 2 л' },
    caffeine: { '0': 'Не пью', '1-2': '1–2 чашки', '3-4': '3–4 чашки', gt5: '5+ чашек' },
    smoking: { no: 'Нет', quit: 'Бросил(а)', yes: 'Да' },
    emotionalEating: { never: 'Никогда', rarely: 'Редко', often: 'Часто', always: 'Постоянно' },
    medications: {
        no: 'Не принимает',
        hormones: 'Гормоны',
        blood_pressure: 'От давления',
        sugar: 'От сахара',
        other: 'Другие',
    },
    supplements: { no: 'Нет', sometimes: 'Иногда', regular: 'Регулярно' },
    cycleStatus: {
        regular: 'Регулярный',
        irregular: 'Нерегулярный',
        menopause: 'Менопауза',
        pregnancy: 'Беременность',
    },
    pms: { none: 'Нет', moderate: 'Умеренный', severe: 'Сильный' },
}
const SYMPTOMS: Record<string, string> = {
    fatigue: 'Усталость',
    bloating: 'Вздутие',
    gut_issues: 'Нестабильный стул',
    hair_skin_nails: 'Волосы/кожа/ногти',
    edema: 'Отёки',
    mood_anxiety: 'Настроение/тревога',
    headaches_brainfog: 'Головные боли/туман',
    low_immunity: 'Иммунитет',
    joint_muscle_pain: 'Суставы/мышцы',
    cold_extremities: 'Зябкость',
}
// Поля анкеты в порядке вывода: [ключ, подпись, единица?]
const Q_FIELDS: [string, string, string?][] = [
    ['gender', 'Пол'],
    ['heightCm', 'Рост', ' см'],
    ['weightKg', 'Вес', ' кг'],
    ['waistCm', 'Талия', ' см'],
    ['goal', 'Главная цель'],
    ['activityLevel', 'Активность'],
    ['sleepDuration', 'Длительность сна'],
    ['sleepQuality', 'Качество сна'],
    ['bedtime', 'Отход ко сну'],
    ['mealsPerDay', 'Приёмов пищи'],
    ['dinnerToSleep', 'Ужин до сна'],
    ['waterLiters', 'Вода в день'],
    ['caffeine', 'Кофе/чай'],
    ['smoking', 'Курение'],
    ['emotionalEating', 'Эмоц. переедание'],
    ['medications', 'Лекарства'],
    ['supplements', 'Витамины / БАД'],
    ['cycleStatus', 'Цикл'],
    ['pms', 'ПМС'],
]

function pluralRu(n: number, forms: [string, string, string]): string {
    const mod10 = n % 10
    const mod100 = n % 100
    if (mod10 === 1 && mod100 !== 11) return forms[0]
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return forms[1]
    return forms[2]
}
function fmtDateTime(d: Date): string {
    return new Intl.DateTimeFormat('ru-RU', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    }).format(d)
}
function fmtBirth(iso: string): string {
    return new Intl.DateTimeFormat('ru-RU', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    }).format(new Date(`${iso}T00:00:00`))
}
function fmtDate(d: Date): string {
    return new Intl.DateTimeFormat('ru-RU', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    }).format(d)
}
function trimNumeric(v: string | null): string {
    if (v == null) return '—'
    return v.includes('.') ? v.replace(/\.?0+$/, '') : v
}
function ageFrom(iso: string | null): number | null {
    if (!iso) return null
    const dob = new Date(`${iso}T00:00:00`)
    if (Number.isNaN(dob.getTime())) return null
    const now = new Date()
    let age = now.getFullYear() - dob.getFullYear()
    const m = now.getMonth() - dob.getMonth()
    if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--
    return age
}
function answerText(key: string, raw: unknown): string | null {
    if (raw == null || raw === '') return null
    const v = String(raw)
    return MAPS[key]?.[v] ?? v
}

/** Рендерит нутрициологический профиль пользователя в PDF (анкета + анализы + рекомендации). */
export function buildProfilePdf(
    data: UserDetail,
    answers: Record<string, unknown> | null
): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const u = data.user
        const doc = new PDFDocument({
            size: 'A4',
            margin: 48,
            info: {
                Title: `Нутрициологический профиль — ${u.lastName} ${u.firstName}`,
                Author: 'Нутрициолог',
            },
        })

        doc.registerFont(FONT.serif, fontFile('NotoSerif-Regular.ttf'))
        doc.registerFont(FONT.serifBold, fontFile('NotoSerif-Bold.ttf'))
        doc.registerFont(FONT.sans, fontFile('NotoSans-Regular.ttf'))
        doc.registerFont(FONT.sansBold, fontFile('NotoSans-Bold.ttf'))

        const chunks: Buffer[] = []
        doc.on('data', (c: Buffer) => chunks.push(c))
        doc.on('end', () => resolve(Buffer.concat(chunks)))
        doc.on('error', reject)

        const left = doc.page.margins.left
        const width = doc.page.width - left - doc.page.margins.right

        const bottomY = () => doc.page.height - doc.page.margins.bottom
        // Резервирует блок высотой h на текущей странице; если не влезает — новая.
        // Без этого строки с явными y «расползаются» по одной на страницу.
        const ensure = (h: number) => {
            if (doc.y + h > bottomY()) doc.addPage()
        }
        // Обрезает текст по ширине с многоточием (для текущего шрифта/кегля).
        const fitText = (text: string, maxW: number): string => {
            if (doc.widthOfString(text) <= maxW) return text
            let t = text
            while (t.length > 1 && doc.widthOfString(`${t}…`) > maxW) t = t.slice(0, -1)
            return `${t}…`
        }

        const sectionTitle = (t: string) => {
            doc.moveDown(0.9)
            doc.font(FONT.serifBold).fontSize(14).fillColor(COLOR.forest).text(t, left, doc.y)
            doc.moveDown(0.1)
            doc.strokeColor(COLOR.line)
                .lineWidth(1)
                .moveTo(left, doc.y)
                .lineTo(left + width, doc.y)
                .stroke()
            doc.moveDown(0.5)
        }
        // строка «ключ … значение» (значение справа)
        const kvRow = (k: string, v: string, valueColor = COLOR.ink) => {
            ensure(18)
            const top = doc.y
            doc.font(FONT.sans)
                .fontSize(9.5)
                .fillColor(COLOR.muted)
                .text(k, left, top, { width: width * 0.48, lineBreak: false })
            doc.font(FONT.sans)
                .fontSize(9.5)
                .fillColor(valueColor)
                .text(v, left + width * 0.48, top, {
                    width: width * 0.52,
                    align: 'right',
                    lineBreak: false,
                })
            doc.y = top + 17 // фиксированная высота строки — не даёт разрыву по странице
            doc.strokeColor('#eef1ea')
                .lineWidth(0.5)
                .moveTo(left, doc.y - 5)
                .lineTo(left + width, doc.y - 5)
                .stroke()
        }

        // ── Шапка ────────────────────────────────────────────────────────────
        doc.rect(0, 0, doc.page.width, 116).fill(COLOR.forest)
        doc.fillColor(COLOR.gold)
            .font(FONT.serifBold)
            .fontSize(22)
            .text('Нутрициологический профиль', left, 40)
        doc.fillColor('#ffffff')
            .fillOpacity(0.7)
            .font(FONT.sans)
            .fontSize(9)
            .text(`Сформировано ${fmtDateTime(new Date())}`, left, 76)
            .fillOpacity(1)
        doc.y = 140

        // ── Пациент ──────────────────────────────────────────────────────────
        const fio = [u.lastName, u.firstName, u.middleName].filter(Boolean).join(' ')
        doc.fillColor(COLOR.ink).font(FONT.serifBold).fontSize(16).text(fio, left, doc.y)
        doc.moveDown(0.25)
        const meta: string[] = []
        if (u.gender) meta.push(GENDER[u.gender] ?? u.gender)
        const age = ageFrom(u.dateOfBirth)
        if (u.dateOfBirth)
            meta.push(
                `${fmtBirth(u.dateOfBirth)}${age != null ? ` · ${age} ${pluralRu(age, ['год', 'года', 'лет'])}` : ''}`
            )
        if (u.email) meta.push(u.email)
        if (u.phone) meta.push(u.phone)
        doc.font(FONT.sans)
            .fontSize(10)
            .fillColor(COLOR.muted)
            .text(meta.join('   ·   '), { width })

        // ── Анкета ───────────────────────────────────────────────────────────
        sectionTitle('Анкета')
        if (!answers || Object.keys(answers).length === 0) {
            doc.font(FONT.sans)
                .fontSize(10)
                .fillColor(COLOR.muted)
                .text('Анкета не заполнена.', { width })
        } else {
            if (age != null) kvRow('Возраст', `${age} ${pluralRu(age, ['год', 'года', 'лет'])}`)
            for (const [key, label, unit] of Q_FIELDS) {
                const txt = answerText(key, answers[key])
                if (txt == null) continue
                kvRow(label, unit ? `${txt}${unit}` : txt)
            }
            const symptoms = Array.isArray(answers['symptoms'])
                ? (answers['symptoms'] as unknown[])
                : []
            doc.moveDown(0.2)
            doc.font(FONT.sansBold)
                .fontSize(8)
                .fillColor(COLOR.sage)
                .text('ЖАЛОБЫ И СИМПТОМЫ', left, doc.y, { characterSpacing: 1 })
            doc.moveDown(0.25)
            const symText = symptoms.length
                ? symptoms.map((s) => SYMPTOMS[String(s)] ?? String(s)).join(' · ')
                : 'Не отмечены'
            doc.font(FONT.sans)
                .fontSize(9.5)
                .fillColor(COLOR.body)
                .text(symText, left, doc.y, { width })
        }

        // ── Анализы (все) ────────────────────────────────────────────────────
        sectionTitle('Анализы')
        if (data.analyses.length === 0) {
            doc.font(FONT.sans)
                .fontSize(10)
                .fillColor(COLOR.muted)
                .text('Анализы не загружены.', { width })
        } else {
            for (const a of data.analyses) {
                ensure(40) // заголовок анализа + хотя бы одна строка маркера
                doc.moveDown(0.4)
                const head = [a.labName ?? 'Анализ', fmtDate(new Date(a.createdAt))].join('  ·  ')
                doc.font(FONT.sansBold)
                    .fontSize(8)
                    .fillColor(COLOR.sage)
                    .text(head.toUpperCase(), left, doc.y, { characterSpacing: 0.8 })
                doc.moveDown(0.3)
                if (a.markers.length === 0) {
                    doc.font(FONT.sans)
                        .fontSize(9)
                        .fillColor(COLOR.muted)
                        .text(
                            a.status === 'done' ? 'Маркеры не распознаны' : 'Идёт распознавание…',
                            { width }
                        )
                    continue
                }
                for (const m of a.markers) {
                    ensure(15)
                    const top = doc.y
                    const valueText = `${trimNumeric(m.value)} ${m.unit ?? ''}`.trim()
                    const dir = m.outOfRangeDirection
                    const color = m.isOutOfRange
                        ? dir === 'high'
                            ? COLOR.critical
                            : COLOR.warning
                        : COLOR.muted
                    // значение справа — сперва меряем ширину
                    doc.font(m.isOutOfRange ? FONT.sansBold : FONT.sans)
                        .fontSize(9.5)
                        .fillColor(color)
                    const tw = doc.widthOfString(valueText)
                    const textX = left + width - tw
                    if (m.isOutOfRange && (dir === 'high' || dir === 'low')) {
                        const tx = textX - 12
                        const ty = top + 2
                        doc.save().fillColor(color)
                        if (dir === 'high')
                            doc.moveTo(tx, ty + 7)
                                .lineTo(tx + 7, ty + 7)
                                .lineTo(tx + 3.5, ty)
                                .fill()
                        else
                            doc.moveTo(tx, ty)
                                .lineTo(tx + 7, ty)
                                .lineTo(tx + 3.5, ty + 7)
                                .fill()
                        doc.restore()
                    }
                    doc.fillColor(color).text(valueText, textX, top, { lineBreak: false })
                    // имя слева — на той же строке, обрезаем чтобы не залезть на значение
                    doc.font(FONT.sans).fontSize(9.5).fillColor(COLOR.ink)
                    doc.text(fitText(m.name, textX - left - 22), left, top, { lineBreak: false })
                    doc.y = top + 15 // фиксированная высота строки маркера
                }
            }
        }

        // ── Рекомендации ─────────────────────────────────────────────────────
        sectionTitle('Рекомендации')
        const signals = data.recommendations.signals
        if (signals.length === 0) {
            doc.font(FONT.sans)
                .fontSize(10)
                .fillColor(COLOR.muted)
                .text('Недостаточно данных для рекомендаций.', { width })
        } else {
            for (const s of signals) {
                ensure(52) // заголовок + ярлык + первые строки текста
                const top = doc.y
                const sev = SEVERITY[s.severity]
                doc.circle(left + 4, top + 6, 3).fill(sev.color)
                doc.fillColor(COLOR.ink)
                    .font(FONT.serifBold)
                    .fontSize(11)
                    .text(s.title, left + 16, top, { width: width - 16 })
                doc.font(FONT.sansBold)
                    .fontSize(7)
                    .fillColor(sev.color)
                    .text(
                        `${s.category.toUpperCase()} · ${sev.label.toUpperCase()}`,
                        left + 16,
                        doc.y,
                        { characterSpacing: 0.6 }
                    )
                doc.moveDown(0.15)
                doc.font(FONT.sans)
                    .fontSize(9.5)
                    .fillColor(COLOR.body)
                    .text(s.text, left + 16, doc.y, { width: width - 16, lineGap: 1.5 })
                doc.moveDown(0.7)
            }
        }

        // ── Дисклеймер ───────────────────────────────────────────────────────
        doc.moveDown(1.2)
        doc.font(FONT.sans)
            .fontSize(8)
            .fillColor(COLOR.muted)
            .text(
                'Рекомендации носят информационный характер и не заменяют консультацию врача. ' +
                    'Перед изменением рациона, приёмом добавок или препаратов проконсультируйтесь со специалистом.',
                left,
                doc.y,
                { width }
            )

        doc.end()
    })
}
