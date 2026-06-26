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

  const hasAnalyses = analyses.length > 0

  return (
    <main className="min-h-screen bg-white text-[#181818]">
      <Navbar transparent={false} />

      <div className="mx-auto max-w-4xl px-6 sm:px-10 lg:px-16 pt-32 pb-28">
        <motion.div variants={container} initial="initial" animate="animate">
          <motion.div variants={item} className="mb-12">
            <p className="font-sans text-[11px] tracking-[0.28em] uppercase text-[#6d6d6d] mb-5">
              Персональный профиль
            </p>
            <h1
              className="font-display font-light leading-[1.02] text-[#181818]"
              style={{ fontSize: 'clamp(2.4rem, 5vw, 4.5rem)' }}
            >
              Рекомендации
            </h1>
          </motion.div>

          {!loaded ? (
            <motion.p variants={item} className="font-sans text-sm text-[#9a9a9a]">
              Загрузка…
            </motion.p>
          ) : !hasAnalyses ? (
            /* Empty state — immersive black CTA block */
            <motion.div
              variants={item}
              className="rounded-[18px] bg-black px-8 py-16 sm:px-14 sm:py-20 text-center"
            >
              <p className="font-sans text-[11px] tracking-[0.28em] uppercase text-white/45 mb-6">
                Пока пусто
              </p>
              <h2
                className="font-display font-light leading-[1.1] text-white mb-8 mx-auto max-w-lg"
                style={{ fontSize: 'clamp(1.8rem, 3.4vw, 2.8rem)' }}
              >
                Загрузите анализы, чтобы получить персональные рекомендации
              </h2>
              <Link href="/analyses/upload" className="btn-primary text-sm">
                Загрузить анализы
              </Link>
            </motion.div>
          ) : (
            <>
              <motion.p variants={item} className="font-sans text-[15px] text-[#6d6d6d] mb-12 max-w-xl">
                На основе ваших анализов мы подготовили предварительный набор рекомендаций.
                Финальный профиль формируется нутрициологом.
              </motion.p>

              <div className="grid gap-px sm:grid-cols-2">
                {RECOMMENDATIONS.map((rec) => (
                  <motion.article
                    key={rec.category}
                    variants={item}
                    className="border-t border-[#181818]/[0.08] pt-6 pb-8 pr-6"
                  >
                    <p className="font-sans text-[11px] tracking-[0.2em] uppercase text-[#6d6d6d] mb-3">
                      {rec.category}
                    </p>
                    <p className="font-sans text-[16px] leading-relaxed text-[#181818]">
                      {rec.text}
                    </p>
                  </motion.article>
                ))}
              </div>

              <motion.p variants={item} className="font-sans text-[12px] text-[#6d6d6d] mt-16 max-w-2xl">
                Рекомендации носят информационный характер. Перед изменением режима питания и приёма
                добавок проконсультируйтесь с врачом.
              </motion.p>
            </>
          )}
        </motion.div>
      </div>
    </main>
  )
}
