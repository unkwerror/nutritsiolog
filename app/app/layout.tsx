import type { Metadata, Viewport } from 'next'
import Script from 'next/script'
import { AuthProvider } from '@/lib/auth'
import PwaProvider from '@/components/pwa/PwaProvider'
// Self-hosted fonts — no build-time Google Fonts network requests
import '@fontsource-variable/commissioner'
// Playfair Display — the brand display voice (headlines + wordmark, italic accents)
import '@fontsource/playfair-display/400.css'
import '@fontsource/playfair-display/500.css'
import '@fontsource/playfair-display/600.css'
import '@fontsource/playfair-display/700.css'
import '@fontsource/playfair-display/400-italic.css'
import '@fontsource/playfair-display/500-italic.css'
import '@fontsource/playfair-display/600-italic.css'
// Cormorant Garamond — secondary serif
import '@fontsource/cormorant-garamond/300.css'
import '@fontsource/cormorant-garamond/400.css'
import '@fontsource/cormorant-garamond/500.css'
import '@fontsource/cormorant-garamond/600.css'
import '@fontsource/cormorant-garamond/300-italic.css'
import '@fontsource/cormorant-garamond/400-italic.css'
import '@fontsource/cormorant-garamond/500-italic.css'
import './globals.css'

export const metadata: Metadata = {
  title: 'Нутрициолог — персональный профиль здоровья',
  description:
    'Персональный нутрициологический профиль на основе ваших анализов и анкеты.',
  applicationName: 'Нутрициолог',
  // PWA: манифест (app/manifest.ts) Next линкует автоматически; здесь — iOS-часть.
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Нутрициолог',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#35462f',
  // Тёмный фон под вырез/статус-бар в standalone-режиме (safe-area-inset уже
  // используется в AppNav)
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <head>
        <Script id="yandex-metrika" strategy="beforeInteractive">
          {`
            (function(m,e,t,r,i,k,a){
              m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
              m[i].l=1*new Date();
              for (var j = 0; j < document.scripts.length; j++) {
                if (document.scripts[j].src === r) { return; }
              }
              k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)
            })(window, document, 'script', 'https://mc.yandex.ru/metrika/tag.js?id=110915814', 'ym');

            ym(110915814, 'init', {
              ssr: true,
              webvisor: true,
              clickmap: true,
              ecommerce: 'dataLayer',
              referrer: document.referrer,
              url: location.href,
              accurateTrackBounce: true,
              trackLinks: true
            });
          `}
        </Script>
      </head>
      <body className="font-sans antialiased">
        <noscript>
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://mc.yandex.ru/watch/110915814"
              style={{ position: 'absolute', left: '-9999px' }}
              alt=""
            />
          </div>
        </noscript>
        <AuthProvider>{children}</AuthProvider>
        <PwaProvider />
      </body>
    </html>
  )
}
