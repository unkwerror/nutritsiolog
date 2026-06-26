import type { Metadata, Viewport } from 'next'
import { Commissioner, Cormorant_Garamond } from 'next/font/google'
import { AuthProvider } from '@/lib/auth'
import './globals.css'

const commissioner = Commissioner({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-commissioner',
  weight: ['300', '400', '500', '600', '700'],
  display: 'swap',
})

const cormorant = Cormorant_Garamond({
  subsets: ['latin', 'cyrillic'],
  weight: ['300', '400', '500', '600'],
  style: ['normal', 'italic'],
  variable: '--font-cormorant',
  display: 'swap',
})

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
    <html lang="ru" className={`${commissioner.variable} ${cormorant.variable}`}>
      <body className="font-sans antialiased">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  )
}
