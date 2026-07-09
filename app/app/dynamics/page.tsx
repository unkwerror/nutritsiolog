'use client'

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { apiRequest, getAccessToken } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { AppBackground, AppNav, Icon } from '@/components/ds/AppCommon'
import { Button, Chip, FadeUp, EASE_OUT } from '@/components/ds/primitives'
import MarkerChart from '@/components/charts/MarkerChart'

type SeriesPoint = { date: string; value: number }
type MarkerSeries = {
  key: string
  display: string
  section: string
  unit: string | null
  optimumMin: number | null
  optimumMax: number | null
  points: SeriesPoint[]
}
type BodySeries = {
  key: 'weight' | 'waist' | 'bmi'
  display: string
  unit: string
  optimumMin: number | null
  optimumMax: number | null
  points: SeriesPoint[]
}
type AnswerChange = { key: string; label: string; prevLabel: string; currLabel: string; trend: Trend }
type Dynamics = {
  summary: { improved: number; worsened: number; stable: number; currentDate: string; previousDate: string } | null
  series: MarkerSeries[]
  questionnaire: {
    filledCount: number
    lastFilledAt: string
    body: BodySeries[]
    changes: AnswerChange[]
    symptoms: { prevCount: number; currCount: number; gone: string[]; appeared: string[] } | null
  } | null
}
type HistoryItem = { id: number; healthScore: number | null; calculatedAt: string }
type Trend = 'improved' | 'worsened' | 'stable'

function fmtVal(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, '')
}
function fmtDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
}

// Тренд последней пары точек — та же логика «ближе к оптимуму = лучше», что на бэке
function localTrend(s: { points: SeriesPoint[]; optimumMin: number | null; optimumMax: number | null }): Trend {
  const n = s.points.length
  if (n < 2 || (s.optimumMin === null && s.optimumMax === null)) return 'stable'
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

const TREND_UI: Record<Trend, { color: string; sign: string }> = {
  improved: { color: '#a8e0a0', sign: '↗' },
  worsened: { color: '#ff9a8a', sign: '↘' },
  stable: { color: 'rgba(255,255,255,0.5)', sign: '→' },
}

export default function DynamicsPage() {
  const router = useRouter()
  const { user, isLoading: authLoading } = useAuth()
  const [data, setData] = useState<Dynamics | null>(null)
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [loaded, setLoaded] = useState(false)
  const [loadError, setLoadError] = useState(false)

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
  const worsened = useMemo(() => multi.filter((s) => localTrend(s) === 'worsened'), [multi])
  const improved = useMemo(() => multi.filter((s) => localTrend(s) === 'improved'), [multi])
  const stable = useMemo(() => multi.filter((s) => localTrend(s) === 'stable'), [multi])
  const singles = useMemo(() => data?.series.filter((s) => s.points.length === 1) ?? [], [data])

  const scorePoints = useMemo(
    () =>
      history
        .filter((h) => h.healthScore !== null)
        .map((h) => ({ date: h.calculatedAt, value: h.healthScore! }))
        .reverse(),
    [history]
  )

  const q = data?.questionnaire ?? null
  const hasMarkerDynamics = multi.length > 0
  const hasAnyDynamics = hasMarkerDynamics || (q !== null && q.filledCount >= 2)

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
                <div key={i} className="shimmer" style={{ height: 100, borderRadius: 16, marginBottom: 12 }} />
              ))}
            </div>
          ) : loadError ? (
            <div style={{ borderRadius: 16, padding: '2rem 1.5rem', textAlign: 'center', background: 'rgba(255,120,100,0.06)', border: '1px solid rgba(255,120,100,0.22)' }}>
              <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, margin: '0 0 16px' }}>Не удалось загрузить данные</p>
              <Button variant="outline-gold" size="sm" onClick={load}>Повторить</Button>
            </div>
          ) : (
            <>
              {!hasAnyDynamics && (
                <FadeUp>
                  <div style={{ borderRadius: 18, padding: '2.25rem 1.75rem', textAlign: 'center', background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(255,255,255,0.14)', marginBottom: 'clamp(1.75rem,4vw,2.5rem)' }}>
                    <img src="/assets/brand/sprout-ring.svg" alt="" aria-hidden width={72} height={72} style={{ display: 'block', margin: '0 auto 14px', opacity: 0.9 }} />
                    <p className="font-display" style={{ color: '#fff', fontSize: 19, margin: '0 0 10px' }}>Динамика появится со вторым замером</p>
                    <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, lineHeight: 1.6, margin: 0, maxWidth: '26rem', marginLeft: 'auto', marginRight: 'auto' }}>
                      Загрузите свежие анализы и обновите анкету через месяц — здесь появится сравнение: что улучшилось, а что требует внимания.
                    </p>
                  </div>
                </FadeUp>
              )}

              {/* сводка по маркерам */}
              {data?.summary && (
                <FadeUp>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 'clamp(1.5rem,4vw,2rem)' }}>
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

              {/* индекс здоровья */}
              {scorePoints.length >= 2 && (
                <FadeUp delay={0.05}>
                  <section style={{ borderRadius: 18, padding: '1.25rem 1.25rem 1rem', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,230,146,0.2)', marginBottom: 'clamp(1.5rem,4vw,2rem)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                      <Icon name="sparkle" size={19} />
                      <p className="font-display" style={{ color: '#fff', fontSize: 17, margin: 0 }}>Индекс здоровья</p>
                    </div>
                    <MarkerChart points={scorePoints} optimumMin={85} optimumMax={100} height={96} />
                  </section>
                </FadeUp>
              )}

              {/* требуют внимания — раскрыты с графиком */}
              {worsened.length > 0 && (
                <FadeUp delay={0.08}>
                  <SectionHead icon="flame" title="Требуют внимания" count={worsened.length} tone="#ff9a8a" />
                  <div style={{ display: 'grid', gap: 12, marginBottom: 'clamp(1.5rem,4vw,2rem)' }}>
                    {worsened.map((s) => (
                      <MarkerCard key={s.key} s={s} defaultOpen />
                    ))}
                  </div>
                </FadeUp>
              )}

              {/* улучшились — компактно, график по тапу */}
              {improved.length > 0 && (
                <FadeUp delay={0.1}>
                  <SectionHead icon="leaf" title="Улучшились" count={improved.length} tone="#a8e0a0" />
                  <div style={{ display: 'grid', gap: 8, marginBottom: 'clamp(1.5rem,4vw,2rem)' }}>
                    {improved.map((s) => (
                      <MarkerCard key={s.key} s={s} />
                    ))}
                  </div>
                </FadeUp>
              )}

              {/* без изменений + одиночные — свёрнуты */}
              {(stable.length > 0 || singles.length > 0) && (
                <FadeUp delay={0.12}>
                  <div style={{ display: 'grid', gap: 10, marginBottom: 'clamp(1.75rem,4vw,2.5rem)' }}>
                    {stable.length > 0 && (
                      <Collapsed label={`Без изменений — ${stable.length}`}>
                        <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
                          {stable.map((s) => (
                            <MarkerCard key={s.key} s={s} />
                          ))}
                        </div>
                      </Collapsed>
                    )}
                    {singles.length > 0 && (
                      <Collapsed label={`Пока одно измерение — ${singles.length}`}>
                        <ul style={{ listStyle: 'none', margin: '10px 0 0', padding: 0, display: 'grid', gap: 6 }}>
                          {singles.map((s) => (
                            <li key={s.key} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '9px 13px', borderRadius: 11, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                              <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13.5 }}>{s.display}</span>
                              <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13.5, fontVariantNumeric: 'tabular-nums' }}>
                                {fmtVal(s.points[0]!.value)}
                                {s.unit ? ` ${s.unit}` : ''}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </Collapsed>
                    )}
                  </div>
                </FadeUp>
              )}

              {/* ── анкета ── */}
              <FadeUp delay={0.14}>
                <section style={{ borderRadius: 18, padding: '1.35rem 1.35rem 1.5rem', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Icon name="survey" size={20} />
                      <p className="font-display" style={{ color: '#fff', fontSize: 18, margin: 0 }}>Анкета</p>
                    </div>
                    {q && (
                      <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12.5, margin: 0 }}>
                        обновлена {fmtDate(q.lastFilledAt)}
                      </p>
                    )}
                  </div>

                  {!q ? (
                    <>
                      <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, lineHeight: 1.6, margin: '8px 0 16px' }}>
                        Заполните анкету — и со второго заполнения здесь появится динамика веса, сна и самочувствия.
                      </p>
                      <Button variant="gold" size="sm" onClick={() => router.push('/questionnaire')}>Заполнить анкету</Button>
                    </>
                  ) : q.filledCount < 2 ? (
                    <>
                      <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, lineHeight: 1.6, margin: '8px 0 16px' }}>
                        Обновляйте анкету раз в месяц — со второго заполнения появится сравнение: вес, талия, сон, симптомы.
                      </p>
                      <Button variant="outline-gold" size="sm" onClick={() => router.push('/questionnaire')}>Обновить анкету</Button>
                    </>
                  ) : (
                    <>
                      {/* симптомы — главная строка самочувствия */}
                      {q.symptoms && (q.symptoms.gone.length > 0 || q.symptoms.appeared.length > 0 || q.symptoms.currCount !== q.symptoms.prevCount) ? (
                        <div style={{ borderRadius: 13, padding: '12px 14px', margin: '10px 0 14px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                          <p style={{ color: '#fff', fontSize: 14, margin: 0 }}>
                            Симптомы: {q.symptoms.prevCount} → {q.symptoms.currCount}{' '}
                            <span style={{ color: TREND_UI[q.symptoms.currCount < q.symptoms.prevCount ? 'improved' : q.symptoms.currCount > q.symptoms.prevCount ? 'worsened' : 'stable'].color }}>
                              {TREND_UI[q.symptoms.currCount < q.symptoms.prevCount ? 'improved' : q.symptoms.currCount > q.symptoms.prevCount ? 'worsened' : 'stable'].sign}
                            </span>
                          </p>
                          {q.symptoms.gone.length > 0 && (
                            <p style={{ color: '#a8e0a0', fontSize: 13, margin: '5px 0 0' }}>ушли: {q.symptoms.gone.join(', ')}</p>
                          )}
                          {q.symptoms.appeared.length > 0 && (
                            <p style={{ color: '#ff9a8a', fontSize: 13, margin: '5px 0 0' }}>появились: {q.symptoms.appeared.join(', ')}</p>
                          )}
                        </div>
                      ) : (
                        q.symptoms && (
                          <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13.5, margin: '10px 0 14px' }}>
                            Симптомы без изменений ({q.symptoms.currCount})
                          </p>
                        )
                      )}

                      {/* вес / талия / ИМТ — компактно, график по тапу */}
                      {q.body.filter((b) => b.points.length >= 2).length > 0 && (
                        <div style={{ display: 'grid', gap: 8, marginBottom: q.changes.length > 0 ? 14 : 16 }}>
                          {q.body
                            .filter((b) => b.points.length >= 2)
                            .map((b) => (
                              <MarkerCard key={b.key} s={b} />
                            ))}
                        </div>
                      )}

                      {/* изменившиеся ответы */}
                      {q.changes.length > 0 && (
                        <ul style={{ listStyle: 'none', margin: '0 0 16px', padding: 0, display: 'grid', gap: 6 }}>
                          {q.changes.map((c) => (
                            <li key={c.key} style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, padding: '9px 13px', borderRadius: 11, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                              <span style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13.5 }}>{c.label}</span>
                              <span style={{ fontSize: 13.5, textAlign: 'right', color: TREND_UI[c.trend].color }}>
                                <span style={{ color: 'rgba(255,255,255,0.4)' }}>{c.prevLabel} → </span>
                                {c.currLabel} {TREND_UI[c.trend].sign}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}

                      <Button variant="outline-gold" size="sm" onClick={() => router.push('/questionnaire')}>
                        Обновить анкету
                      </Button>
                      <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, margin: '10px 0 0' }}>
                        Рекомендуем обновлять раз в месяц — вместе со свежими анализами
                      </p>
                    </>
                  )}
                </section>
              </FadeUp>
            </>
          )}
        </div>
      </div>
    </main>
  )
}

function SectionHead({ icon, title, count, tone }: { icon: string; title: string; count: number; tone: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
      <Icon name={icon} size={19} color={tone} />
      <p className="font-display" style={{ color: '#fff', fontSize: 17, margin: 0 }}>{title}</p>
      <span style={{ color: tone, fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>{count}</span>
    </div>
  )
}

// Компактная строка маркера: «имя · 42 → 58 ↗», график раскрывается по тапу
function MarkerCard({
  s,
  defaultOpen = false,
}: {
  s: { key: string; display: string; unit: string | null; optimumMin: number | null; optimumMax: number | null; points: SeriesPoint[] }
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  const trend = localTrend(s)
  const t = TREND_UI[trend]
  const last = s.points[s.points.length - 1]!
  const prev = s.points[s.points.length - 2]

  return (
    <div style={{ borderRadius: 14, background: 'rgba(255,255,255,0.04)', border: `1px solid ${trend === 'worsened' ? 'rgba(255,120,110,0.25)' : 'rgba(255,255,255,0.08)'}` }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, width: '100%', padding: '12px 14px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
      >
        <span style={{ color: '#fff', fontSize: 14.5, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {s.display}
        </span>
        <span style={{ flexShrink: 0, fontSize: 14, fontVariantNumeric: 'tabular-nums', color: t.color }}>
          {prev && <span style={{ color: 'rgba(255,255,255,0.4)' }}>{fmtVal(prev.value)} → </span>}
          {fmtVal(last.value)}
          {s.unit ? <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12 }}> {s.unit}</span> : null} {t.sign}
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: EASE_OUT }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ padding: '0 14px 12px' }}>
              {(s.optimumMin !== null || s.optimumMax !== null) && (
                <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, margin: '0 0 6px' }}>
                  оптимум {s.optimumMin !== null ? fmtVal(s.optimumMin) : '…'}–{s.optimumMax !== null ? fmtVal(s.optimumMax) : '…'}
                  {s.unit ? ` ${s.unit}` : ''}
                </p>
              )}
              <MarkerChart points={s.points} optimumMin={s.optimumMin} optimumMax={s.optimumMax} height={88} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function Collapsed({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.55)', fontFamily: 'var(--font-sans)', fontSize: 13.5, cursor: 'pointer', padding: 0 }}
      >
        {open ? '▾' : '▸'} {label}
      </button>
      {open && children}
    </div>
  )
}
