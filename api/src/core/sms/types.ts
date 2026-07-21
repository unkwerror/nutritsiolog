// Порт отправки SMS (решение 027: инфраструктура за интерфейсом,
// зависимость передаётся сервису через конструктор)
export interface SmsSendContext {
    /** correlation id HTTP-запроса — связывает этапы доставки одного кода в логах */
    requestId?: string
}

export interface SmsPort {
    send(phoneE164: string, text: string, ctx?: SmsSendContext): Promise<void>
}
