// Порт отправки SMS (решение 027: инфраструктура за интерфейсом,
// зависимость передаётся сервису через конструктор)
export interface SmsPort {
    send(phoneE164: string, text: string): Promise<void>
}
