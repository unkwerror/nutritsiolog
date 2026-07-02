'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { apiRequest, getAccessToken } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { AppBackground, AppNav, Reveal, ProgressRing, AnimatedNumber, Icon } from '@/components/ds/AppCommon'
import { Button, StatusBadge } from '@/components/ds/primitives'

type AnalysisStatus = 'pending' | 'processing' | 'done' | 'failed'
type AnalysisListItem = {
  id: number
  status: AnalysisStatus
  analysisTypes: string | string[] | null
  createdAt: string
  patientName: string | null
}

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(iso))
  } catch {
    return iso
  }
}
function typeLabel(a: AnalysisListItem): string {
  const t = a.analysisTypes
  if (Array.isArray(t) && t.length > 0) return t.join(', ')
  if (typeof t === 'string' && t.trim().length > 0) return t
  return `Анализ #${a.id}`
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

  useEffect(() => {
    if (!getAccessToken()) return
    loadAnalyses()
    apiRequest<{ id: number } | null>('/api/v1/questionnaire/my')
      .then((q) => setHasQuestionnaire(!!q))
      .catch(() => setHasQuestionnaire(false))
    // Админ-проба кэшируется на сессию — не дёргаем /admin/me при каждом визите.
    const cachedAdmin = sessionStorage.getItem('isAdmin')
    if (cachedAdmin !== null) {
      setIsAdmin(cachedAdmin === '1')
    } else {
      apiRequest('/api/v1/admin/me')
        .then(() => {
          sessionStorage.setItem('isAdmin', '1')
          setIsAdmin(true)
        })
        .catch(() => {
          sessionStorage.setItem('isAdmin', '0')
          setIsAdmin(false)
        })
    }
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
          <Reveal style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap', marginBottom: 'clamp(2.5rem,5vw,3.5rem)' }}>
            <div>
              <p className="eyebrow" style={{ marginBottom: 14 }}>
                {greetingLine || ' '}
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
                <div style={{ fontSize: 9.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>профиль</div>
              </div>
            </ProgressRing>
          </Reveal>

          {next && (
            <Reveal delay={60}>
              <button
                onClick={() => router.push(next.to)}
                className="next-banner"
                style={{ width: '100%', textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 18, padding: '1.25rem 1.5rem', marginBottom: 32, borderRadius: 16, background: 'linear-gradient(100deg, rgba(255,230,146,0.14), rgba(255,230,146,0.05))', border: '1px solid rgba(255,230,146,0.28)' }}
              >
                <span style={{ display: 'grid', placeItems: 'center', width: 46, height: 46, borderRadius: 12, background: 'rgba(255,230,146,0.12)', flexShrink: 0 }}>
                  <Icon name={next.icon} size={24} />
                </span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(255,230,146,0.7)', marginBottom: 3 }}>Следующий шаг</div>
                  <div className="font-display" style={{ fontSize: 20, color: '#fff' }}>{next.nextLabel}</div>
                </div>
                <span className="next-arrow" style={{ color: 'var(--gold)', fontSize: 22 }}>→</span>
              </button>
            </Reveal>
          )}

          <div className="journey-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            {steps.map((s, i) => (
              <Reveal key={s.key} delay={120 + i * 80}>
                <button
                  onClick={() => router.push(s.to)}
                  className="journey-card"
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
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13, color: s.done ? 'rgba(255,230,146,0.8)' : 'rgba(255,255,255,0.45)' }}>
                      {s.done && <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--gold)' }} />}
                      {s.status}
                    </span>
                  </div>
                  <span className="card-cta" style={{ marginTop: 'auto', display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.55)' }}>
                    {s.cta} <span className="card-arrow">→</span>
                  </span>
                </button>
              </Reveal>
            ))}
          </div>

          <Reveal delay={120} style={{ marginTop: 'clamp(3rem,6vw,4.5rem)' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 18 }}>
              <h2 className="font-display" style={{ fontWeight: 500, fontSize: 22, color: '#fff', margin: 0 }}>Последние анализы</h2>
              {analysisCount > 0 && (
                <Link href="/analyses" style={{ fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,230,146,0.7)', cursor: 'pointer', textDecoration: 'none' }}>
                  Все анализы →
                </Link>
              )}
            </div>
            {!loaded ? (
              <p style={{ fontFamily: 'var(--font-sans)', fontSize: 14, color: 'rgba(255,255,255,0.35)' }}>Загрузка…</p>
            ) : loadError ? (
              <div style={{ borderRadius: 16, padding: '2rem 1.5rem', textAlign: 'center', background: 'rgba(255,120,100,0.06)', border: '1px solid rgba(255,120,100,0.22)' }}>
                <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 14, margin: '0 0 16px' }}>Не удалось загрузить данные</p>
                <Button variant="outline-gold" size="sm" onClick={loadAnalyses}>
                  Повторить
                </Button>
              </div>
            ) : analysisCount === 0 ? (
              <div style={{ borderRadius: 16, padding: '2.5rem 1.5rem', textAlign: 'center', background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(255,255,255,0.14)' }}>
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, margin: '0 0 18px' }}>Вы ещё не загрузили ни одного анализа</p>
                <Button variant="gold" size="sm" onClick={() => router.push('/analyses/upload')}>
                  Загрузить анализ
                </Button>
              </div>
            ) : (
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                {analyses.slice(0, 3).map((a) => (
                  <li key={a.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                    <Link href={`/analyses/${a.id}`} className="analysis-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 0.5rem', cursor: 'pointer', borderRadius: 8, textDecoration: 'none' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                        <span style={{ display: 'grid', placeItems: 'center', width: 38, height: 38, borderRadius: 10, background: 'rgba(255,255,255,0.05)' }}>
                          <Icon name="lab" size={20} color="rgba(255,255,255,0.6)" />
                        </span>
                        <div>
                          <p style={{ color: '#fff', fontSize: 14, margin: 0 }}>{typeLabel(a)}</p>
                          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, margin: '2px 0 0' }}>{formatDate(a.createdAt)}</p>
                        </div>
                      </div>
                      <StatusBadge status={a.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Reveal>

          {isAdmin && (
            <Reveal delay={160} style={{ marginTop: 32 }}>
              <Button variant="outline-gold" size="sm" href="/admin">
                Консоль нутрициолога →
              </Button>
            </Reveal>
          )}
        </div>
      </div>
    </main>
  )
}
