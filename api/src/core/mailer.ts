import nodemailer from 'nodemailer'
import { config } from './config.js'

export const transporter = nodemailer.createTransport({
    host:      config.SMTP_HOST,
    port:      config.SMTP_PORT,
    secure:    false,
    auth:      config.SMTP_USER ? { user: config.SMTP_USER, pass: config.SMTP_PASS } : undefined,
    ignoreTLS: config.NODE_ENV !== 'production',
})

export async function sendOtpEmail(to: string, code: string): Promise<void> {
    await transporter.sendMail({
        from:    config.SMTP_FROM,
        to,
        subject: 'Код подтверждения',
        text:    `Ваш код: ${code}\n\nКод действителен 10 минут.`,
    })
}
