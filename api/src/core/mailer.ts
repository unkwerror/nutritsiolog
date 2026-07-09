import nodemailer from 'nodemailer'
import { config } from './config.js'

export const transporter = nodemailer.createTransport({
    host: config.SMTP_HOST,
    port: config.SMTP_PORT,
    secure: config.SMTP_PORT === 465, // 465 = SSL, 587 = STARTTLS
    auth: config.SMTP_USER ? { user: config.SMTP_USER, pass: config.SMTP_PASS } : undefined,
    ignoreTLS: config.NODE_ENV !== 'production',
})

export async function sendOtpEmail(to: string, code: string): Promise<void> {
    await transporter.sendMail({
        from: config.SMTP_FROM,
        to,
        subject: 'Код подтверждения',
        text: `Ваш код: ${code}\n\nКод действителен 10 минут.`,
    })
}

// Уведомление нутрициологу о новой заявке на консультацию (модуль lead)
export async function sendLeadEmail(input: {
    to: string
    user: { firstName: string; lastName: string; email: string | null; phone: string | null }
    message: string | null
}): Promise<void> {
    const { to, user, message } = input
    const fullName = `${user.lastName} ${user.firstName}`.trim()
    const lines = [
        `Новая заявка на индивидуальную консультацию.`,
        ``,
        `Клиент: ${fullName}`,
        `Телефон: ${user.phone ?? '—'}`,
        `Email: ${user.email ?? '—'}`,
    ]
    if (message) lines.push(``, `Сообщение:`, message)
    await transporter.sendMail({
        from: config.SMTP_FROM,
        to,
        subject: `Заявка на консультацию — ${fullName}`,
        text: lines.join('\n'),
    })
}
