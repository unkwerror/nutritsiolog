import { type Config }    from '../core/config.js'
import { type OcrService } from './OcrService.js'
import { GeminiAdapter }   from './adapters/GeminiAdapter.js'
import { MockAdapter }     from './adapters/MockAdapter.js'
import { YandexAdapter }   from './adapters/YandexAdapter.js'

export function createOcrService(config: Config): OcrService {
    switch (config.OCR_PROVIDER) {
        case 'gemini': {
            if (!config.GEMINI_API_KEY) {
                throw new Error('GEMINI_API_KEY is required when OCR_PROVIDER=gemini')
            }
            return new GeminiAdapter({ apiKey: config.GEMINI_API_KEY })
        }
        case 'mock':
            return new MockAdapter()
        case 'yandex': {
            if (!config.YANDEX_API_KEY) {
                throw new Error('YANDEX_API_KEY is required when OCR_PROVIDER=yandex')
            }
            if (!config.YANDEX_FOLDER_ID) {
                throw new Error('YANDEX_FOLDER_ID is required when OCR_PROVIDER=yandex')
            }
            return new YandexAdapter({
                apiKey:   config.YANDEX_API_KEY,
                folderId: config.YANDEX_FOLDER_ID,
            })
        }
        default:
            throw new Error(`Unknown OCR provider: ${config.OCR_PROVIDER}`)
    }
}

export type { OcrService }
