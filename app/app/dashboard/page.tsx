'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { apiRequest, getAccessToken } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { Navbar } from '@/components/Navbar'

type Analysis = {
  id: number
  status: 'pending' | 'processing' | 'done' | 'failed'
  analysisTypes: string | null
  createdAt: string
  fileName?: string
}

const STATUS_UI = {
  pending:    { label: 'В очереди',  dot: 'bg-white/30', text: 'text-white/55' },
  processing: { label: 'Обрабатывается', dot: 'bg-[#ffe692] animate-pulse', text: 'text-[#ffe692]' },
  done:       { label: 'Готово',    dot: 'bg-green-400',  text: 'text-green-300' },
  failed:     { label: 'Ошибка',    dot: 'bg-red-400',    text: 'text-red-300' },
}

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { duration: 0.4, delay: i * 0.07 } }),
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
}

export default function DashboardPage() {
  const router = useRouter()
  const { user, isLoading: authLoading } = useAuth()
  const [analyses, setAnalyses] = useState<Analysis[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!authLoading && !user && !getAccessToken()) {
      router.replace('/auth')
    }
  }, [authLoading, user, router])

  useEffect(() => {
    if (authLoading) return
    apiRequest<Analysis[]>('/api/v1/analyses')
      .then(setAnalyses)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Ошибка загрузки'))
      .finally(() => setLoading(false))
  }, [authLoading])

  const greeting = user?.firstName ? `Привет, ${user.firstName}` : 'Добро пожаловать'

  return (
    <main
      className="min-h-screen relative overflow-hidden"
      style={{ background: 'linear-gradient(to bottom, #35462f 0%, #4a6040 55%, #acbe9b 100%)' }}
    >
      {/* Subtle bg */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden>
        <img src="/assets/hero-bg.jpg" alt="" className="w-full h-full object-cover opacity-15" />
      </div>

      <div className="relative z-10 flex flex-col min-h-screen">
        <Navbar transparent />

        <div className="flex-1 max-w-3xl mx-auto w-full px-4 sm:px-8 py-8 sm:py-12">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-10"
          >
            <div>
              <h1 className="text-white font-light text-3xl sm:text-4xl mb-1">{greeting}</h1>
              <p className="text-white/45 text-sm">{user?.email}</p>
            </div>
            <Link
              href="/analyses/upload"
              className="btn-gold shrink-0 text-sm"
              style={{ minHeight: '44px', padding: '0 1.25rem' }}
            >
              + Загрузить анализы
            </Link>
          </motion.div>

          {/* Analyses */}
          <div>
            <h2 className="text-white/70 text-sm font-medium uppercase tracking-wider mb-4">
              Мои анализы
            </h2>

            {loading && (
              <div className="flex justify-center py-16">
                <div className="w-8 h-8 border-2 border-white/20 border-t-[#ffe692] rounded-full animate-spin" />
              </div>
            )}

            {error && (
              <p className="text-red-300 text-sm bg-red-500/10 rounded-xl px-4 py-3">{error}</p>
            )}

            {!loading && !error && analyses.length === 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="glass-modal rounded-2xl p-10 text-center flex flex-col items-center gap-5"
              >
                <div className="w-16 h-16 rounded-2xl glass-step flex items-center justify-center text-white/30 text-3xl">
                  ◎
                </div>
                <div>
                  <p className="text-white/70 text-base mb-1">Анализов пока нет</p>
                  <p className="text-white/40 text-sm">Загрузите результаты — мы их автоматически распознаем</p>
                </div>
                <Link href="/analyses/upload" className="btn-gold text-sm" style={{ minHeight: '44px', padding: '0 1.5rem' }}>
                  Загрузить анализы
                </Link>
              </motion.div>
            )}

            {!loading && !error && analyses.length > 0 && (
              <div className="flex flex-col gap-3">
                {analyses.map((a, i) => {
                  const ui = STATUS_UI[a.status] ?? STATUS_UI.pending
                  return (
                    <motion.div
                      key={a.id}
                      custom={i}
                      variants={fadeUp}
                      initial="hidden"
                      animate="visible"
                      className="glass-step rounded-2xl p-4 sm:p-5 flex items-center gap-4 hover:bg-white/5 transition-colors"
                    >
                      {/* Status dot */}
                      <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${ui.dot}`} />

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-white/85 text-sm font-medium truncate">
                          {a.analysisTypes ?? `Анализ #${a.id}`}
                        </p>
                        <p className="text-white/40 text-xs mt-0.5">{formatDate(a.createdAt)}</p>
                      </div>

                      {/* Status label */}
                      <span className={`text-xs shrink-0 ${ui.text}`}>{ui.label}</span>
                    </motion.div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
