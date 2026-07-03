'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { apiRequest, getAccessToken } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { AppBackground, AppNav, ProgressRing, AnimatedNumber, Icon } from '@/components/ds/AppCommon'
import { Button, StatusBadge, FadeUp, EASE_OUT } from '@/components/ds/primitives'
import { formatDate, analysisName } from '@/lib/format'
import { useAnalysesLive, type LiveState } from '@/lib/useAnalysesLive'

type AnalysisStatus = 'pending' | 'processing' | 'done' | 'failed'
type AnalysisListItem = {
  id: number
  status: AnalysisStatus
  detectedTypes: string[] | null
  analysisType: string | null
  labName: string | null
  createdAt: string
  patientName: string | null
}

function greeting(): string {
  const h = new Date().getHours()
  return h < 6 ? 'Доброй ночи' : h < 12 ? 'Доброе утро' : h < 18 ? 'Добрый день' : 'Добрый вечер'
}
function today(): string {
  return new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
}

export default function DashboardPage() {
  const router = useRouter()
  const reduce = useReducedMotion()
  const { user, isLoading: authLoading } = useAuth()
  const [analyses, setAnalyses] = useState<AnalysisListItem[]>([])
  const [hasQuestionnaire, setHasQuestionnaire] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  // Дата/приветствие зависят от локального времени — считаем только на клиенте
  // (в useEffect), иначе SSR/клиент могут разойтись → hydration mismatch.
  const [greetingLine, setGreetingLine] = useState('')

  useEffect(() => {
    setGreetingLine(`${greeting()} · ${today()}`)
  }, [])

  useEffect(() => {
    if (!authLoading && !user && !getAccessToken()) router.replace('/auth')
  }, [authLoading, user, router])

  const loadAnalyses = useCallback(() => {
    setLoaded(false)
    setLoadError(false)
    apiRequest<AnalysisListItem[]>('/api/v1/analysis')
      .then((list) => setAnalyses(Array.isArray(list) ? list : []))
      .catch(() => setLoadError(true))
      .finally(() => setLoaded(true))
  }, [])

  // Тихая перезагрузка (без скелетона) — для авторефреша по завершении анализа
  const refreshAnalysesSilent = useCallback(() => {
    apiRequest<AnalysisListItem[]>('/api/v1/analysis')
      .then((list) => setAnalyses(Array.isArray(list) ? list : []))
      .catch(() => {})
  }, [])

  const [toast, setToast] = useState<{ status: 'done' | 'failed' } | null>(null)
  // Живой процент выполнения + авто-обновление списка по завершении
  const live = useAnalysesLive(analyses, (_id, status) => {
    refreshAnalysesSilent()
    setToast({ status })
  })

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 9000)
    return () => clearTimeout(t)
  }, [toast])

  useEffect(() => {
    if (!getAccessToken()) return
    loadAnalyses()
    apiRequest<{ id: number } | null>('/api/v1/questionnaire/my')
      .then((q) => setHasQuestionnaire(!!q))
      .catch(() => setHasQuestionnaire(false))
    // Проба админ-доступа. НЕ кэшируем в sessionStorage: кэш переживал смену
    // аккаунта в одной вкладке, и не-админ после сессии админа видел консоль.
    // /admin/me отдаёт 403 не-админам (allowlist по email на сервере).
    sessionStorage.removeItem('isAdmin') // чистим старый кэш
    apiRequest('/api/v1/admin/me')
      .then(() => setIsAdmin(true))
      .catch(() => setIsAdmin(false))
  }, [loadAnalyses])

  const analysisCount = analyses.length
  const hasDone = analyses.some((a) => a.status === 'done')
  const firstName = user?.firstName ?? user?.email?.split('@')[0] ?? ''
  const completeness = 20 + (hasQuestionnaire ? 40 : 0) + (analysisCount > 0 ? 40 : 0)

  const steps = [
    { key: 'q', n: '01', icon: 'survey', title: 'Анкета', to: '/questionnaire', done: hasQuestionnaire, status: hasQuestionnaire ? 'Заполнена' : 'Не заполнена', cta: hasQuestionnaire ? 'Изменить' : 'Заполнить', nextLabel: 'Заполните анкету о здоровье' },
    { key: 'a', n: '02', icon: 'lab', title: 'Анализы', to: '/analyses', done: analysisCount > 0, status: analysisCount > 0 ? `${analysisCount} загружено` : 'Нет анализов', cta: analysisCount > 0 ? 'Смотреть' : 'Загрузить', nextLabel: 'Загрузите свои анализы' },
    { key: 'r', n: '03', icon: 'insight', title: 'Рекомендации', to: '/recommendations', done: hasDone && hasQuestionnaire, status: hasDone ? 'Доступны' : 'Нужны данные', cta: 'Смотреть', nextLabel: 'Откройте рекомендации' },
  ]
  const next = steps.find((s) => !s.done)

  return (
    <main style={{ position: 'relative', minHeight: '100vh' }}>
      <AppBackground glow="20%" />
      <div style={{ position: 'relative', zIndex: 1 }}>
        <AppNav completeness={completeness} userInitial={(firstName[0] ?? 'И').toUpperCase()} />
        <div style={{ maxWidth: '60rem', margin: '0 auto', padding: 'clamp(2.5rem,6vw,4.5rem) clamp(1.25rem,5vw,3rem) 7rem' }}>
          <FadeUp style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap', marginBottom: 'clamp(2.5rem,5vw,3.5rem)' }}>
            <div>
              <p className="eyebrow" style={{ marginBottom: 14 }}>
                {greetingLine || ' '}
              </p>
              <h1 className="font-display" style={{ fontWeight: 500, fontSize: 'clamp(2.4rem,6vw,4rem)', color: '#fff', lineHeight: 1.0, margin: 0 }}>
                {firstName || 'Профиль'}
              </h1>
            </div>
            <ProgressRing value={completeness} size={104} stroke={6}>
              <div style={{ textAlign: 'center' }}>
                <div className="font-display" style={{ fontSize: 26, color: '#fff', lineHeight: 1 }}>
                  <AnimatedNumber value={completeness} suffix="%" />
                </div>
                <div style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>профиль</div>
              </div>
            </ProgressRing>
          </FadeUp>

          {next && (
            <FadeUp delay={0.08}>
              <motion.button
                onClick={() => router.push(next.to)}
                className="next-banner"
                whileHover={reduce ? undefined : { y: -2 }}
                whileTap={reduce ? undefined : { scale: 0.985 }}
                transition={{ duration: 0.2, ease: EASE_OUT }}
                style={{ width: '100%', textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 18, padding: '1.25rem 1.5rem', marginBottom: 32, borderRadius: 16, background: 'linear-gradient(100deg, rgba(255,230,146,0.14), rgba(255,230,146,0.05))', border: '1px solid rgba(255,230,146,0.28)' }}
              >
                <span style={{ display: 'grid', placeItems: 'center', width: 46, height: 46, borderRadius: 12, background: 'rgba(255,230,146,0.12)', flexShrink: 0 }}>
                  <Icon name={next.icon} size={24} />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(255,230,146,0.8)', marginBottom: 3 }}>Следующий шаг</div>
                  <div className="font-display" style={{ fontSize: 'clamp(17px, 4.6vw, 20px)', color: '#fff' }}>{next.nextLabel}</div>
                </div>
                <span className="next-arrow" style={{ color: 'var(--gold)', fontSize: 22, flexShrink: 0 }}>→</span>
              </motion.button>
            </FadeUp>
          )}

          <div className="journey-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            {steps.map((s, i) => (
              <FadeUp key={s.key} delay={0.14 + i * 0.07} style={{ height: '100%' }}>
                <motion.button
                  onClick={() => router.push(s.to)}
                  className="journey-card"
                  whileHover={reduce ? undefined : { y: -4 }}
                  whileTap={reduce ? undefined : { scale: 0.98 }}
                  transition={{ duration: 0.22, ease: EASE_OUT }}
                  style={{ width: '100%', height: '100%', textAlign: 'left', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 14, padding: '1.5rem', borderRadius: 18, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ display: 'grid', placeItems: 'center', width: 48, height: 48, borderRadius: 13, background: s.done ? 'rgba(255,230,146,0.14)' : 'rgba(255,255,255,0.05)', border: `1px solid ${s.done ? 'rgba(255,230,146,0.3)' : 'rgba(255,255,255,0.1)'}` }}>
                      <Icon name={s.icon} size={26} color={s.done ? 'var(--gold)' : 'rgba(255,255,255,0.55)'} />
                    </span>
                    <span className="font-display" style={{ fontSize: 38, color: 'rgba(255,230,146,0.13)', lineHeight: 1 }}>{s.n}</span>
                  </div>
                  <div>
                    <h3 className="font-display" style={{ fontWeight: 500, fontSize: 24, color: '#fff', margin: '0 0 6px' }}>{s.title}</h3>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13, color: s.done ? 'rgba(255,230,146,0.85)' : 'rgba(255,255,255,0.62)' }}>
                      {s.done && <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--gold)' }} />}
                      {s.status}
                    </span>
                  </div>
                  <span className="card-cta" style={{ marginTop: 'auto', display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.7)' }}>
                    {s.cta} <span className="card-arrow">→</span>
                  </span>
                </motion.button>
              </FadeUp>
            ))}
          </div>

          <FadeUp delay={0.3} style={{ marginTop: 'clamp(3rem,6vw,4.5rem)' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginBottom: 18 }}>
              <h2 className="font-display" style={{ fontWeight: 500, fontSize: 22, color: '#fff', margin: 0 }}>Последние анализы</h2>
              {analysisCount > 0 && (
                <Link href="/analyses" style={{ fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,230,146,0.8)', cursor: 'pointer', textDecoration: 'none', padding: '10px 2px', whiteSpace: 'nowrap' }}>
                  Все анализы →
                </Link>
              )}
            </div>
            {!loaded ? (
              <div aria-label="Загрузка" role="status">
                {[0, 1].map((i) => (
                  <div key={i} className="shimmer" style={{ height: 62, borderRadius: 12, marginBottom: 8 }} />
                ))}
              </div>
            ) : loadError ? (
              <div style={{ borderRadius: 16, padding: '2rem 1.5rem', textAlign: 'center', background: 'rgba(255,120,100,0.06)', border: '1px solid rgba(255,120,100,0.22)' }}>
                <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, margin: '0 0 16px' }}>Не удалось загрузить данные</p>
                <Button variant="outline-gold" size="sm" onClick={loadAnalyses}>
                  Повторить
                </Button>
              </div>
            ) : analysisCount === 0 ? (
              <div style={{ borderRadius: 16, padding: '2.25rem 1.5rem 2.5rem', textAlign: 'center', background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(255,255,255,0.14)' }}>
                <img src="/assets/brand/sprout-ring.svg" alt="" aria-hidden="true" width={76} height={76} style={{ display: 'block', margin: '0 auto 14px', opacity: 0.9 }} />
                <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 14, margin: '0 0 18px', lineHeight: 1.5 }}>
                  Вы ещё не загрузили ни одного анализа.
                  <br />
                  Начните — и профиль начнёт расти.
                </p>
                <Button variant="gold" size="sm" onClick={() => router.push('/analyses/upload')}>
                  Загрузить анализ
                </Button>
              </div>
            ) : (
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                {analyses.slice(0, 3).map((a, i) => (
                  <motion.li
                    key={a.id}
                    initial={{ opacity: 0, y: reduce ? 0 : 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, ease: EASE_OUT, delay: Math.min(i * 0.07, 0.21) }}
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}
                  >
                    <Link href={`/analyses/${a.id}`} className="analysis-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '1rem 0.5rem', cursor: 'pointer', borderRadius: 8, textDecoration: 'none' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
                        <span style={{ display: 'grid', placeItems: 'center', width: 38, height: 38, borderRadius: 10, background: 'rgba(255,255,255,0.05)', flexShrink: 0 }}>
                          <Icon name="lab" size={20} color="rgba(255,255,255,0.6)" />
                        </span>
                        <div style={{ minWidth: 0 }}>
                          <p style={{ color: '#fff', fontSize: 14, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{analysisName(a)}</p>
                          <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13, margin: '2px 0 0' }}>{formatDate(a.createdAt)}</p>
                        </div>
                      </div>
                      <RowStatus listStatus={a.status} live={live[a.id]} />
                    </Link>
                  </motion.li>
                ))}
              </ul>
            )}
          </FadeUp>

          {isAdmin && (
            <FadeUp delay={0.35} style={{ marginTop: 32 }}>
              <Button variant="outline-gold" size="sm" href="/admin">
                Консоль нутрициолога →
              </Button>
            </FadeUp>
          )}
        </div>
      </div>

      {/* Уведомление о завершении обработки анализа */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ duration: 0.35, ease: EASE_OUT }}
            style={{ position: 'fixed', left: '50%', transform: 'translateX(-50%)', bottom: 'clamp(1rem,4vw,2rem)', zIndex: 50, width: 'min(92vw, 30rem)' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', borderRadius: 16, background: toast.status === 'done' ? 'linear-gradient(100deg, rgba(46,61,40,0.98), rgba(38,50,34,0.98))' : 'rgba(48,32,30,0.98)', border: `1px solid ${toast.status === 'done' ? 'rgba(255,230,146,0.3)' : 'rgba(255,120,110,0.35)'}`, boxShadow: '0 12px 40px rgba(0,0,0,0.45)', backdropFilter: 'blur(8px)' }}>
              <span style={{ flexShrink: 0, display: 'grid', placeItems: 'center', width: 38, height: 38, borderRadius: 11, background: toast.status === 'done' ? 'rgba(255,230,146,0.14)' : 'rgba(255,120,110,0.14)', color: toast.status === 'done' ? 'var(--gold)' : '#ff9a8a', fontSize: 18 }}>
                {toast.status === 'done' ? '✓' : '!'}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ color: '#fff', fontSize: 14.5, margin: 0, fontWeight: 500 }}>
                  {toast.status === 'done' ? 'Анализ обработан' : 'Не удалось распознать анализ'}
                </p>
                <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12.5, margin: '2px 0 0' }}>
                  {toast.status === 'done' ? 'Готовы новые рекомендации' : 'Попробуйте загрузить более чёткий файл'}
                </p>
              </div>
              {toast.status === 'done' ? (
                <button onClick={() => router.push('/recommendations')} style={{ flexShrink: 0, padding: '9px 14px', borderRadius: 10, border: 'none', background: 'var(--gold)', color: '#2b3a24', fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  Смотреть
                </button>
              ) : (
                <button onClick={() => setToast(null)} aria-label="Закрыть" style={{ flexShrink: 0, width: 34, height: 34, borderRadius: 9, border: '1px solid rgba(255,255,255,0.16)', background: 'none', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontSize: 16 }}>
                  ×
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  )
}

// Правый элемент строки анализа: живой процент выполнения или итоговый бейдж
function RowStatus({ listStatus, live }: { listStatus: AnalysisStatus; live?: LiveState }) {
  const status = live?.status ?? listStatus
  const inFlight = status === 'pending' || status === 'processing'
  if (!inFlight) return <StatusBadge status={status} />
  const pct = Math.round(live?.progress ?? 0)
  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, width: 92, flexShrink: 0 }}>
      <span style={{ fontSize: 12, color: 'var(--gold)', fontVariantNumeric: 'tabular-nums' }}>{pct}%</span>
      <span style={{ width: '100%', height: 4, borderRadius: 3, background: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
        <span style={{ display: 'block', height: '100%', width: `${pct}%`, borderRadius: 3, background: 'var(--gold)', transition: 'width .3s ease' }} />
      </span>
    </span>
  )
}
