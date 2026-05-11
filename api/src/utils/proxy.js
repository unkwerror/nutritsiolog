import { setGlobalDispatcher } from 'undici'
import { socksDispatcher } from 'fetch-socks'

if (process.env.SOCKS_PROXY) {
    const proxyUrl = new URL(process.env.SOCKS_PROXY)
    setGlobalDispatcher(socksDispatcher({
        type: 5,
        host: proxyUrl.hostname,
        port: Number(proxyUrl.port)
    }))
}
