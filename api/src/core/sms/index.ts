import { config } from '../config.js'
import { type SmsPort } from './types.js'
import { SmsAeroAdapter } from './SmsAeroAdapter.js'
import { MockSmsAdapter } from './MockSmsAdapter.js'

export type { SmsPort } from './types.js'

// Фабрика по ENV — как createOcrService() (решение 007)
export function createSmsService(): SmsPort {
    switch (config.SMS_PROVIDER) {
        case 'smsaero':
            return new SmsAeroAdapter()
        case 'mock':
            return new MockSmsAdapter()
    }
}
