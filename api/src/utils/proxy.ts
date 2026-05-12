import { setGlobalDispatcher } from 'undici'
import { socksDispatcher }     from 'fetch-socks'
import { config }              from '../core/config.js'

if (config.SOCKS_PROXY) {
    const proxyUrl = new URL(config.SOCKS_PROXY)
    setGlobalDispatcher(socksDispatcher({
        type: 5,
        host: proxyUrl.hostname,
        port: Number(proxyUrl.port)
    }))
}
