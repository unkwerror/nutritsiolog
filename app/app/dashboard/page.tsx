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
  initial: {},
  animate: { transition: { staggerChildren: 0.1, delayChildren: 0.05 } },
}

const item: Variants = {
  initial: { opacity: 0, y: 32 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.7, ease } },
}

const STATUS_LABEL: Record<AnalysisStatus, string> = {
  pending: 'В очереди',
  processing: 'Обработка',
  done: 'Готово',
  failed: 'Ошибка',
}

const STATUS_DOT: Record<AnalysisStatus, string> = {
  pending: '#9a9a9a',
  processing: '#4a7c59',
  done: '#4a7c59',
  failed: '#b4342b',
}

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(new Date(iso))
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

export default function DashboardPage() {
  const router = useRouter()
  const { user, isLoading: authLoading } = useAuth()
  const [analyses, setAnalyses] = useState<AnalysisListItem[]>([])
  const [loaded, setLoaded] = useState(false)

  // Auth guard
  useEffect(() => {
    if (!authLoading && !user && !getAccessToken()) router.replace('/auth')
  }, [authLoading, user, router])

  useEffect(() => {
    if (!getAccessToken()) return
    apiRequest<AnalysisListItem[]>('/api/v1/analysis')
      .then((list) => setAnalyses(Array.isArray(list) ? list : []))
      .catch(() => setAnalyses([]))
      .finally(() => setLoaded(true))
  }, [])

  const analysisCount = analyses.length
  const hasDone = analyses.some((a) => a.status === 'done')

  const firstName = user?.firstName ?? user?.email?.split('@')[0] ?? ''

  const steps = [
    {
      n: '01',
      title: 'Анкета',
      status: 'Не заполнена',
      statusDot: null as string | null,
      cta: 'Заполнить',
      href: '/questionnaire',
    },
    {
      n: '02',
      title: 'Анализы',
      status: analysisCount > 0 ? `${analysisCount} загружено` : 'Нет анализов',
      statusDot: analysisCount > 0 ? '#4a7c59' : null,
      cta: 'Загрузить',
      href: '/analyses/upload',
    },
    {
      n: '03',
      title: 'Рекомендации',
      status: hasDone ? 'Доступны' : 'Нужны анализы',
      statusDot: hasDone ? '#4a7c59' : null,
      cta: 'Смотреть',
      href: '/recommendations',
    },
  ]

  return (
    <main className="min-h-screen bg-white text-[#181818]">
      <Navbar transparent={false} />

      <div className="mx-auto max-w-4xl px-6 sm:px-10 lg:px-16 pt-32 pb-28">
        <motion.div variants={container} initial="initial" animate="animate">
          {/* Greeting */}
          <motion.div variants={item} className="mb-16 sm:mb-20">
            <p className="font-sans text-[11px] tracking-[0.28em] uppercase text-[#6d6d6d] mb-5">
              Личный кабинет
            </p>
            <h1
              className="font-display font-light leading-[1.02] text-[#181818]"
              style={{ fontSize: 'clamp(2.4rem, 5vw, 4.5rem)' }}
            >
              Добро пожаловать,
              <br />
              {firstName}
            </h1>
          </motion.div>

          {/* Journey steps */}
          <div className="border-t border-[#181818]/10">
            {steps.map((s) => (
              <motion.div
                key={s.n}
                variants={item}
                className="group relative flex items-center justify-between gap-4 border-b border-[#181818]/10 py-8 sm:py-10"
              >
                <div className="flex items-center gap-5 sm:gap-8 min-w-0">
                  <span
                    className="font-display font-light leading-none select-none"
                    style={{ fontSize: 'clamp(2.6rem, 7vw, 4.6rem)', color: 'rgba(24,24,24,0.06)' }}
                    aria-hidden
                  >
                    {s.n}
                  </span>
                  <div className="min-w-0">
                    <h2 className="font-display font-light text-2xl sm:text-3xl text-[#181818] leading-tight">
                      {s.title}
                    </h2>
                    <div className="mt-1.5 flex items-center gap-2">
                      {s.statusDot && (
                        <span
                          className="inline-block h-1.5 w-1.5 rounded-full"
                          style={{ background: s.statusDot }}
                        />
                      )}
                      <span className="font-sans text-sm text-[#6d6d6d]">{s.status}</span>
                    </div>
                  </div>
                </div>

                <Link
                  href={s.href}
                  className="shrink-0 font-sans text-[13px] tracking-[0.08em] uppercase text-[#181818] inline-flex items-center gap-2 transition-opacity hover:opacity-60"
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
              <h3 className="font-display font-light text-2xl text-[#181818]">
                Последние анализы
              </h3>
              {analysisCount > 0 && (
                <Link
                  href="/analyses/upload"
                  className="font-sans text-[12px] tracking-[0.08em] uppercase text-[#6d6d6d] transition-colors hover:text-[#181818]"
                >
                  Все →
                </Link>
              )}
            </div>

            {!loaded ? (
              <p className="font-sans text-sm text-[#9a9a9a]">Загрузка…</p>
            ) : analysisCount === 0 ? (
              <div className="border border-dashed border-[#181818]/15 rounded-[14px] px-6 py-10 text-center">
                <p className="font-sans text-sm text-[#6d6d6d] mb-5">
                  Вы ещё не загрузили ни одного анализа
                </p>
                <Link href="/analyses/upload" className="btn-primary-dark text-sm">
                  Загрузить анализ
                </Link>
              </div>
            ) : (
              <ul className="border-t border-[#181818]/10">
                {analyses.slice(0, 3).map((a) => (
                  <li
                    key={a.id}
                    className="flex items-center justify-between gap-4 border-b border-[#181818]/10 py-4"
                  >
                    <div className="min-w-0">
                      <p className="font-sans text-[15px] text-[#181818] truncate">
                        {typeLabel(a)}
                      </p>
                      <p className="font-sans text-[12px] text-[#9a9a9a] mt-0.5">
                        {formatDate(a.createdAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className="inline-block h-1.5 w-1.5 rounded-full"
                        style={{ background: STATUS_DOT[a.status] }}
                      />
                      <span className="font-sans text-[13px] text-[#6d6d6d]">
                        {STATUS_LABEL[a.status]}
                      </span>
                    </div>
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
