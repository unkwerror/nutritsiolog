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

const GENDER: Record<'male' | 'female', string> = { male: 'Мужской', female: 'Женский' }

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

// numeric(12,4) приходит строкой с хвостовыми нулями ("14.2000") — убираем их.
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

/** Рендерит нутрициологический профиль пользователя в PDF и возвращает Buffer. */
export function buildProfilePdf(data: UserDetail): Promise<Buffer> {
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

        const rule = () => {
            doc.moveDown(0.7)
            doc.strokeColor(COLOR.line)
                .lineWidth(1)
                .moveTo(left, doc.y)
                .lineTo(left + width, doc.y)
                .stroke()
            doc.moveDown(0.7)
        }
        const sectionTitle = (t: string) => {
            doc.font(FONT.serifBold).fontSize(13).fillColor(COLOR.forest).text(t, left, doc.y)
            doc.moveDown(0.4)
        }

        // ── Шапка (forest-баннер + золотой заголовок) ────────────────────────
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
        if (u.gender) meta.push(GENDER[u.gender])
        const age = ageFrom(u.dateOfBirth)
        if (u.dateOfBirth) {
            const agePart = age != null ? ` · ${age} ${pluralRu(age, ['год', 'года', 'лет'])}` : ''
            meta.push(`${fmtBirth(u.dateOfBirth)}${agePart}`)
        }
        if (u.email) meta.push(u.email)
        if (u.phone) meta.push(u.phone)
        doc.font(FONT.sans)
            .fontSize(10)
            .fillColor(COLOR.muted)
            .text(meta.join('   ·   '), { width })

        // ── Рекомендации ─────────────────────────────────────────────────────
        rule()
        sectionTitle('Рекомендации')

        const signals = data.recommendations.signals
        if (signals.length === 0) {
            doc.font(FONT.sans)
                .fontSize(10)
                .fillColor(COLOR.muted)
                .text(
                    'Недостаточно данных для рекомендаций. Нужны загруженные анализы и заполненная анкета.',
                    { width }
                )
        } else {
            const byCategory = new Map<string, typeof signals>()
            for (const s of signals) {
                const list = byCategory.get(s.category) ?? []
                list.push(s)
                byCategory.set(s.category, list)
            }

            for (const [category, list] of byCategory) {
                doc.moveDown(0.5)
                doc.font(FONT.sansBold)
                    .fontSize(8)
                    .fillColor(COLOR.sage)
                    .text(category.toUpperCase(), left, doc.y, { characterSpacing: 1 })
                doc.moveDown(0.3)

                for (const s of list) {
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
                        .text(sev.label.toUpperCase(), left + 16, doc.y, { characterSpacing: 0.8 })
                    doc.moveDown(0.15)
                    doc.font(FONT.sans)
                        .fontSize(9.5)
                        .fillColor(COLOR.body)
                        .text(s.text, left + 16, doc.y, { width: width - 16, lineGap: 1.5 })
                    doc.moveDown(0.7)
                }
            }
        }

        // ── Отклонения в анализах ────────────────────────────────────────────
        const flagged = data.analyses.flatMap((a) => a.markers).filter((m) => m.isOutOfRange)
        if (flagged.length > 0) {
            rule()
            sectionTitle('Отклонения в анализах')
            for (const m of flagged) {
                const top = doc.y
                doc.font(FONT.sans)
                    .fontSize(9.5)
                    .fillColor(COLOR.ink)
                    .text(m.name, left, top, { width: width * 0.62 })
                const nameBottom = doc.y

                const dir = m.outOfRangeDirection
                const valueText = `${trimNumeric(m.value)} ${m.unit ?? ''}`.trim()
                const color = dir === 'high' ? COLOR.critical : COLOR.warning

                // Значение прижато вправо; направление — нарисованный треугольник
                // (надёжнее юникод-стрелки, которой может не быть в шрифте).
                doc.font(FONT.sansBold).fontSize(9.5)
                const textWidth = doc.widthOfString(valueText)
                const textX = left + width - textWidth
                if (dir === 'high' || dir === 'low') {
                    const tx = textX - 12
                    const ty = top + 1.5
                    doc.save().fillColor(color)
                    if (dir === 'high') {
                        doc.moveTo(tx, ty + 7)
                            .lineTo(tx + 7, ty + 7)
                            .lineTo(tx + 3.5, ty)
                            .fill()
                    } else {
                        doc.moveTo(tx, ty)
                            .lineTo(tx + 7, ty)
                            .lineTo(tx + 3.5, ty + 7)
                            .fill()
                    }
                    doc.restore()
                }
                doc.fillColor(color).text(valueText, textX, top, { lineBreak: false })

                doc.y = Math.max(nameBottom, doc.y)
                doc.moveDown(0.35)
            }
        }

        // ── Сигналы из анкеты ────────────────────────────────────────────────
        if (data.questionnaire && data.questionnaire.tags.length > 0) {
            rule()
            sectionTitle('Сигналы из анкеты')
            doc.font(FONT.sans)
                .fontSize(9)
                .fillColor(COLOR.muted)
                .text(data.questionnaire.tags.join('  ·  '), left, doc.y, { width })
        }

        // ── Дисклеймер ───────────────────────────────────────────────────────
        doc.moveDown(1.5)
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
