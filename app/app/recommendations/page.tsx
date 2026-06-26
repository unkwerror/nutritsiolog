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

type Recommendation = { category: string; text: string }

const RECOMMENDATIONS: Recommendation[] = [
  {
    category: 'Питание',
    text: 'Увеличьте потребление омега-3: добавьте жирную рыбу (лосось, скумбрия) 2–3 раза в неделю или рассмотрите добавку 2 г EPA+DHA.',
  },
  {
    category: 'Витамины',
    text: 'Ваш уровень витамина D требует внимания. Рекомендуется 2000–4000 МЕ в день, лучше в первой половине дня с жирной пищей.',
  },
  {
    category: 'Активность',
    text: '30 минут умеренной аэробной нагрузки 4–5 раз в неделю снижают воспалительные маркеры и улучшают инсулинорезистентность.',
  },
  {
    category: 'Сон',
    text: 'Хронический недосып повышает кортизол и снижает восстановление. Приоритизируйте 7–8 часов, ложитесь до 23:00.',
  },
  {
    category: 'Стресс',
    text: 'Практики осознанного дыхания и короткие прогулки в течение дня помогают стабилизировать кортизол и поддержать пищеварение.',
  },
]

export default function RecommendationsPage() {
  const router = useRouter()
  const { user, isLoading: authLoading } = useAuth()
  const [analyses, setAnalyses] = useState<AnalysisListItem[]>([])
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
  }, [])

  const hasAnalyses = analyses.length > 0

  return (
    <main
      className="min-h-screen"
      style={{ background: 'linear-gradient(160deg, #35462f 0%, #4a6040 60%, #3d5435 100%)' }}
    >
      <Navbar transparent={false} variant="dark" />

      <div className="mx-auto max-w-4xl px-6 sm:px-10 lg:px-16 pt-32 pb-28">
        <motion.div variants={container} initial="initial" animate="animate">

          <motion.div variants={item} className="mb-12">
            <p className="font-sans text-[11px] tracking-[0.28em] uppercase text-white/40 mb-5">
              Персональный профиль
            </p>
            <h1
              className="font-display font-light leading-[1.02] text-white"
              style={{ fontSize: 'clamp(2.4rem, 5vw, 4.5rem)' }}
            >
              Рекомендации
            </h1>
          </motion.div>

          {!loaded ? (
            <motion.p variants={item} className="font-sans text-sm text-white/35">
              Загрузка…
            </motion.p>
          ) : !hasAnalyses ? (
            /* Empty state */
            <motion.div
              variants={item}
              className="glass-modal rounded-[20px] px-8 py-16 sm:px-14 sm:py-20 text-center"
            >
              <p className="font-sans text-[11px] tracking-[0.28em] uppercase text-white/35 mb-6">
                Пока пусто
              </p>
              <h2
                className="font-display font-light leading-[1.1] text-white mb-8 mx-auto max-w-lg"
                style={{ fontSize: 'clamp(1.8rem, 3.4vw, 2.8rem)' }}
              >
                Загрузите анализы, чтобы получить персональные рекомендации
              </h2>
              <Link href="/analyses/upload" className="btn-gold text-sm">
                Загрузить анализы
              </Link>
            </motion.div>
          ) : (
            <>
              <motion.p variants={item} className="font-sans text-[15px] text-white/55 mb-12 max-w-xl">
                На основе ваших анализов мы подготовили предварительный набор рекомендаций.
                Финальный профиль формируется нутрициологом.
              </motion.p>

              {/* Recommendation cards */}
              <div className="border-t border-white/10">
                {RECOMMENDATIONS.map((rec, i) => (
                  <motion.article
                    key={rec.category}
                    variants={item}
                    className="group border-b border-white/10 py-8 sm:py-10"
                    style={{ transitionDelay: `${i * 0.05}s` }}
                  >
                    <div className="flex items-start gap-6 sm:gap-10">
                      <span
                        className="font-display font-light leading-none select-none shrink-0 mt-1"
                        style={{ fontSize: 'clamp(2rem, 5vw, 3.2rem)', color: 'rgba(255,255,255,0.06)' }}
                        aria-hidden
                      >
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <div className="min-w-0">
                        <p className="font-sans text-[11px] tracking-[0.22em] uppercase mb-3"
                          style={{ color: 'rgba(255,230,146,0.65)' }}>
                          {rec.category}
                        </p>
                        <p className="font-sans text-[16px] leading-relaxed text-white/85">
                          {rec.text}
                        </p>
                      </div>
                    </div>
                  </motion.article>
                ))}
              </div>

              <motion.p
                variants={item}
                className="font-sans text-[12px] text-white/30 mt-14 max-w-2xl"
              >
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
