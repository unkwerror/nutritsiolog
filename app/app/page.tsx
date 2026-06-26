'use client'

import Link from 'next/link'
import { motion, useScroll, useTransform } from 'framer-motion'
import { useRef } from 'react'
import { Navbar } from '@/components/Navbar'

// ─── Animation presets ──────────────────────────────────────────────────────

const fadeUp = {
  hidden: { opacity: 0, y: 36 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.75, ease: [0.25, 0.46, 0.45, 0.94] } },
}

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.18 } },
}

// ─── Steps data ─────────────────────────────────────────────────────────────

const STEPS = [
  {
    num: '1',
    title: 'Анкета',
    desc: 'Ответьте на вопросы об образе жизни — займёт 5–7 минут. Получите первичную картину состояния организма.',
  },
  {
    num: '2',
    title: 'Анализы',
    desc: 'Загрузите PDF или фото результатов анализов. Мы автоматически их распознаем и добавим в профиль.',
  },
  {
    num: '3',
    title: 'Профиль',
    desc: 'Получите персональные нутрициологические рекомендации с конкретными шагами для улучшения здоровья.',
  },
]

// ─── Hero section ────────────────────────────────────────────────────────────

function HeroSection() {
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] })
  const sculptureY = useTransform(scrollYProgress, [0, 1], ['0%', '18%'])
  const textY = useTransform(scrollYProgress, [0, 1], ['0%', '10%'])

  return (
    <section
      ref={ref}
      className="relative min-h-screen overflow-hidden bg-hero"
      style={{
        backgroundImage:
          'url(/assets/hero-bg.jpg), linear-gradient(to bottom, #35462f 62%, #4a6040 100%)',
        backgroundBlendMode: 'overlay',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {/* Glass card wrapper */}
      <div className="relative min-h-screen mx-3 sm:mx-5 lg:mx-10 my-3 sm:my-4 lg:my-8 rounded-3xl glass-card flex flex-col overflow-hidden">
        <Navbar />

        {/* Sculpture — parallax right */}
        <motion.div
          className="absolute right-0 top-0 w-full h-full lg:w-3/5 pointer-events-none select-none"
          style={{ y: sculptureY }}
          aria-hidden
        >
          <div className="animate-float w-full h-full">
            <img
              src="/assets/hero-sculpture.png"
              alt=""
              className="absolute right-0 top-1/2 -translate-y-1/2 w-full h-full object-contain object-right"
            />
          </div>
        </motion.div>

        {/* Hero text */}
        <motion.div
          className="relative z-10 flex-1 flex flex-col justify-center px-5 sm:px-8 lg:px-14 pb-20 pt-4 lg:pb-0 lg:max-w-[54%] xl:max-w-[48%]"
          style={{ y: textY }}
          variants={stagger}
          initial="hidden"
          animate="visible"
        >
          <motion.h1
            variants={fadeUp}
            className="font-display uppercase leading-[1.02] tracking-wide text-gold mb-5"
            style={{ fontSize: 'clamp(2.8rem, 7.5vw, 7rem)' }}
          >
            Нутри&shy;циолог
          </motion.h1>

          <motion.p
            variants={fadeUp}
            className="text-white/82 leading-relaxed mb-8 max-w-[36rem]"
            style={{ fontSize: 'clamp(1rem, 1.8vw, 1.25rem)' }}
          >
            Персональный нутрициологический профиль — на основе ваших анализов и анкеты.
            Узнайте, что происходит в вашем организме, и получите конкретные рекомендации.
          </motion.p>

          {/* Progress dots */}
          <motion.div variants={fadeUp} className="flex items-center gap-2 mb-8">
            <div className="w-2 h-2 rounded-full bg-white/40 shrink-0" />
            <div className="h-px bg-white/25" style={{ width: 'clamp(4rem, 10vw, 13rem)' }} />
            <div className="w-2 h-2 rounded-full bg-white/40 shrink-0" />
          </motion.div>

          <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-3">
            <Link href="/auth" className="btn-gold" style={{ fontSize: 'clamp(0.95rem, 1.5vw, 1.2rem)' }}>
              Пройти анкетирование
            </Link>
            <Link
              href="/#how"
              className="inline-flex items-center justify-center min-h-[52px] px-7 rounded-xl text-white/70 hover:text-white text-base transition-colors border border-white/15 hover:border-white/30"
            >
              Как это работает
            </Link>
          </motion.div>
        </motion.div>

        {/* Mobile sculpture hint */}
        <div
          className="absolute bottom-0 right-0 w-1/2 h-2/5 lg:hidden pointer-events-none select-none opacity-20"
          aria-hidden
        >
          <img src="/assets/hero-sculpture.png" alt="" className="w-full h-full object-contain object-right-bottom" />
        </div>
      </div>
    </section>
  )
}

// ─── How it works ────────────────────────────────────────────────────────────

function HowSection() {
  return (
    <section
      id="how"
      className="relative min-h-screen overflow-hidden"
      style={{ background: 'linear-gradient(to bottom, #adbf9c 0%, #35472e 77%)' }}
    >
      {/* Background texture */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden>
        <img
          src="/assets/section2-bg.jpg"
          alt=""
          className="w-full h-full object-cover opacity-20"
        />
      </div>

      {/* Floating sculpture left hint */}
      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-40 lg:w-64 pointer-events-none select-none opacity-40 animate-float-slow" aria-hidden>
        <img src="/assets/hero-sculpture.png" alt="" className="w-full h-auto object-contain" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-5 sm:px-8 lg:px-14 py-20 lg:py-28">
        {/* Heading */}
        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
          className="mb-14 lg:mb-20"
        >
          <motion.h2
            variants={fadeUp}
            className="font-sans font-light text-white mb-4"
            style={{ fontSize: 'clamp(2rem, 5vw, 4rem)' }}
          >
            Как это работает?
          </motion.h2>
          <motion.p variants={fadeUp} className="text-white/65 text-base sm:text-lg max-w-xl leading-relaxed">
            Для формирования персонального нутрициологического профиля необходимо выполнить три шага.
          </motion.p>
        </motion.div>

        {/* Step cards */}
        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-60px' }}
          className="grid grid-cols-1 sm:grid-cols-3 gap-5 lg:gap-7"
        >
          {STEPS.map((step) => (
            <motion.div
              key={step.num}
              variants={fadeUp}
              className="glass-step rounded-2xl lg:rounded-3xl p-6 lg:p-8 flex flex-col gap-4 min-h-[280px] sm:min-h-[360px]"
            >
              <span
                className="font-sans font-light text-white leading-none"
                style={{ fontSize: 'clamp(3.5rem, 8vw, 6rem)' }}
              >
                {step.num}
              </span>
              <span
                className="font-sans font-light text-white leading-tight"
                style={{ fontSize: 'clamp(1.5rem, 3.5vw, 2.5rem)' }}
              >
                {step.title}
              </span>
              <p className="text-white/65 text-sm sm:text-base leading-relaxed mt-auto">
                {step.desc}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}

// ─── CTA section ────────────────────────────────────────────────────────────

function CtaSection() {
  return (
    <section
      id="start"
      className="relative min-h-[80vh] overflow-hidden flex items-center"
      style={{ background: 'linear-gradient(to bottom, #35472e 21%, #aabc99 100%)' }}
    >
      {/* Sculpture frame */}
      <div className="absolute inset-0 pointer-events-none select-none" aria-hidden>
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-48 lg:w-80 opacity-60 animate-float">
          <img src="/assets/section3-sculpture.jpg" alt="" className="w-full h-auto object-contain" />
        </div>
        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-48 lg:w-80 opacity-60 animate-float-slow" style={{ animationDelay: '3s' }}>
          <img src="/assets/section3-sculpture.jpg" alt="" className="w-full h-auto object-contain scale-x-[-1]" />
        </div>
      </div>

      <div className="relative z-10 w-full max-w-3xl mx-auto px-5 sm:px-8 py-20 text-center">
        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-60px' }}
          className="flex flex-col items-center gap-7"
        >
          <motion.h2 variants={fadeUp} className="font-sans font-light text-white leading-snug"
            style={{ fontSize: 'clamp(1.4rem, 3.5vw, 2.2rem)' }}>
            Заполните небольшую анкету. Ответьте на вопросы об образе жизни и получите персональное описание вашего состояния.
          </motion.h2>

          <motion.div variants={fadeUp}>
            <Link href="/auth" className="btn-gold" style={{ fontSize: 'clamp(0.95rem, 1.5vw, 1.15rem)' }}>
              Попробовать бесплатно
            </Link>
          </motion.div>

          <motion.p variants={fadeUp} className="text-white/38 text-xs max-w-sm">
            Нутрициолог · Данные хранятся на российских серверах · Политика конфиденциальности
          </motion.p>
        </motion.div>
      </div>
    </section>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <main>
      <HeroSection />
      <HowSection />
      <CtaSection />
    </main>
  )
}
