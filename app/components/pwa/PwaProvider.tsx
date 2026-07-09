'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { Button, EASE_OUT } from '@/components/ds/primitives'

// beforeinstallprompt нет в lib.dom — объявляем локально
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISS_KEY = 'pwaDismissedAt'
const DISMISS_TTL_MS = 30 * 24 * 60 * 60 * 1000 // повторное предложение через 30 дней
const DWELL_MS = 25_000 // показываем после 25 секунд на сайте — человек уже освоился

// Баннер показываем только внутри приложения — не на лендинге и не в auth-флоу
const APP_PREFIXES = ['/dashboard', '/analyses', '/recommendations', '/profile', '/dynamics', '/questionnaire']

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

function isMobile(): boolean {
  return (
    /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent) ||
    window.matchMedia('(max-width: 820px)').matches
  )
}

// Регистрация service worker + полноэкранное предложение «установите как приложение».
// Мобайл-онли: Android — нативный prompt через beforeinstallprompt, iOS — инструкция
// Share → «На экран „Домой"». Появляется после DWELL_MS на сайте, закрывается на 30 дней.
export default function PwaProvider() {
  const pathname = usePathname()
  const [mode, setMode] = useState<'android' | 'ios' | null>(null)
  const [visible, setVisible] = useState(false)
  const deferredRef = useRef<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }
  }, [])

  useEffect(() => {
    if (isStandalone() || !isMobile()) return
    const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) ?? 0)
    if (Date.now() - dismissedAt < DISMISS_TTL_MS) return

    const ua = navigator.userAgent
    // iPadOS 13+ маскируется под Mac — ловим по touch
    const isIos = /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1)

    if (isIos) {
      setMode('ios')
      return
    }

    // Android: событие может прилететь в любой момент — держим его в ref
    const onBip = (e: Event) => {
      e.preventDefault()
      deferredRef.current = e as BeforeInstallPromptEvent
      setMode('android')
    }
    window.addEventListener('beforeinstallprompt', onBip)
    return () => window.removeEventListener('beforeinstallprompt', onBip)
  }, [])

  // Таймер «пожил на сайте» — стартует один раз при заходе
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), DWELL_MS)
    return () => clearTimeout(t)
  }, [])

  const inApp = APP_PREFIXES.some((p) => pathname?.startsWith(p))
  const show = visible && mode !== null && inApp

  // Полноэкранный баннер: блокируем прокрутку под ним
  useEffect(() => {
    if (!show) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [show])

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, String(Date.now()))
    setMode(null)
  }

  async function install() {
    const deferred = deferredRef.current
    if (!deferred) return
    await deferred.prompt()
    const choice = await deferred.userChoice
    if (choice.outcome === 'accepted') setMode(null)
    else dismiss()
    deferredRef.current = null
  }

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.45, ease: EASE_OUT }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 70,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 'calc(1.5rem + env(safe-area-inset-top, 0px)) 1.5rem calc(2rem + env(safe-area-inset-bottom, 0px))',
            background: 'linear-gradient(160deg, #35462f 0%, #2b3826 55%, #243020 100%)',
            overflowY: 'auto',
          }}
        >
          {/* закрыть */}
          <button
            onClick={dismiss}
            aria-label="Закрыть"
            style={{
              position: 'absolute',
              top: 'calc(14px + env(safe-area-inset-top, 0px))',
              right: 14,
              width: 44,
              height: 44,
              borderRadius: 12,
              border: '1px solid rgba(255,255,255,0.18)',
              background: 'rgba(255,255,255,0.06)',
              color: 'rgba(255,255,255,0.75)',
              cursor: 'pointer',
              fontSize: 20,
              lineHeight: 1,
            }}
          >
            ×
          </button>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: EASE_OUT, delay: 0.1 }}
            style={{ width: '100%', maxWidth: 380, textAlign: 'center' }}
          >
            <img
              src="/icon-192.png"
              alt=""
              width={88}
              height={88}
              style={{ borderRadius: 22, margin: '0 auto 22px', display: 'block', boxShadow: '0 14px 40px rgba(0,0,0,0.4)' }}
            />

            <h2
              className="font-display"
              style={{ fontWeight: 500, fontSize: 'clamp(1.7rem, 6vw, 2.1rem)', color: '#fff', lineHeight: 1.12, margin: '0 0 12px' }}
            >
              Установите как приложение
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 15, lineHeight: 1.6, margin: '0 0 28px' }}>
              Ваш профиль здоровья — на главном экране телефона. Открывается одним касанием, без браузера и адресной строки.
            </p>

            {mode === 'android' ? (
              <>
                <Button variant="gold" size="lg" onClick={() => void install()} style={{ width: '100%' }}>
                  Установить
                </Button>
                <button
                  onClick={dismiss}
                  style={{ display: 'block', margin: '18px auto 0', background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', fontFamily: 'var(--font-sans)', fontSize: 14, cursor: 'pointer', padding: '10px 16px' }}
                >
                  Не сейчас
                </button>
              </>
            ) : (
              <>
                {/* iOS: пошаговая инструкция — API установки в Safari нет */}
                <ol style={{ listStyle: 'none', margin: '0 0 24px', padding: 0, textAlign: 'left', display: 'grid', gap: 14 }}>
                  {[
                    <>
                      Нажмите кнопку{' '}
                      <span aria-label="Поделиться" style={{ display: 'inline-block', verticalAlign: '-4px', margin: '0 2px' }}>
                        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 15V3M8 7l4-4 4 4" />
                          <path d="M5 12v8a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 20v-8" />
                        </svg>
                      </span>{' '}
                      «Поделиться» на панели браузера
                    </>,
                    <>
                      Выберите <span style={{ color: '#fff' }}>«На экран „Домой"»</span>
                    </>,
                    <>
                      Нажмите <span style={{ color: '#fff' }}>«Добавить»</span> — готово
                    </>,
                  ].map((content, i) => (
                    <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                      <span
                        style={{
                          flexShrink: 0,
                          display: 'grid',
                          placeItems: 'center',
                          width: 30,
                          height: 30,
                          borderRadius: '50%',
                          border: '1px solid rgba(255,230,146,0.4)',
                          background: 'rgba(255,230,146,0.1)',
                          color: 'var(--gold)',
                          fontFamily: 'var(--font-display)',
                          fontSize: 15,
                        }}
                      >
                        {i + 1}
                      </span>
                      <span style={{ color: 'rgba(255,255,255,0.75)', fontSize: 14.5, lineHeight: 1.55, paddingTop: 4 }}>{content}</span>
                    </li>
                  ))}
                </ol>
                <Button variant="outline-gold" size="md" onClick={dismiss} style={{ width: '100%' }}>
                  Понятно
                </Button>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
