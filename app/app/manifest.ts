import type { MetadataRoute } from 'next'

// PWA-манифест (Next metadata route → /manifest.webmanifest, линкуется автоматически).
// Иконки — растровые PNG из монограммы бренда: полная заливка #35462f + запас
// по краям, поэтому одни и те же файлы годятся и для purpose:any, и для maskable.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Нутрициолог',
    short_name: 'Нутрициолог',
    description: 'Персональный нутрициологический профиль на основе ваших анализов и анкеты.',
    start_url: '/dashboard',
    display: 'standalone',
    background_color: '#2b3826',
    theme_color: '#35462f',
    lang: 'ru',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
