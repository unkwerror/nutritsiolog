import { setGlobalDispatcher } from 'undici'
import { socksDispatcher } from 'fetch-socks'
import { config } from '../core/config.js'

// Proxy нужен только для Gemini (заблокирован в РФ). Yandex работает напрямую.
if (config.SOCKS_PROXY && config.OCR_PROVIDER === 'gemini') {
    const proxyUrl = new URL(config.SOCKS_PROXY)
    setGlobalDispatcher(
        socksDispatcher({
            type: 5,
            host: proxyUrl.hostname,
            port: Number(proxyUrl.port),
        })
    )
}
