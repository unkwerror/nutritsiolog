'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { apiRequest, getAccessToken } from '@/lib/api'
import { AppBackground, AppNav, Icon, ProgressRing, AnimatedNumber } from '@/components/ds/AppCommon'
import { Button } from '@/components/ds/primitives'
import ConsultCta from '@/components/ConsultCta'

type Foods = { add?: string[]; avoid?: string[] }
type CategoryKey = 'nutrition' | 'vitamins' | 'metabolism' | 'hormones' | 'inflammation' | 'lifestyle'
type Signal = {
  id: string
  category: string
  categoryKey: CategoryKey
  title: string
  text: string
  detail: string[]
  foods?: Foods
  severity: 'info' | 'warning' | 'critical'
  sources: string[]
}
type ProgramBlock = {
  key: string
  icon: string
  title: string
  summary: string
  steps: string[]
  relevantTags: string[]
  relevant: boolean
}
type SectionScore = { section: string; title: string; total: number; outOfRange: number; score: number }
type MarkerRecommendation = {
  summary: string | null
  steps: string[]
  foods: { add: string[]; avoid: string[] } | null
  topics: string[]
}
type Finding = {
  key: string
  display: string
  section: string
  direction: 'low' | 'high'
  value: number | null
  optimumMin: number | null
  optimumMax: number | null
  source: 'catalog' | 'lab'
  status: 'mild' | 'severe'
  recommendation?: MarkerRecommendation
}
type Lifehack = { title: string; text: string }
type Recommendations = {
  signals: Signal[]
  program: ProgramBlock[]
  inflammation: { add: string[]; avoid: string[] }
  glycemicTips: string[]
  nutritionPrinciples: string[]
  bitterTastes: string[]
  dessertSwaps: string[]
  lifehacks: Lifehack[]
  healthScore: number | null
  sectionScores: SectionScore[]
  findings: Finding[]
  criticalCount: number
  warningCount: number
  hasQuestionnaire: boolean
  hasAnalyses: boolean
}

const SEV: Record<Signal['severity'], { c: string; dot: string; l: string; ring: string }> = {
  info: { c: 'rgba(255,255,255,0.55)', dot: 'rgba(255,255,255,0.5)', l: 'Рекомендация', ring: 'rgba(255,255,255,0.14)' },
  warning: { c: '#ffcf7a', dot: '#ffc850', l: 'Внимание', ring: 'rgba(255,200,80,0.35)' },
  critical: { c: '#ff9a7a', dot: '#ff8a6a', l: 'Важно', ring: 'rgba(255,120,90,0.4)' },
}

// Сила отклонения маркера — единая палитра с экраном анализа (жёлтый/красный)
const FINDING_SEV: Record<Finding['status'], { c: string; bg: string; bd: string; label: string }> = {
  mild: { c: '#fbbf24', bg: 'rgba(251,191,36,0.06)', bd: 'rgba(251,191,36,0.24)', label: 'Умеренное' },
  severe: { c: '#f87171', bg: 'rgba(248,113,113,0.07)', bd: 'rgba(248,113,113,0.28)', label: 'Сильное' },
}

function Chevron({ open }: { open: boolean }) {
  return (
    <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.3 }} style={{ flexShrink: 0, color: 'rgba(255,255,255,0.4)', display: 'grid', placeItems: 'center' }}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M6 9l6 6 6-6" /></svg>
    </motion.span>
  )
}

// Кнопка «показать все / свернуть» — дозируем длинные списки
function ShowMoreBar({ expanded, hiddenCount, onToggle }: { expanded: boolean; hiddenCount: number; onToggle: () => void }) {
  if (hiddenCount <= 0) return null
  return (
    <button
      onClick={onToggle}
      style={{ marginTop: 12, width: '100%', minHeight: 44, borderRadius: 12, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.02)', color: 'rgba(255,255,255,0.7)', fontFamily: 'var(--font-sans)', fontSize: 13.5, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
    >
      {expanded ? 'Свернуть' : `Показать все · ещё ${hiddenCount}`}
      <Chevron open={expanded} />
    </button>
  )
}

const CATEGORY_ICON: Record<CategoryKey, string> = {
  nutrition: 'leaf',
  vitamins: 'pill',
  metabolism: 'flame',
  hormones: 'sparkle',
  inflammation: 'shield',
  lifestyle: 'heart',
}

type FilterKey = 'all' | 'critical' | CategoryKey
const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'Все' },
  { key: 'critical', label: 'Важное' },
  { key: 'nutrition', label: 'Питание' },
  { key: 'vitamins', label: 'Витамины' },
  { key: 'metabolism', label: 'Метаболизм' },
  { key: 'hormones', label: 'Гормоны' },
  { key: 'inflammation', label: 'Воспаление' },
  { key: 'lifestyle', label: 'Образ жизни' },
]

const scoreLabel = (s: number) =>
  s >= 85 ? 'Отличный баланс' : s >= 70 ? 'Хорошо, с коррекцией' : s >= 50 ? 'Есть над чем работать' : 'Требует внимания'
const scoreColor = (s: number) => (s >= 85 ? '#a8e6a0' : s >= 70 ? 'var(--gold)' : s >= 50 ? '#ffc850' : '#ff8a6a')

export default function RecommendationsPage() {
  const router = useRouter()
  const [data, setData] = useState<Recommendations | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [filter, setFilter] = useState<FilterKey>('all')
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const [openBlock, setOpenBlock] = useState<string | null>(null)
  const [showAllProgram, setShowAllProgram] = useState(false)

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
  const program = data?.program ?? []
  const ready = signals.length > 0 || program.length > 0

  const filtered = useMemo(() => {
    if (filter === 'all') return signals
    if (filter === 'critical') return signals.filter((s) => s.severity === 'critical')
    return signals.filter((s) => s.categoryKey === filter)
  }, [signals, filter])

  const availableFilters = useMemo(() => {
    const cats = new Set(signals.map((s) => s.categoryKey))
    const hasCrit = signals.some((s) => s.severity === 'critical')
    return FILTERS.filter((f) => f.key === 'all' || (f.key === 'critical' ? hasCrit : cats.has(f.key as CategoryKey)))
  }, [signals])

  return (
    <main style={{ position: 'relative', minHeight: '100vh' }}>
      <AppBackground glow="16%" />
      <div style={{ position: 'relative', zIndex: 1 }}>
        <AppNav onBack={() => router.push('/dashboard')} backLabel="В кабинет" />
        <div style={{ maxWidth: '48rem', margin: '0 auto', padding: 'clamp(1.5rem,4vw,3rem) clamp(1.1rem,5vw,3rem) 6rem' }}>
          {!loaded ? (
            <SkeletonHero />
          ) : loadError ? (
            <ErrorState onRetry={loadData} />
          ) : !ready ? (
            <EmptyState onQuestionnaire={() => router.push('/questionnaire')} onUpload={() => router.push('/analyses/upload')} />
          ) : (
            <>
              <ScoreHero data={data!} />

              {data!.hasAnalyses && <FindingsPanel findings={data!.findings} sections={data!.sectionScores} />}

              {(!data?.hasQuestionnaire || !data?.hasAnalyses) && (
                <NextStepHints
                  needQuestionnaire={!data?.hasQuestionnaire}
                  needAnalyses={!data?.hasAnalyses}
                  onQuestionnaire={() => router.push('/questionnaire')}
                  onUpload={() => router.push('/analyses/upload')}
                />
              )}

              {signals.length > 0 && (
                <>
                  <SectionTitle icon="insight" eyebrow="Персональные сигналы" title="Что важно сейчас" style={{ marginTop: 'clamp(2.25rem,6vw,3.5rem)' }} />
                  <FilterBar filters={availableFilters} active={filter} onChange={setFilter} />
                  <motion.div layout style={{ marginTop: 18 }}>
                    <AnimatePresence mode="popLayout">
                      {filtered.map((sig, i) => (
                        <SignalCard
                          key={sig.id}
                          sig={sig}
                          index={i}
                          isOpen={!!open[sig.id]}
                          onToggle={() => setOpen((p) => ({ ...p, [sig.id]: !p[sig.id] }))}
                        />
                      ))}
                    </AnimatePresence>
                  </motion.div>
                </>
              )}

              <SectionTitle icon="leaf" eyebrow="Базовая программа" title="Образ жизни" style={{ marginTop: 'clamp(2.5rem,6vw,4rem)' }} />
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, lineHeight: 1.6, margin: '0 0 20px', maxWidth: '38rem' }}>
                Фундамент от нутрициолога. Разделы, отмеченные золотом, особенно важны для вас по данным анкеты.
              </p>
              <div style={{ display: 'grid', gap: 12 }}>
                {(showAllProgram ? program : program.slice(0, 5)).map((b, i) => (
                  <ProgramCard key={b.key} block={b} index={i} isOpen={openBlock === b.key} onToggle={() => setOpenBlock((k) => (k === b.key ? null : b.key))} />
                ))}
              </div>
              <ShowMoreBar expanded={showAllProgram} hiddenCount={showAllProgram ? 0 : Math.max(0, program.length - 5)} onToggle={() => setShowAllProgram((v) => !v)} />

              <InflammationPanel data={data!} />

              <LifehacksPanel hacks={data!.lifehacks} />

              <ConsultCta style={{ marginTop: 'clamp(2.25rem,6vw,3.5rem)' }} />

              <div style={{ marginTop: 40, display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
                <Button variant="gold" onClick={() => router.push('/analyses/upload')}>
                  Обновить анализы
                </Button>
                <p style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.4)', maxWidth: '28rem', lineHeight: 1.6, margin: 0 }}>
                  Рекомендации носят информационный характер. Перед изменением питания и приёмом добавок проконсультируйтесь с врачом.
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  )
}

// ── Hero with animated score ring ───────────────────────────────────────────
function ScoreHero({ data }: { data: Recommendations }) {
  const { healthScore, signals, criticalCount, warningCount } = data
  const hasScore = healthScore !== null
  const col = hasScore ? scoreColor(healthScore) : 'rgba(255,255,255,0.5)'
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      style={{ display: 'flex', alignItems: 'center', gap: 'clamp(1.25rem,4vw,2.25rem)', flexWrap: 'wrap', marginBottom: 'clamp(2rem,5vw,3rem)' }}
    >
      <ProgressRing value={hasScore ? healthScore : 0} size={112} stroke={7}>
        <div style={{ textAlign: 'center' }}>
          {hasScore ? (
            <>
              <div className="font-display" style={{ fontSize: 34, color: col, lineHeight: 1 }}>
                <AnimatedNumber value={healthScore} />
              </div>
              <div style={{ fontSize: 9.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>индекс</div>
            </>
          ) : (
            <div style={{ fontSize: 28, color: 'rgba(255,255,255,0.4)', lineHeight: 1 }}>—</div>
          )}
        </div>
      </ProgressRing>
      <div style={{ flex: 1, minWidth: 220 }}>
        <p className="eyebrow" style={{ marginBottom: 10 }}>Персональный профиль</p>
        <h1 className="font-display" style={{ fontWeight: 500, fontSize: 'clamp(2rem,5vw,3rem)', color: '#fff', lineHeight: 1.02, margin: 0 }}>
          Рекомендации
        </h1>
        <p style={{ color: col, fontSize: 15, margin: '10px 0 0', fontWeight: 500 }}>
          {hasScore ? scoreLabel(healthScore) : 'Загрузите анализы для расчёта индекса'}
        </p>
        <div style={{ display: 'flex', gap: 16, marginTop: 12, flexWrap: 'wrap' }}>
          <Stat n={signals.length} label="сигналов" />
          {criticalCount > 0 && <Stat n={criticalCount} label="важных" color="#ff8a6a" />}
          {warningCount > 0 && <Stat n={warningCount} label="внимание" color="#ffc850" />}
        </div>
      </div>
    </motion.div>
  )
}

// ── Marker findings: «ваше значение vs оптимум» с силой отклонения и советом ──
const fmtNum = (n: number | null) => (n === null ? '—' : Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, ''))

const FINDINGS_PREVIEW = 4

function FindingsPanel({ findings, sections }: { findings: Finding[]; sections: SectionScore[] }) {
  const [openKey, setOpenKey] = useState<string | null>(null)
  const [showAll, setShowAll] = useState(false)

  const severe = findings.filter((f) => f.status === 'severe').length
  const mild = findings.length - severe
  const visible = showAll ? findings : findings.slice(0, FINDINGS_PREVIEW)
  const hidden = findings.length - visible.length

  return (
    <section style={{ marginTop: 'clamp(2.25rem,6vw,3.5rem)' }}>
      <SectionTitle icon="lab" eyebrow="Анализы" title="Отклонения от оптимума" />

      {findings.length === 0 ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, borderRadius: 14, border: '1px solid rgba(150,210,140,0.22)', background: 'rgba(150,210,140,0.05)', padding: '16px 18px' }}>
          <span style={{ flexShrink: 0, display: 'grid', placeItems: 'center', width: 32, height: 32, borderRadius: 9, background: 'rgba(150,210,140,0.14)', color: '#a8e0a0', fontSize: 17 }}>✓</span>
          <p style={{ fontSize: 14.5, color: 'rgba(255,255,255,0.8)', lineHeight: 1.55, margin: 0 }}>Все распознанные показатели в пределах оптимума — отличная работа.</p>
        </div>
      ) : (
        <>
          {/* Дозированное резюме: сколько и насколько сильно */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', margin: '0 0 16px' }}>
            {severe > 0 && <Legend color={FINDING_SEV.severe.c} label={`${severe} сильных`} />}
            {mild > 0 && <Legend color={FINDING_SEV.mild.c} label={`${mild} умеренных`} />}
          </div>

          <div style={{ display: 'grid', gap: 10 }}>
            {visible.map((f, i) => (
              <FindingCard
                key={f.key}
                f={f}
                index={i}
                isOpen={openKey === f.key}
                onToggle={() => setOpenKey((k) => (k === f.key ? null : f.key))}
              />
            ))}
          </div>

          <ShowMoreBar expanded={showAll} hiddenCount={showAll ? 0 : hidden} onToggle={() => setShowAll((v) => !v)} />
        </>
      )}

      {/* Баллы по разделам — второстепенное, ниже findings и мельче */}
      {sections.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '20px 0 0' }}>
          {sections.map((s) => (
            <span key={s.section} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '5px 11px', borderRadius: 999, border: '1px solid rgba(255,255,255,0.09)', background: 'rgba(255,255,255,0.025)', fontSize: 12 }}>
              <span style={{ color: 'rgba(255,255,255,0.6)' }}>{s.title}</span>
              <span className="font-display" style={{ color: s.score >= 85 ? '#a8e6a0' : s.score >= 60 ? 'var(--gold)' : '#ff8a6a' }}>{s.score}</span>
            </span>
          ))}
        </div>
      )}
    </section>
  )
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12.5, color: 'rgba(255,255,255,0.6)' }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
      {label}
    </span>
  )
}

function FindingCard({ f, index, isOpen, onToggle }: { f: Finding; index: number; isOpen: boolean; onToggle: () => void }) {
  const sev = FINDING_SEV[f.status]
  const isLow = f.direction === 'low'
  const rec = f.recommendation
  // Если по маркеру есть сигнал (topics) — подробный протокол живёт в блоке
  // «Что важно сейчас». Здесь не дублируем шаги/продукты, только указываем на него.
  // Иначе показываем краткий персональный совет (его нет больше нигде).
  const linkedTopics = rec?.topics ?? []
  const hasSignal = linkedTopics.length > 0
  const hasRec = !!rec && (hasSignal || !!rec.summary)

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 8 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-30px' }}
      transition={{ duration: 0.32, delay: Math.min(index * 0.04, 0.2) }}
      style={{ borderRadius: 14, border: `1px solid ${isOpen ? sev.bd : 'rgba(255,255,255,0.1)'}`, background: isOpen ? sev.bg : 'rgba(255,255,255,0.025)', overflow: 'hidden', transition: 'border-color .25s, background .25s' }}
    >
      <button
        onClick={hasRec ? onToggle : undefined}
        aria-expanded={hasRec ? isOpen : undefined}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 13, padding: '13px 15px', background: 'none', border: 'none', textAlign: 'left', cursor: hasRec ? 'pointer' : 'default' }}
      >
        {/* Направление + сила отклонения (цвет) */}
        <span style={{ flexShrink: 0, display: 'grid', placeItems: 'center', width: 36, height: 36, borderRadius: 10, background: `${sev.c}1f`, color: sev.c, fontSize: 18 }}>
          {isLow ? '↓' : '↑'}
        </span>

        {/* Название + подпись «ниже/выше оптимума X–Y» */}
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
            <span style={{ color: '#fff', fontSize: 14.5, lineHeight: 1.3 }}>{f.display}</span>
            {f.source === 'lab' && (
              <span title="Оценено по норме из бланка — нет в справочнике нутрициолога" style={{ fontSize: 9, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.18)', borderRadius: 5, padding: '1px 5px' }}>
                лаб.
              </span>
            )}
          </span>
          <span style={{ display: 'block', fontSize: 12.5, color: 'rgba(255,255,255,0.5)', marginTop: 3 }}>
            {sev.label} · {isLow ? 'ниже' : 'выше'} {f.source === 'lab' ? 'нормы' : 'оптимума'} {fmtNum(f.optimumMin)}–{fmtNum(f.optimumMax)}
          </span>
        </span>

        {/* Значение + шеврон */}
        <span style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="font-display" style={{ fontSize: 20, color: sev.c, lineHeight: 1 }}>{fmtNum(f.value)}</span>
          {hasRec && <Chevron open={isOpen} />}
        </span>
      </button>

      <AnimatePresence initial={false}>
        {hasRec && isOpen && rec && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }} style={{ overflow: 'hidden' }}>
            <div style={{ padding: '2px 15px 15px 15px' }}>
              {/* Отбивка от шапки карточки */}
              <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '0 0 13px' }} />
              {hasSignal ? (
                // Протокол — в «Что важно сейчас», здесь только указатель (без дублей)
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <span style={{ flexShrink: 0, marginTop: 1, color: 'var(--gold)' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
                  </span>
                  <p style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.72)', lineHeight: 1.55, margin: 0 }}>
                    План действий — в блоке «Что важно сейчас»:{' '}
                    <span style={{ color: 'var(--gold)' }}>{linkedTopics.join(', ')}</span>
                  </p>
                </div>
              ) : (
                rec.summary && (
                  <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.82)', lineHeight: 1.6, margin: 0 }}>{rec.summary}</p>
                )
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.article>
  )
}

// ── Lifehacks: живые ежедневные приёмы ──────────────────────────────────────
const LIFEHACKS_PREVIEW = 4
function LifehacksPanel({ hacks }: { hacks: Lifehack[] }) {
  const [showAll, setShowAll] = useState(false)
  if (hacks.length === 0) return null
  const visible = showAll ? hacks : hacks.slice(0, LIFEHACKS_PREVIEW)
  return (
    <div style={{ marginTop: 'clamp(2.5rem,6vw,4rem)' }}>
      <SectionTitle icon="sparkle" eyebrow="Маленькие хитрости" title="Лайфхаки" />
      <div style={{ display: 'grid', gap: 12 }}>
        {visible.map((h, i) => (
          <motion.div
            key={h.title}
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.4, delay: Math.min(i * 0.05, 0.3) }}
            style={{ borderRadius: 15, border: '1px solid rgba(255,230,146,0.16)', background: 'rgba(255,230,146,0.035)', padding: '16px 17px' }}
          >
            <p className="font-display" style={{ fontWeight: 500, fontSize: 'clamp(1.05rem,2.6vw,1.2rem)', color: 'var(--gold)', margin: '0 0 6px' }}>{h.title}</p>
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.72)', lineHeight: 1.6, margin: 0 }}>{h.text}</p>
          </motion.div>
        ))}
      </div>
      <ShowMoreBar expanded={showAll} hiddenCount={showAll ? 0 : hacks.length - visible.length} onToggle={() => setShowAll((v) => !v)} />
    </div>
  )
}

function Stat({ n, label, color = 'rgba(255,255,255,0.85)' }: { n: number; label: string; color?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
      <span className="font-display" style={{ fontSize: 20, color, lineHeight: 1 }}>{n}</span>
      <span style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.5)' }}>{label}</span>
    </div>
  )
}

// ── Filter chips ────────────────────────────────────────────────────────────
function FilterBar({ filters, active, onChange }: { filters: typeof FILTERS; active: FilterKey; onChange: (k: FilterKey) => void }) {
  return (
    <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, margin: '4px -4px 0', scrollbarWidth: 'none' }}>
      {filters.map((f) => {
        const on = active === f.key
        return (
          <button
            key={f.key}
            onClick={() => onChange(f.key)}
            style={{
              flexShrink: 0,
              padding: '8px 15px',
              minHeight: 40,
              borderRadius: 999,
              fontFamily: 'var(--font-sans)',
              fontSize: 13.5,
              cursor: 'pointer',
              transition: 'all .2s',
              border: `1px solid ${on ? 'rgba(255,230,146,0.55)' : 'rgba(255,255,255,0.14)'}`,
              background: on ? 'rgba(255,230,146,0.14)' : 'rgba(255,255,255,0.03)',
              color: on ? 'var(--gold)' : 'rgba(255,255,255,0.6)',
            }}
          >
            {f.label}
          </button>
        )
      })}
    </div>
  )
}

// ── Expandable signal card ──────────────────────────────────────────────────
function SignalCard({ sig, index, isOpen, onToggle }: { sig: Signal; index: number; isOpen: boolean; onToggle: () => void }) {
  const s = SEV[sig.severity]
  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.35, delay: Math.min(index * 0.05, 0.3), ease: [0.22, 1, 0.36, 1] }}
      style={{
        borderRadius: 16,
        border: `1px solid ${isOpen ? s.ring : 'rgba(255,255,255,0.1)'}`,
        background: isOpen ? 'rgba(255,255,255,0.045)' : 'rgba(255,255,255,0.025)',
        marginBottom: 12,
        overflow: 'hidden',
        transition: 'border-color .25s, background .25s',
      }}
    >
      <button
        onClick={onToggle}
        aria-expanded={isOpen}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 14, padding: 'clamp(1rem,3vw,1.35rem)', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
      >
        <span style={{ display: 'grid', placeItems: 'center', width: 42, height: 42, borderRadius: 12, flexShrink: 0, background: 'rgba(255,230,146,0.09)' }}>
          <Icon name={CATEGORY_ICON[sig.categoryKey]} size={22} color={sig.severity === 'critical' ? '#ff9a7a' : 'var(--gold)'} />
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.dot }} />
            <span style={{ fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: s.c }}>
              {sig.category} · {s.l}
            </span>
          </span>
          <span className="font-display" style={{ display: 'block', fontWeight: 500, fontSize: 'clamp(1.15rem,3vw,1.35rem)', color: '#fff', lineHeight: 1.2 }}>
            {sig.title}
          </span>
          {!isOpen && <span style={{ display: 'block', fontSize: 13.5, color: 'rgba(255,255,255,0.55)', marginTop: 5, lineHeight: 1.5 }}>{sig.text}</span>}
        </span>
        <motion.span animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.3 }} style={{ flexShrink: 0, color: 'rgba(255,255,255,0.4)' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M6 9l6 6 6-6" /></svg>
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ padding: '0 clamp(1rem,3vw,1.35rem) clamp(1.1rem,3vw,1.4rem)', paddingLeft: 'clamp(1rem,3vw,1.35rem)' }}>
              <p style={{ fontSize: 14.5, color: 'rgba(255,255,255,0.72)', lineHeight: 1.6, margin: '0 0 14px' }}>{sig.text}</p>
              {sig.detail.length > 0 && (
                <ul style={{ listStyle: 'none', margin: '0 0 4px', padding: 0, display: 'flex', flexDirection: 'column', gap: 9 }}>
                  {sig.detail.map((d, i) => (
                    <li key={i} style={{ display: 'flex', gap: 10, fontSize: 14, color: 'rgba(255,255,255,0.75)', lineHeight: 1.5 }}>
                      <span style={{ flexShrink: 0, marginTop: 7, width: 5, height: 5, borderRadius: '50%', background: 'rgba(255,230,146,0.7)' }} />
                      {d}
                    </li>
                  ))}
                </ul>
              )}
              {sig.foods && <FoodLists foods={sig.foods} />}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.article>
  )
}

function FoodLists({ foods }: { foods: Foods }) {
  return (
    <div style={{ display: 'grid', gap: 12, gridTemplateColumns: foods.add && foods.avoid ? '1fr 1fr' : '1fr', marginTop: 14 }}>
      {foods.add && <FoodCol title="Добавить" items={foods.add} tone="add" />}
      {foods.avoid && <FoodCol title="Ограничить" items={foods.avoid} tone="avoid" />}
    </div>
  )
}
function FoodCol({ title, items, tone }: { title: string; items: string[]; tone: 'add' | 'avoid' }) {
  const c = tone === 'add' ? { bd: 'rgba(150,210,140,0.25)', bg: 'rgba(150,210,140,0.06)', tx: '#a8e0a0', sign: '+' } : { bd: 'rgba(255,140,110,0.22)', bg: 'rgba(255,140,110,0.05)', tx: '#ff9a7a', sign: '–' }
  return (
    <div style={{ borderRadius: 12, border: `1px solid ${c.bd}`, background: c.bg, padding: '12px 13px' }}>
      <p style={{ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: c.tx, margin: '0 0 9px' }}>{title}</p>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {items.map((it, i) => (
          <li key={i} style={{ display: 'flex', gap: 8, fontSize: 13.5, color: 'rgba(255,255,255,0.78)', lineHeight: 1.4 }}>
            <span style={{ flexShrink: 0, color: c.tx, fontWeight: 600 }}>{c.sign}</span>
            {it}
          </li>
        ))}
      </ul>
    </div>
  )
}

// ── Lifestyle program card ──────────────────────────────────────────────────
function ProgramCard({ block, index, isOpen, onToggle }: { block: ProgramBlock; index: number; isOpen: boolean; onToggle: () => void }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.4, delay: Math.min(index * 0.04, 0.25) }}
      style={{
        borderRadius: 15,
        border: `1px solid ${block.relevant ? 'rgba(255,230,146,0.3)' : 'rgba(255,255,255,0.09)'}`,
        background: block.relevant ? 'rgba(255,230,146,0.05)' : 'rgba(255,255,255,0.02)',
        overflow: 'hidden',
      }}
    >
      <button onClick={onToggle} aria-expanded={isOpen} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 14, padding: '15px 16px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
        <span style={{ display: 'grid', placeItems: 'center', width: 40, height: 40, borderRadius: 11, flexShrink: 0, background: block.relevant ? 'rgba(255,230,146,0.14)' : 'rgba(255,255,255,0.05)' }}>
          <Icon name={block.icon} size={21} color={block.relevant ? 'var(--gold)' : 'rgba(255,255,255,0.6)'} />
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="font-display" style={{ fontWeight: 500, fontSize: 'clamp(1.05rem,2.6vw,1.2rem)', color: '#fff' }}>{block.title}</span>
            {block.relevant && <span style={{ fontSize: 9.5, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--gold)', border: '1px solid rgba(255,230,146,0.4)', borderRadius: 6, padding: '2px 6px' }}>для вас</span>}
          </span>
          <span style={{ display: 'block', fontSize: 13.5, color: 'rgba(255,255,255,0.55)', marginTop: 4, lineHeight: 1.5 }}>{block.summary}</span>
        </span>
        <motion.span animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.3 }} style={{ flexShrink: 0, color: 'rgba(255,255,255,0.4)' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M6 9l6 6 6-6" /></svg>
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }} style={{ overflow: 'hidden' }}>
            <ul style={{ listStyle: 'none', margin: 0, padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {block.steps.map((st, i) => (
                <motion.li
                  key={i}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.05 + i * 0.05 }}
                  style={{ display: 'flex', gap: 11, fontSize: 14, color: 'rgba(255,255,255,0.75)', lineHeight: 1.55 }}
                >
                  <span className="font-display" style={{ flexShrink: 0, fontSize: 13, color: 'rgba(255,230,146,0.5)', marginTop: 1 }}>{String(i + 1).padStart(2, '0')}</span>
                  {st}
                </motion.li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ── Питание: продукты + принципы + индексы + горечи + сладкое ────────────────
type FoodTab = 'foods' | 'principles' | 'gi' | 'bitter' | 'sweet'
const FOOD_TABS: { key: FoodTab; label: string }[] = [
  { key: 'foods', label: 'Продукты' },
  { key: 'principles', label: 'Принципы' },
  { key: 'gi', label: 'ГИ и ИИ' },
  { key: 'bitter', label: 'Горечи' },
  { key: 'sweet', label: 'Сладкое' },
]
function TipList({ items }: { items: string[] }) {
  return (
    <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 11 }}>
      {items.map((t, i) => (
        <li key={i} style={{ display: 'flex', gap: 11, fontSize: 14, color: 'rgba(255,255,255,0.75)', lineHeight: 1.55, padding: '2px 0' }}>
          <span style={{ flexShrink: 0, marginTop: 7, width: 5, height: 5, borderRadius: '50%', background: 'rgba(255,230,146,0.7)' }} />
          {t}
        </li>
      ))}
    </ul>
  )
}
function InflammationPanel({ data }: { data: Recommendations }) {
  const [tab, setTab] = useState<FoodTab>('foods')
  return (
    <div style={{ marginTop: 'clamp(2.5rem,6vw,4rem)' }}>
      <SectionTitle icon="shield" eyebrow="Питание" title="Стол и привычки" />
      <div style={{ display: 'flex', gap: 8, marginBottom: 18, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none' }}>
        {FOOD_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{ flexShrink: 0, padding: '8px 15px', minHeight: 40, borderRadius: 999, fontFamily: 'var(--font-sans)', fontSize: 13.5, cursor: 'pointer', transition: 'all .2s', border: `1px solid ${tab === t.key ? 'rgba(255,230,146,0.55)' : 'rgba(255,255,255,0.14)'}`, background: tab === t.key ? 'rgba(255,230,146,0.14)' : 'rgba(255,255,255,0.03)', color: tab === t.key ? 'var(--gold)' : 'rgba(255,255,255,0.6)' }}
          >
            {t.label}
          </button>
        ))}
      </div>
      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }}>
          {tab === 'foods' && <FoodLists foods={{ add: data.inflammation.add, avoid: data.inflammation.avoid }} />}
          {tab === 'principles' && <TipList items={data.nutritionPrinciples} />}
          {tab === 'gi' && <TipList items={data.glycemicTips} />}
          {tab === 'bitter' && <TipList items={data.bitterTastes} />}
          {tab === 'sweet' && (
            <div>
              <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', margin: '0 0 12px', lineHeight: 1.5 }}>Натуральные замены сладкому — без резкого скачка инсулина:</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 9 }}>
                {data.dessertSwaps.map((d, i) => (
                  <span key={i} style={{ padding: '9px 14px', borderRadius: 999, border: '1px solid rgba(150,210,140,0.25)', background: 'rgba(150,210,140,0.06)', fontSize: 13.5, color: 'rgba(255,255,255,0.8)' }}>{d}</span>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

// ── Chrome ──────────────────────────────────────────────────────────────────
function SectionTitle({ icon, eyebrow, title, style = {} }: { icon: string; eyebrow: string; title: string; style?: React.CSSProperties }) {
  return (
    <div style={{ marginBottom: 14, ...style }}>
      <p className="eyebrow" style={{ marginBottom: 8 }}>{eyebrow}</p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
        <Icon name={icon} size={22} />
        <h2 className="font-display" style={{ fontWeight: 500, fontSize: 'clamp(1.5rem,4vw,2.1rem)', color: '#fff', lineHeight: 1.05, margin: 0 }}>{title}</h2>
      </div>
    </div>
  )
}

function NextStepHints({ needQuestionnaire, needAnalyses, onQuestionnaire, onUpload }: { needQuestionnaire: boolean; needAnalyses: boolean; onQuestionnaire: () => void; onUpload: () => void }) {
  return (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 28 }}>
      {needQuestionnaire && <HintChip onClick={onQuestionnaire}>Заполните анкету для точности</HintChip>}
      {needAnalyses && <HintChip onClick={onUpload}>Загрузите анализы для расширенного профиля</HintChip>}
    </div>
  )
}
function HintChip({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 14px', minHeight: 40, borderRadius: 999, border: '1px solid rgba(255,230,146,0.28)', background: 'rgba(255,230,146,0.05)', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(255,230,146,0.7)' }} />
      {children}
    </button>
  )
}

function SkeletonHero() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 20, opacity: 0.5 }}>
      <div className="shimmer" style={{ width: 112, height: 112, borderRadius: '50%' }} />
      <div style={{ flex: 1 }}>
        <div className="shimmer" style={{ width: '55%', height: 16, borderRadius: 8, marginBottom: 12 }} />
        <div className="shimmer" style={{ width: '80%', height: 34, borderRadius: 10 }} />
      </div>
    </div>
  )
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div style={{ borderRadius: 18, padding: '2.5rem 1.5rem', textAlign: 'center', background: 'rgba(255,120,100,0.06)', border: '1px solid rgba(255,120,100,0.22)' }}>
      <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 15, margin: '0 0 20px' }}>Не удалось загрузить данные</p>
      <Button variant="outline-gold" onClick={onRetry}>Повторить</Button>
    </div>
  )
}

function EmptyState({ onQuestionnaire, onUpload }: { onQuestionnaire: () => void; onUpload: () => void }) {
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} style={{ minHeight: '58vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
      <img src="/assets/brand/monogram.svg" alt="" width={72} style={{ marginBottom: 24, opacity: 0.9 }} />
      <h1 className="font-display" style={{ fontWeight: 500, fontSize: 'clamp(2rem,4vw,3rem)', color: '#fff', lineHeight: 1.1, margin: '0 auto 1.25rem', maxWidth: '24rem' }}>
        Заполните анкету и загрузите анализы
      </h1>
      <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 15, margin: '0 auto 2.25rem', maxWidth: '26rem', lineHeight: 1.6 }}>
        Алгоритм сформирует персональные рекомендации на основе ваших данных.
      </p>
      <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
        <Button variant="gold" size="md" onClick={onQuestionnaire}>Заполнить анкету</Button>
        <Button variant="outline-gold" size="md" onClick={onUpload}>Загрузить анализы</Button>
      </div>
    </motion.div>
  )
}
