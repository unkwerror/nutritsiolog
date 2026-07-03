'use client'

import { useCallback, useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { apiRequest, getAccessToken } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { AppBackground, AppNav, Icon, useReveal } from '@/components/ds/AppCommon'
import { Button, StatusBadge } from '@/components/ds/primitives'
import { analysisName } from '@/lib/format'
import { useAnalysesLive, type LiveState } from '@/lib/useAnalysesLive'

type AnalysisStatus = 'pending' | 'processing' | 'done' | 'failed'
type Item = {
  id: number
  status: AnalysisStatus
  detectedTypes: string[] | null
  analysisType: string | null
  labName: string | null
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

// <li> с reveal-анимацией: класс на самом li, чтобы между <ul> и <li>
// не появлялся лишний <div> (невалидная вложенность списка).
function RevealLi({ children, delay = 0, style = {} }: { children: ReactNode; delay?: number; style?: CSSProperties }) {
  const ref = useReveal<HTMLLIElement>()
  return (
    <li ref={ref} className="reveal" style={{ transitionDelay: `${delay}ms`, ...style }}>
      {children}
    </li>
  )
}

export default function AnalysesPage() {
  const router = useRouter()
  const { user, isLoading: authLoading } = useAuth()
  const [items, setItems] = useState<Item[]>([])
  const [loaded, setLoaded] = useState(false)
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    if (!authLoading && !user && !getAccessToken()) router.replace('/auth')
  }, [authLoading, user, router])

  const loadItems = useCallback(() => {
    setLoaded(false)
    setLoadError(false)
    apiRequest<Item[]>('/api/v1/analysis')
      .then((l) => setItems(Array.isArray(l) ? l : []))
      .catch(() => setLoadError(true))
      .finally(() => setLoaded(true))
  }, [])

  // Тихий авторефреш по завершении анализа (без скелетона)
  const refreshItemsSilent = useCallback(() => {
    apiRequest<Item[]>('/api/v1/analysis')
      .then((l) => setItems(Array.isArray(l) ? l : []))
      .catch(() => {})
  }, [])

  const live = useAnalysesLive(items, () => refreshItemsSilent())

  useEffect(() => {
    if (!getAccessToken()) return
    loadItems()
  }, [loadItems])

  return (
    <main style={{ position: 'relative', minHeight: '100vh' }}>
      <AppBackground glow="16%" />
      <div style={{ position: 'relative', zIndex: 1 }}>
        <AppNav onBack={() => router.push('/dashboard')} backLabel="В кабинет" />
        <div style={{ maxWidth: '46rem', margin: '0 auto', padding: 'clamp(2rem,5vw,3.5rem) clamp(1.25rem,5vw,3rem) 6rem' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 'clamp(2rem,4vw,2.75rem)' }}>
            <div>
              <p className="eyebrow" style={{ marginBottom: 14 }}>Лабораторные исследования</p>
              <h1 className="font-display" style={{ fontWeight: 500, fontSize: 'clamp(2.2rem,5vw,3.4rem)', color: '#fff', lineHeight: 1.04, margin: 0 }}>
                Мои анализы
              </h1>
            </div>
            <Button variant="gold" size="sm" onClick={() => router.push('/analyses/upload')}>
              Загрузить
            </Button>
          </div>

          {!loaded ? (
            <p style={{ fontFamily: 'var(--font-sans)', color: 'rgba(255,255,255,0.4)', fontSize: 15 }}>Загрузка…</p>
          ) : loadError ? (
            <div style={{ borderRadius: 18, padding: '2.5rem 1.5rem', textAlign: 'center', background: 'rgba(255,120,100,0.06)', border: '1px solid rgba(255,120,100,0.22)' }}>
              <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 15, margin: '0 0 20px' }}>Не удалось загрузить данные</p>
              <Button variant="outline-gold" onClick={loadItems}>
                Повторить
              </Button>
            </div>
          ) : items.length === 0 ? (
            <div style={{ borderRadius: 18, padding: 'clamp(2.5rem,6vw,3.5rem) 1.5rem', textAlign: 'center', background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(255,255,255,0.14)' }}>
              <span style={{ display: 'inline-grid', placeItems: 'center', width: 56, height: 56, borderRadius: 15, background: 'rgba(255,230,146,0.1)', marginBottom: 16, color: 'var(--gold)' }}>
                <Icon name="lab" size={28} />
              </span>
              <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 15, margin: '0 0 20px' }}>Вы ещё не загрузили ни одного анализа</p>
              <Button variant="gold" onClick={() => router.push('/analyses/upload')}>
                Загрузить анализ
              </Button>
            </div>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
              {items.map((a, i) => (
                <RevealLi key={a.id} delay={Math.min(i * 50, 300)} style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                  <button
                    onClick={() => router.push(`/analyses/${a.id}`)}
                    className="analysis-row"
                    style={{ width: '100%', textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, padding: '1rem 0.5rem', background: 'none', border: 'none', borderRadius: 8 }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
                      <span style={{ display: 'grid', placeItems: 'center', width: 40, height: 40, borderRadius: 11, flexShrink: 0, background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.6)' }}>
                        <Icon name="lab" size={20} color="rgba(255,255,255,0.6)" />
                      </span>
                      <span style={{ minWidth: 0 }}>
                        <span style={{ display: 'block', color: '#fff', fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{analysisName(a)}</span>
                        <span style={{ display: 'block', color: 'rgba(255,255,255,0.6)', fontSize: 13, marginTop: 2 }}>{formatDate(a.createdAt)}</span>
                      </span>
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                      <RowStatus listStatus={a.status} live={live[a.id]} />
                      <span className="card-arrow" style={{ color: 'rgba(255,255,255,0.3)' }}>→</span>
                    </span>
                  </button>
                </RevealLi>
              ))}
            </ul>
          )}
        </div>
      </div>
    </main>
  )
}

// Живой процент выполнения или итоговый бейдж статуса
function RowStatus({ listStatus, live }: { listStatus: AnalysisStatus; live?: LiveState }) {
  const status = live?.status ?? listStatus
  const inFlight = status === 'pending' || status === 'processing'
  if (!inFlight) return <StatusBadge status={status} />
  const pct = Math.round(live?.progress ?? 0)
  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, width: 92 }}>
      <span style={{ fontSize: 12, color: 'var(--gold)', fontVariantNumeric: 'tabular-nums' }}>{pct}%</span>
      <span style={{ width: '100%', height: 4, borderRadius: 3, background: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
        <span style={{ display: 'block', height: '100%', width: `${pct}%`, borderRadius: 3, background: 'var(--gold)', transition: 'width .3s ease' }} />
      </span>
    </span>
  )
}
