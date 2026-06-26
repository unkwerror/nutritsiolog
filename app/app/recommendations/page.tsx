'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, type Variants } from 'framer-motion'
import { apiRequest, getAccessToken } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { Navbar } from '@/components/Navbar'

const ease: [number, number, number, number] = [0.25, 0.46, 0.45, 0.94]

const container: Variants = {
  initial: {},
  animate: { transition: { staggerChildren: 0.09, delayChildren: 0.05 } },
}
const item: Variants = {
  initial: { opacity: 0, y: 28 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.65, ease } },
}

type Signal = {
  category: string
  title: string
  text: string
  severity: 'info' | 'warning' | 'critical'
  sources: string[]
}

type RecommendationsResponse = {
  signals: Signal[]
  hasQuestionnaire: boolean
  hasAnalyses: boolean
}

const SEVERITY_COLOR: Record<Signal['severity'], string> = {
  info: 'rgba(255,255,255,0.35)',
  warning: 'rgba(255,200,80,0.85)',
  critical: 'rgba(255,120,100,0.9)',
}
const SEVERITY_DOT: Record<Signal['severity'], string> = {
  info: 'rgba(255,255,255,0.35)',
  warning: '#ffe692',
  critical: '#ff9a9a',
}
const SEVERITY_LABEL: Record<Signal['severity'], string> = {
  info: 'Рекомендация',
  warning: 'Внимание',
  critical: 'Важно',
}

export default function RecommendationsPage() {
  const router = useRouter()
  const { user, isLoading: authLoading } = useAuth()
  const [data, setData] = useState<RecommendationsResponse | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!authLoading && !user && !getAccessToken()) router.replace('/auth')
  }, [authLoading, user, router])

  useEffect(() => {
    if (!getAccessToken()) return
    apiRequest<RecommendationsResponse>('/api/v1/profile/recommendations')
      .then(setData)
      .catch(() => setData({ signals: [], hasQuestionnaire: false, hasAnalyses: false }))
      .finally(() => setLoaded(true))
  }, [])

  const bg = 'linear-gradient(160deg, #35462f 0%, #4a6040 60%, #3d5435 100%)'

  return (
    <main className="min-h-screen" style={{ background: bg }}>
      <Navbar transparent={false} variant="dark" />

      <div className="mx-auto max-w-4xl px-6 sm:px-10 lg:px-16 pt-32 pb-28">
        <motion.div variants={container} initial="initial" animate="animate">

          <motion.div variants={item} className="mb-14">
            <p className="font-sans text-[11px] tracking-[0.28em] uppercase text-white/40 mb-5">
              Персональный профиль
            </p>
            <h1 className="font-display font-light leading-[1.02] text-white" style={{ fontSize: 'clamp(2.4rem, 5vw, 4.5rem)' }}>
              Рекомендации
            </h1>
          </motion.div>

          {!loaded ? (
            <motion.p variants={item} className="font-sans text-sm text-white/35">Загрузка…</motion.p>
          ) : !data?.hasQuestionnaire && !data?.hasAnalyses ? (
            /* Nothing yet */
            <motion.div variants={item} className="glass-modal rounded-[20px] px-8 py-16 sm:px-14 sm:py-20 text-center">
              <p className="font-sans text-[11px] tracking-[0.28em] uppercase text-white/35 mb-6">Начните работу</p>
              <h2 className="font-display font-light text-white mb-6 mx-auto max-w-lg leading-tight"
                style={{ fontSize: 'clamp(1.8rem, 3.4vw, 2.8rem)' }}>
                Заполните анкету и загрузите анализы
              </h2>
              <p className="font-sans text-white/45 text-sm mb-10 max-w-md mx-auto">
                Алгоритм сформирует персональные рекомендации на основе ваших данных.
              </p>
              <div className="flex flex-wrap gap-3 justify-center">
                <Link href="/questionnaire" className="btn-gold text-sm">Заполнить анкету</Link>
                <Link href="/analyses/upload" className="btn-outline-gold text-sm">Загрузить анализы</Link>
              </div>
            </motion.div>
          ) : data.signals.length === 0 ? (
            /* Has data but no signals */
            <motion.div variants={item}>
              {!data.hasQuestionnaire && (
                <div className="glass-card rounded-2xl px-6 py-8 mb-6 flex items-center justify-between gap-4">
                  <div>
                    <p className="font-sans text-sm text-white/80 mb-1">Анкета не заполнена</p>
                    <p className="font-sans text-[13px] text-white/45">Ответьте на вопросы — алгоритм учтёт образ жизни</p>
                  </div>
                  <Link href="/questionnaire" className="btn-gold text-xs shrink-0">Заполнить</Link>
                </div>
              )}
              {!data.hasAnalyses && (
                <div className="glass-card rounded-2xl px-6 py-8 flex items-center justify-between gap-4">
                  <div>
                    <p className="font-sans text-sm text-white/80 mb-1">Анализы не загружены</p>
                    <p className="font-sans text-[13px] text-white/45">Загрузите результаты для полного профиля</p>
                  </div>
                  <Link href="/analyses/upload" className="btn-gold text-xs shrink-0">Загрузить</Link>
                </div>
              )}
              <p className="font-sans text-sm text-white/40 mt-8">
                Рекомендации появятся после обработки анализов.
              </p>
            </motion.div>
          ) : (
            <>
              {/* Hints if something is missing */}
              {(!data.hasQuestionnaire || !data.hasAnalyses) && (
                <motion.div variants={item} className="flex gap-3 flex-wrap mb-10">
                  {!data.hasQuestionnaire && (
                    <Link href="/questionnaire"
                      className="inline-flex items-center gap-2 font-sans text-[13px] text-white/55 hover:text-[#ffe692] transition-colors">
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#ffe692]/60" />
                      Заполните анкету для уточнения рекомендаций
                    </Link>
                  )}
                  {!data.hasAnalyses && (
                    <Link href="/analyses/upload"
                      className="inline-flex items-center gap-2 font-sans text-[13px] text-white/55 hover:text-[#ffe692] transition-colors">
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#ffe692]/60" />
                      Загрузите анализы для расширенного профиля
                    </Link>
                  )}
                </motion.div>
              )}

              {/* Signals */}
              <div className="border-t border-white/10">
                {data.signals.map((sig, i) => (
                  <motion.article key={`${sig.title}-${i}`} variants={item}
                    className="border-b border-white/10 py-8 sm:py-10">
                    <div className="flex items-start gap-5 sm:gap-8">
                      <span
                        className="font-display font-light leading-none select-none shrink-0 mt-1"
                        style={{ fontSize: 'clamp(2rem,4vw,3rem)', color: 'rgba(255,255,255,0.05)' }}
                        aria-hidden
                      >
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2.5 mb-2">
                          <span className="inline-block h-1.5 w-1.5 rounded-full shrink-0"
                            style={{ background: SEVERITY_DOT[sig.severity] }} />
                          <span className="font-sans text-[11px] tracking-[0.2em] uppercase"
                            style={{ color: SEVERITY_COLOR[sig.severity] }}>
                            {sig.category} · {SEVERITY_LABEL[sig.severity]}
                          </span>
                        </div>
                        <h3 className="font-display font-light text-xl sm:text-2xl text-white mb-3 leading-tight">
                          {sig.title}
                        </h3>
                        <p className="font-sans text-[15px] leading-relaxed text-white/70">{sig.text}</p>
                      </div>
                    </div>
                  </motion.article>
                ))}
              </div>

              <motion.p variants={item} className="font-sans text-[12px] text-white/25 mt-12 max-w-2xl">
                Рекомендации носят информационный характер. Перед изменением режима питания
                и приёма добавок проконсультируйтесь с врачом.
              </motion.p>
            </>
          )}

        </motion.div>
      </div>
    </main>
  )
}
