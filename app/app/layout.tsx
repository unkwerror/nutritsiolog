import type { Metadata, Viewport } from 'next'
import { AuthProvider } from '@/lib/auth'
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
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#35462f',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body className="font-sans antialiased">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  )
}
