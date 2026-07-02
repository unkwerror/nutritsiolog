'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { apiRequest, getAccessToken } from '@/lib/api'
import { AppBackground, AppNav, Reveal, ProgressRing } from '@/components/ds/AppCommon'
import { Button } from '@/components/ds/primitives'

type Signal = {
  category: string
  title: string
  text: string
  severity: 'info' | 'warning' | 'critical'
  sources: string[]
}
type Recommendations = { signals: Signal[]; hasQuestionnaire: boolean; hasAnalyses: boolean }

const SEV: Record<Signal['severity'], { c: string; dot: string; l: string }> = {
  info: { c: 'rgba(255,255,255,0.4)', dot: 'rgba(255,255,255,0.4)', l: 'Рекомендация' },
  warning: { c: 'rgba(255,200,80,0.9)', dot: '#ffc850', l: 'Внимание' },
  critical: { c: 'rgba(255,140,110,0.95)', dot: '#ff9a7a', l: 'Важно' },
}

const BRAND = '/assets/brand/'

export default function RecommendationsPage() {
  const router = useRouter()
  const [data, setData] = useState<Recommendations | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [loadError, setLoadError] = useState(false)

  const loadData = useCallback(() => {
    setLoaded(false)
    setLoadError(false)
    apiRequest<Recommendations>('/api/v1/profile/recommendations')
      .then(setData)
      .catch(() => setLoadError(true))
      .finally(() => setLoaded(true))
  }, [])

  useEffect(() => {
    if (!getAccessToken()) {
      router.replace('/auth')
      return
    }
    loadData()
  }, [router, loadData])

  const signals = data?.signals ?? []
  const ready = signals.length > 0
  const criticalCount = signals.filter((s) => s.severity === 'critical').length

  return (
    <main style={{ position: 'relative', minHeight: '100vh' }}>
      <AppBackground glow="16%" />
      <div style={{ position: 'relative', zIndex: 1 }}>
        <AppNav onBack={() => router.push('/dashboard')} backLabel="В кабинет" />
        <div style={{ maxWidth: '46rem', margin: '0 auto', padding: 'clamp(2rem,5vw,3.5rem) clamp(1.25rem,5vw,3rem) 6rem' }}>
          {!loaded ? (
            <p style={{ fontFamily: 'var(--font-sans)', color: 'rgba(255,255,255,0.4)', fontSize: 15 }}>Загрузка…</p>
          ) : loadError ? (
            <div style={{ borderRadius: 18, padding: '2.5rem 1.5rem', textAlign: 'center', background: 'rgba(255,120,100,0.06)', border: '1px solid rgba(255,120,100,0.22)' }}>
              <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 15, margin: '0 0 20px' }}>Не удалось загрузить данные</p>
              <Button variant="outline-gold" onClick={loadData}>
                Повторить
              </Button>
            </div>
          ) : !ready ? (
            <div style={{ minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
              <img src={`${BRAND}monogram.svg`} alt="" width={72} style={{ marginBottom: 24, opacity: 0.9 }} />
              <h1 className="font-display" style={{ fontWeight: 500, fontSize: 'clamp(2rem,4vw,3rem)', color: '#fff', lineHeight: 1.1, margin: '0 auto 1.25rem', maxWidth: '24rem' }}>
                Заполните анкету и загрузите анализы
              </h1>
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 15, margin: '0 auto 2.25rem', maxWidth: '26rem', lineHeight: 1.6 }}>
                Алгоритм сформирует персональные рекомендации на основе ваших данных.
              </p>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
                <Button variant="gold" size="md" onClick={() => router.push('/questionnaire')}>
                  Заполнить анкету
                </Button>
                <Button variant="outline-gold" size="md" onClick={() => router.push('/analyses/upload')}>
                  Загрузить анализы
                </Button>
              </div>
            </div>
          ) : (
            <>
              <Reveal style={{ display: 'flex', alignItems: 'center', gap: 22, flexWrap: 'wrap', marginBottom: 'clamp(2.5rem,5vw,3.5rem)' }}>
                <ProgressRing value={100} size={92} stroke={6}>
                  <div style={{ textAlign: 'center' }}>
                    <div className="font-display" style={{ fontSize: 24, color: '#fff', lineHeight: 1 }}>{signals.length}</div>
                    <div style={{ fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.45)' }}>сигнал.</div>
                  </div>
                </ProgressRing>
                <div style={{ flex: 1, minWidth: 220 }}>
                  <p className="eyebrow" style={{ marginBottom: 12 }}>Персональный профиль</p>
                  <h1 className="font-display" style={{ fontWeight: 500, fontSize: 'clamp(2.2rem,5vw,3.4rem)', color: '#fff', lineHeight: 1.02, margin: 0 }}>
                    Рекомендации
                  </h1>
                  <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, margin: '10px 0 0' }}>
                    {signals.length} сигнал.{criticalCount > 0 ? ` · ${criticalCount} важн.` : ''} · по приоритету
                  </p>
                </div>
              </Reveal>

              {(!data?.hasQuestionnaire || !data?.hasAnalyses) && (
                <Reveal style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 28 }}>
                  {!data?.hasQuestionnaire && (
                    <Link href="/questionnaire" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: 'var(--font-sans)', fontSize: 13, color: 'rgba(255,255,255,0.55)', cursor: 'pointer', textDecoration: 'none' }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(255,230,146,0.6)' }} />
                      Заполните анкету для уточнения
                    </Link>
                  )}
                  {!data?.hasAnalyses && (
                    <Link href="/analyses/upload" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: 'var(--font-sans)', fontSize: 13, color: 'rgba(255,255,255,0.55)', cursor: 'pointer', textDecoration: 'none' }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(255,230,146,0.6)' }} />
                      Загрузите анализы для расширенного профиля
                    </Link>
                  )}
                </Reveal>
              )}

              <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                {signals.map((sig, i) => {
                  const s = SEV[sig.severity]
                  return (
                    <Reveal key={`${sig.title}-${i}`} delay={i * 70}>
                      <article style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', padding: 'clamp(1.75rem,4vw,2.5rem) 0' }}>
                        <div style={{ display: 'flex', gap: 'clamp(1rem,3vw,2rem)' }}>
                          <span className="font-display" style={{ fontSize: 'clamp(1.8rem,4vw,2.8rem)', color: 'rgba(255,230,146,0.13)', lineHeight: 1, marginTop: 2 }}>
                            {String(i + 1).padStart(2, '0')}
                          </span>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 9 }}>
                              <span style={{ width: 7, height: 7, borderRadius: '50%', background: s.dot }} />
                              <span style={{ fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color: s.c }}>
                                {sig.category} · {s.l}
                              </span>
                            </div>
                            <h3 className="font-display" style={{ fontWeight: 500, fontSize: 'clamp(1.4rem,3vw,1.7rem)', color: '#fff', lineHeight: 1.15, margin: '0 0 12px' }}>
                              {sig.title}
                            </h3>
                            <p style={{ fontSize: 15, lineHeight: 1.65, color: 'rgba(255,255,255,0.68)', margin: 0 }}>{sig.text}</p>
                          </div>
                        </div>
                      </article>
                    </Reveal>
                  )
                })}
              </div>

              <Reveal delay={120} style={{ marginTop: 40, display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
                <Button variant="gold" onClick={() => router.push('/analyses/upload')}>
                  Обновить анализы
                </Button>
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', maxWidth: '28rem', lineHeight: 1.6, margin: 0 }}>
                  Рекомендации носят информационный характер. Перед изменением питания и приёмом добавок проконсультируйтесь с врачом.
                </p>
              </Reveal>
            </>
          )}
        </div>
      </div>
    </main>
  )
}
