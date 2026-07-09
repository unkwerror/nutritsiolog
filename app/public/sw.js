// Минимальный service worker — нужен только для installability PWA
// (beforeinstallprompt на старых Android Chrome/WebView требует активный SW).
// Ничего не кэшируем: API авторизованный, контент динамический.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))
self.addEventListener('fetch', () => {})
