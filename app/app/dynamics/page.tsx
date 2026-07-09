'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiRequest, getAccessToken } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { AppBackground, AppNav, Icon } from '@/components/ds/AppCommon'
import { Button, Chip, FadeUp } from '@/components/ds/primitives'
import MarkerChart from '@/components/charts/MarkerChart'

type SeriesPoint = { analysisId: number; date: string; value: number }
type MarkerSeries = {
  key: string
  display: string
  section: string
  unit: string | null
  optimumMin: number | null
  optimumMax: number | null
  points: SeriesPoint[]
}
type Dynamics = {
  summary: { improved: number; worsened: number; stable: number; currentDate: string; previousDate: string } | null
  series: MarkerSeries[]
}
type HistoryItem = { id: number; healthScore: number | null; calculatedAt: string }

const SECTION_RU: Record<string, string> = {
  cbc: 'Общий анализ крови',
  glucose: 'Углеводный обмен',
  lipids: 'Липидный профиль',
  liver: 'Печень',
  kidney: 'Почки',
  thyroid: 'Щитовидная железа',
  vitamins: 'Витамины и минералы',
  hormones: 'Гормоны',
  inflammation: 'Воспаление',
  protein: 'Белковый обмен',
  iron: 'Обмен железа',
}

function fmtVal(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, '')
}
function fmtDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
}

// Тренд последней пары точек — та же логика «ближе к оптимуму = лучше», что на бэке
function localTrend(s: MarkerSeries): 'improved' | 'worsened' | 'stable' | null {
  const n = s.points.length
  if (n < 2 || (s.optimumMin === null && s.optimumMax === null)) return n < 2 ? null : 'stable'
  const dist = (v: number) =>
    s.optimumMin !== null && v < s.optimumMin
      ? s.optimumMin - v
      : s.optimumMax !== null && v > s.optimumMax
        ? v - s.optimumMax
        : 0
  const dPrev = dist(s.points[n - 2]!.value)
  const dCurr = dist(s.points[n - 1]!.value)
  const width =
    s.optimumMin !== null && s.optimumMax !== null
      ? Math.abs(s.optimumMax - s.optimumMin)
      : Math.abs(s.optimumMin ?? s.optimumMax ?? 1) || 1
  if (Math.abs(dPrev - dCurr) <= width * 0.02) return 'stable'
  return dCurr < dPrev ? 'improved' : 'worsened'
}

const TREND_UI = {
  improved: { label: 'улучшение', color: '#a8e0a0' },
  worsened: { label: 'требует внимания', color: '#ff9a8a' },
  stable: { label: 'без изменений', color: 'rgba(255,255,255,0.5)' },
} as const

export default function DynamicsPage() {
  const router = useRouter()
  const { user, isLoading: authLoading } = useAuth()
  const [data, setData] = useState<Dynamics | null>(null)
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [loaded, setLoaded] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [showSingles, setShowSingles] = useState(false)

  useEffect(() => {
    if (!authLoading && !user && !getAccessToken()) router.replace('/auth')
  }, [authLoading, user, router])

  const load = useCallback(() => {
    setLoaded(false)
    setLoadError(false)
    Promise.all([
      apiRequest<Dynamics>('/api/v1/profile/dynamics'),
      apiRequest<HistoryItem[]>('/api/v1/profile/history').catch(() => [] as HistoryItem[]),
    ])
      .then(([d, h]) => {
        setData(d)
        setHistory(Array.isArray(h) ? h : [])
      })
      .catch(() => setLoadError(true))
      .finally(() => setLoaded(true))
  }, [])

  useEffect(() => {
    if (!getAccessToken()) return
    load()
  }, [load])

  const multi = useMemo(() => data?.series.filter((s) => s.points.length >= 2) ?? [], [data])
  const singles = useMemo(() => data?.series.filter((s) => s.points.length === 1) ?? [], [data])

  // healthScore по времени (история приходит desc — разворачиваем)
  const scorePoints = useMemo(
    () =>
      history
        .filter((h) => h.healthScore !== null)
        .map((h) => ({ analysisId: h.id, date: h.calculatedAt, value: h.healthScore! }))
        .reverse(),
    [history]
  )

  return (
    <main style={{ position: 'relative', minHeight: '100vh' }}>
      <AppBackground glow="16%" />
      <div style={{ position: 'relative', zIndex: 1 }}>
        <AppNav onBack={() => router.push('/dashboard')} backLabel="В кабинет" />
        <div style={{ maxWidth: '46rem', margin: '0 auto', padding: 'clamp(2rem,5vw,3.5rem) clamp(1.25rem,5vw,3rem) 6rem' }}>
          <p className="eyebrow" style={{ marginBottom: 14 }}>Отслеживание изменений</p>
          <h1 className="font-display" style={{ fontWeight: 500, fontSize: 'clamp(2.2rem,5vw,3.4rem)', color: '#fff', lineHeight: 1.04, margin: '0 0 clamp(1.75rem,4vw,2.5rem)' }}>
            Динамика
          </h1>

          {!loaded ? (
            <div>
              {[0, 1, 2].map((i) => (
                <div key={i} className="shimmer" style={{ height: 120, borderRadius: 16, marginBottom: 12 }} />
              ))}
            </div>
          ) : loadError ? (
            <div style={{ borderRadius: 16, padding: '2rem 1.5rem', textAlign: 'center', background: 'rgba(255,120,100,0.06)', border: '1px solid rgba(255,120,100,0.22)' }}>
              <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, margin: '0 0 16px' }}>Не удалось загрузить данные</p>
              <Button variant="outline-gold" size="sm" onClick={load}>Повторить</Button>
            </div>
          ) : multi.length === 0 ? (
            <FadeUp>
              <div style={{ borderRadius: 18, padding: '2.5rem 1.75rem', textAlign: 'center', background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(255,255,255,0.14)' }}>
                <img src="/assets/brand/sprout-ring.svg" alt="" aria-hidden width={76} height={76} style={{ display: 'block', margin: '0 auto 16px', opacity: 0.9 }} />
                <p className="font-display" style={{ color: '#fff', fontSize: 19, margin: '0 0 10px' }}>Динамика появится со вторым замером</p>
                <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, lineHeight: 1.6, margin: '0 0 20px', maxWidth: '26rem', marginLeft: 'auto', marginRight: 'auto' }}>
                  Загрузите свежие анализы через месяц — и здесь появятся графики изменений каждого показателя: что улучшилось, а что требует внимания.
                </p>
                <Button variant="gold" size="sm" onClick={() => router.push('/analyses/upload')}>Загрузить анализы</Button>
              </div>
            </FadeUp>
          ) : (
            <>
              {/* сводка */}
              {data?.summary && (
                <FadeUp>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 'clamp(1.75rem,4vw,2.5rem)' }}>
                    {data.summary.improved > 0 && (
                      <Chip style={{ borderColor: 'rgba(150,210,140,0.35)', color: '#a8e0a0' }}>↗ {data.summary.improved} улучшилось</Chip>
                    )}
                    {data.summary.worsened > 0 && (
                      <Chip style={{ borderColor: 'rgba(255,120,110,0.35)', color: '#ff9a8a' }}>↘ {data.summary.worsened} требует внимания</Chip>
                    )}
                    {data.summary.stable > 0 && <Chip>→ {data.summary.stable} без изменений</Chip>}
                  </div>
                </FadeUp>
              )}

              {/* индекс здоровья по времени */}
              {scorePoints.length >= 2 && (
                <FadeUp delay={0.05}>
                  <section style={{ borderRadius: 18, padding: '1.25rem 1.25rem 1rem', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,230,146,0.2)', marginBottom: 'clamp(1.75rem,4vw,2.5rem)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                      <Icon name="sparkle" size={19} />
                      <p className="font-display" style={{ color: '#fff', fontSize: 17, margin: 0 }}>Индекс здоровья</p>
                    </div>
                    <MarkerChart points={scorePoints} optimumMin={85} optimumMax={100} height={104} />
                  </section>
                </FadeUp>
              )}

              {/* маркеры с историей */}
              <div style={{ display: 'grid', gap: 14 }}>
                {multi.map((s, i) => {
                  const trend = localTrend(s)
                  const t = trend ? TREND_UI[trend] : null
                  const last = s.points[s.points.length - 1]!
                  const prev = s.points[s.points.length - 2]!
                  return (
                    <FadeUp key={s.key} delay={Math.min(i * 0.05, 0.3)}>
                      <section style={{ borderRadius: 18, padding: '1.2rem 1.25rem 0.9rem', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)' }}>
                        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 4 }}>
                          <div style={{ minWidth: 0 }}>
                            <p style={{ color: '#fff', fontSize: 15.5, fontWeight: 500, margin: 0 }}>{s.display}</p>
                            <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, margin: '2px 0 0' }}>
                              {SECTION_RU[s.section] ?? s.section}
                              {s.optimumMin !== null || s.optimumMax !== null
                                ? ` · оптимум ${s.optimumMin !== null ? fmtVal(s.optimumMin) : '…'}–${s.optimumMax !== null ? fmtVal(s.optimumMax) : '…'}`
                                : ''}
                              {s.unit ? ` ${s.unit}` : ''}
                            </p>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <p style={{ color: '#fff', fontSize: 15, margin: 0, fontVariantNumeric: 'tabular-nums' }}>
                              <span style={{ color: 'rgba(255,255,255,0.45)' }}>{fmtVal(prev.value)} → </span>
                              <strong>{fmtVal(last.value)}</strong>
                            </p>
                            {t && <p style={{ color: t.color, fontSize: 12, margin: '2px 0 0' }}>{t.label}</p>}
                          </div>
                        </div>
                        <MarkerChart points={s.points} optimumMin={s.optimumMin} optimumMax={s.optimumMax} />
                      </section>
                    </FadeUp>
                  )
                })}
              </div>

              {/* одиночные замеры */}
              {singles.length > 0 && (
                <div style={{ marginTop: 'clamp(1.75rem,4vw,2.5rem)' }}>
                  <button
                    onClick={() => setShowSingles((v) => !v)}
                    style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.55)', fontFamily: 'var(--font-sans)', fontSize: 13.5, cursor: 'pointer', padding: 0 }}
                  >
                    {showSingles ? '▾' : '▸'} Пока одно измерение — {singles.length}
                  </button>
                  {showSingles && (
                    <ul style={{ listStyle: 'none', margin: '12px 0 0', padding: 0, display: 'grid', gap: 8 }}>
                      {singles.map((s) => (
                        <li key={s.key} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '10px 14px', borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                          <span style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13.5 }}>{s.display}</span>
                          <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13.5, fontVariantNumeric: 'tabular-nums' }}>
                            {fmtVal(s.points[0]!.value)}
                            {s.unit ? ` ${s.unit}` : ''} · {fmtDate(s.points[0]!.date)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </main>
  )
}
