'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { EASE_OUT } from '@/components/ds/primitives'

// beforeinstallprompt нет в lib.dom — объявляем локально
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISS_KEY = 'pwaDismissedAt'
const DISMISS_TTL_MS = 30 * 24 * 60 * 60 * 1000 // повторное предложение через 30 дней

// Баннер показываем только внутри приложения — не на лендинге и не в auth-флоу
const APP_PREFIXES = ['/dashboard', '/analyses', '/recommendations', '/profile', '/dynamics', '/questionnaire']

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

// Регистрация service worker + подсказка «установите как приложение».
// Android: нативный prompt через beforeinstallprompt.
// iOS: инструкция Share → «На экран „Домой"» (API установки в Safari нет).
export default function PwaProvider() {
  const pathname = usePathname()
  const [mode, setMode] = useState<'android' | 'ios' | null>(null)
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }
  }, [])

  useEffect(() => {
    if (isStandalone()) return
    const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) ?? 0)
    if (Date.now() - dismissedAt < DISMISS_TTL_MS) return

    const ua = navigator.userAgent
    // iPadOS 13+ маскируется под Mac — ловим по touch
    const isIos = /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1)
    if (isIos) {
      // небольшая задержка — пусть человек сначала увидит страницу
      const t = setTimeout(() => setMode('ios'), 3500)
      return () => clearTimeout(t)
    }

    const onBip = (e: Event) => {
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
      setMode('android')
    }
    window.addEventListener('beforeinstallprompt', onBip)
    return () => window.removeEventListener('beforeinstallprompt', onBip)
  }, [])

  const inApp = APP_PREFIXES.some((p) => pathname?.startsWith(p))
  const visible = mode !== null && inApp

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, String(Date.now()))
    setMode(null)
  }

  async function install() {
    if (!deferred) return
    await deferred.prompt()
    const choice = await deferred.userChoice
    if (choice.outcome === 'accepted') setMode(null)
    else dismiss()
    setDeferred(null)
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 32 }}
          transition={{ duration: 0.4, ease: EASE_OUT }}
          style={{
            position: 'fixed',
            left: '50%',
            transform: 'translateX(-50%)',
            bottom: 'calc(clamp(0.9rem,3vw,1.5rem) + env(safe-area-inset-bottom, 0px))',
            zIndex: 60,
            width: 'min(92vw, 30rem)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 14,
              padding: '15px 16px',
              borderRadius: 18,
              background: 'linear-gradient(100deg, rgba(46,61,40,0.98), rgba(38,50,34,0.98))',
              border: '1px solid rgba(255,230,146,0.28)',
              boxShadow: '0 12px 40px rgba(0,0,0,0.45)',
              backdropFilter: 'blur(8px)',
            }}
          >
            <img src="/icon-192.png" alt="" width={42} height={42} style={{ borderRadius: 11, flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ color: '#fff', fontSize: 14.5, margin: 0, fontWeight: 500 }}>
                Установите как приложение
              </p>
              {mode === 'ios' ? (
                <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 12.5, margin: '4px 0 0', lineHeight: 1.55 }}>
                  Нажмите{' '}
                  <span aria-label="Поделиться" style={{ display: 'inline-block', verticalAlign: '-3px' }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 15V3M8 7l4-4 4 4" />
                      <path d="M5 12v8a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 20v-8" />
                    </svg>
                  </span>{' '}
                  «Поделиться» внизу экрана, затем «На экран „Домой"» — и открывайте одним касанием.
                </p>
              ) : (
                <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 12.5, margin: '4px 0 0', lineHeight: 1.5 }}>
                  Быстрый доступ с главного экрана — без браузера и адресной строки.
                </p>
              )}
              {mode === 'android' && (
                <button
                  onClick={install}
                  style={{
                    marginTop: 10,
                    padding: '9px 16px',
                    borderRadius: 10,
                    border: 'none',
                    background: 'var(--gold)',
                    color: '#2b3a24',
                    fontFamily: 'var(--font-sans)',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Установить
                </button>
              )}
            </div>
            <button
              onClick={dismiss}
              aria-label="Закрыть"
              style={{
                flexShrink: 0,
                width: 34,
                height: 34,
                borderRadius: 9,
                border: '1px solid rgba(255,255,255,0.16)',
                background: 'none',
                color: 'rgba(255,255,255,0.7)',
                cursor: 'pointer',
                fontSize: 16,
              }}
            >
              ×
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
