'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, type Variants } from 'framer-motion'
import { apiRequest, getAccessToken } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { Navbar } from '@/components/Navbar'

type AnalysisStatus = 'pending' | 'processing' | 'done' | 'failed'

type AnalysisListItem = {
  id: number
  status: AnalysisStatus
  analysisTypes: string | string[] | null
  createdAt: string
  patientName: string | null
}

const ease: [number, number, number, number] = [0.25, 0.46, 0.45, 0.94]

const container: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1, delayChildren: 0.05 } },
}
const item: Variants = {
  hidden: { opacity: 0, y: 32 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease } },
}

const STATUS_LABEL: Record<AnalysisStatus, string> = {
  pending: 'В очереди', processing: 'Обработка', done: 'Готово', failed: 'Ошибка',
}

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(iso))
  } catch { return iso }
}

function typeLabel(a: AnalysisListItem): string {
  const t = a.analysisTypes
  if (Array.isArray(t) && t.length > 0) return t.join(', ')
  if (typeof t === 'string' && t.trim().length > 0) return t
  return `Анализ #${a.id}`
}

export default function DashboardPage() {
  const router = useRouter()
  const { user, isLoading: authLoading } = useAuth()
  const [analyses, setAnalyses] = useState<AnalysisListItem[]>([])
  const [hasQuestionnaire, setHasQuestionnaire] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!authLoading && !user && !getAccessToken()) router.replace('/auth')
  }, [authLoading, user, router])

  useEffect(() => {
    if (!getAccessToken()) return
    apiRequest<AnalysisListItem[]>('/api/v1/analysis')
      .then((list) => setAnalyses(Array.isArray(list) ? list : []))
      .catch(() => setAnalyses([]))
      .finally(() => setLoaded(true))
    apiRequest<{ id: number } | null>('/api/v1/questionnaire/my')
      .then((q) => setHasQuestionnaire(!!q))
      .catch(() => setHasQuestionnaire(false))
  }, [])

  const analysisCount = analyses.length
  const hasDone = analyses.some((a) => a.status === 'done')
  const firstName = user?.firstName ?? user?.email?.split('@')[0] ?? ''

  const steps = [
    {
      n: '01', title: 'Анкета',
      status: hasQuestionnaire ? 'Заполнена' : 'Не заполнена',
      hasStatus: hasQuestionnaire,
      cta: hasQuestionnaire ? 'Изменить' : 'Заполнить', href: '/questionnaire',
    },
    {
      n: '02', title: 'Анализы',
      status: analysisCount > 0 ? `${analysisCount} загружено` : 'Нет анализов',
      hasStatus: analysisCount > 0,
      cta: 'Загрузить', href: '/analyses/upload',
    },
    {
      n: '03', title: 'Рекомендации',
      status: hasDone ? 'Доступны' : 'Нужны анализы',
      hasStatus: hasDone,
      cta: 'Смотреть', href: '/recommendations',
    },
  ]

  return (
    <main className="min-h-screen" style={{ background: 'linear-gradient(160deg, #35462f 0%, #4a6040 60%, #3d5435 100%)' }}>
      <Navbar />

      <div className="mx-auto max-w-4xl px-6 sm:px-10 lg:px-16 pt-32 pb-28">
        <motion.div variants={container} initial="hidden" animate="visible">

          {/* Greeting */}
          <motion.div variants={item} className="mb-16 sm:mb-20">
            <p className="font-sans text-[11px] tracking-[0.28em] uppercase text-white/40 mb-5">
              Личный кабинет
            </p>
            <h1
              className="font-display font-light leading-[1.02] text-white"
              style={{ fontSize: 'clamp(2.4rem, 5vw, 4.5rem)' }}
            >
              Добро пожаловать,<br />{firstName}
            </h1>
          </motion.div>

          {/* Journey steps */}
          <div className="border-t border-white/10">
            {steps.map((s) => (
              <motion.div
                key={s.n}
                variants={item}
                className="group flex items-center justify-between gap-4 border-b border-white/10 py-8 sm:py-10"
              >
                <div className="flex items-center gap-5 sm:gap-8 min-w-0">
                  <span
                    className="font-display font-light leading-none select-none shrink-0"
                    style={{ fontSize: 'clamp(2.6rem, 7vw, 4.6rem)', color: 'rgba(255,255,255,0.06)' }}
                    aria-hidden
                  >
                    {s.n}
                  </span>
                  <div className="min-w-0">
                    <h2 className="font-display font-light text-2xl sm:text-3xl text-white leading-tight">
                      {s.title}
                    </h2>
                    <div className="mt-1.5 flex items-center gap-2">
                      {s.hasStatus && (
                        <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#ffe692]" />
                      )}
                      <span className="font-sans text-sm" style={{ color: s.hasStatus ? 'rgba(255,230,146,0.8)' : 'rgba(255,255,255,0.45)' }}>
                        {s.status}
                      </span>
                    </div>
                  </div>
                </div>

                <Link
                  href={s.href}
                  className="shrink-0 font-sans text-[13px] tracking-[0.1em] uppercase text-white/55 inline-flex items-center gap-2 transition-all hover:text-[#ffe692]"
                >
                  <span className="hidden sm:inline">{s.cta}</span>
                  <span className="transition-transform group-hover:translate-x-1">→</span>
                </Link>
              </motion.div>
            ))}
          </div>

          {/* Recent analyses */}
          <motion.section variants={item} className="mt-16 sm:mt-20">
            <div className="flex items-baseline justify-between mb-6">
              <h3 className="font-display font-light text-2xl text-white">Последние анализы</h3>
              {analysisCount > 0 && (
                <Link href="/analyses/upload" className="font-sans text-[12px] tracking-[0.08em] uppercase text-white/35 hover:text-[#ffe692] transition-colors">
                  Все →
                </Link>
              )}
            </div>

            {!loaded ? (
              <p className="font-sans text-sm text-white/35">Загрузка…</p>
            ) : analysisCount === 0 ? (
              <div className="glass-card rounded-2xl px-6 py-10 text-center flex flex-col items-center gap-5">
                <p className="font-sans text-sm text-white/50 mb-1">Вы ещё не загрузили ни одного анализа</p>
                <Link href="/analyses/upload" className="btn-gold text-sm">Загрузить анализ</Link>
              </div>
            ) : (
              <ul className="border-t border-white/10">
                {analyses.slice(0, 3).map((a) => (
                  <li key={a.id} className="border-b border-white/10">
                    <Link
                      href={`/analyses/${a.id}`}
                      className="group flex items-center justify-between gap-4 py-4 transition-colors"
                    >
                      <div className="min-w-0">
                        <p className="font-sans text-sm text-white truncate group-hover:text-[#ffe692] transition-colors">{typeLabel(a)}</p>
                        <p className="font-sans text-xs text-white/40 mt-0.5">{formatDate(a.createdAt)}</p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="font-sans text-xs" style={{ color: a.status === 'done' ? 'rgba(255,230,146,0.8)' : a.status === 'failed' ? 'rgba(180,52,43,0.9)' : 'rgba(255,255,255,0.45)' }}>
                          {STATUS_LABEL[a.status]}
                        </span>
                        <span className="text-white/30 transition-transform group-hover:translate-x-1" aria-hidden>→</span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </motion.section>

        </motion.div>
      </div>
    </main>
  )
}
