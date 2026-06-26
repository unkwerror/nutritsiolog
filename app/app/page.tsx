'use client'

import Link from 'next/link'
import { motion, useScroll, useTransform } from 'framer-motion'
import { useRef } from 'react'
import { Navbar } from '@/components/Navbar'

// ─── Animation presets ──────────────────────────────────────────────────────

const fadeUp = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.85, ease: [0.25, 0.46, 0.45, 0.94] } },
}

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.15 } },
}

// ─── Steps data ─────────────────────────────────────────────────────────────

const STEPS = [
  {
    num: '01',
    title: 'Анкета',
    desc: 'Ответьте на вопросы об образе жизни — займёт 5–7 минут. Получите первичную картину состояния организма.',
  },
  {
    num: '02',
    title: 'Анализы',
    desc: 'Загрузите PDF или фото результатов анализов. Мы автоматически их распознаем и добавим в профиль.',
  },
  {
    num: '03',
    title: 'Профиль',
    desc: 'Получите персональные нутрициологические рекомендации с конкретными шагами для улучшения здоровья.',
  },
]

// ─── Hero section — cinematic dark frame ────────────────────────────────────

function HeroSection() {
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] })
  const sculptureY = useTransform(scrollYProgress, [0, 1], ['0%', '20%'])
  const textY = useTransform(scrollYProgress, [0, 1], ['0%', '9%'])

  return (
    <section ref={ref} className="relative min-h-screen bg-[#1c2918] overflow-hidden">
      {/* Sculpture — parallax right */}
      <motion.div
        className="absolute right-0 top-0 w-full h-full lg:w-[55%] pointer-events-none select-none"
        style={{ y: sculptureY }}
        aria-hidden
      >
        <div className="animate-float-slow w-full h-full">
          <img
            src="/assets/hero-sculpture.png"
            alt=""
            className="absolute right-0 top-1/2 -translate-y-1/2 w-full h-full object-contain object-right opacity-85"
          />
        </div>
      </motion.div>

      {/* Vignette */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 70% 100% at 20% 60%, transparent 30%, rgba(28,41,24,0.6) 100%)' }}
        aria-hidden
      />

      {/* Navbar */}
      <Navbar />

      {/* Hero text — bottom-anchored */}
      <motion.div
        className="relative z-10 flex flex-col justify-end min-h-screen pb-16 sm:pb-20 px-6 sm:px-10 lg:px-16"
        style={{ y: textY }}
      >
        <motion.div
          variants={stagger}
          initial="hidden"
          animate="visible"
          className="max-w-[58%] sm:max-w-[50%] lg:max-w-[48%]"
        >
          <motion.p
            variants={fadeUp}
            className="text-white/30 text-xs tracking-[0.3em] uppercase mb-6 font-sans"
          >
            Нутрициологический профиль
          </motion.p>

          <motion.h1
            variants={fadeUp}
            className="font-display font-light text-white leading-[0.88]"
            style={{ fontSize: 'clamp(4rem, 12vw, 12rem)' }}
          >
            Нутри&shy;<br />циолог
          </motion.h1>

          <motion.p
            variants={fadeUp}
            className="text-white/52 text-base sm:text-lg leading-relaxed mt-6 mb-8 max-w-sm"
          >
            Персональный профиль здоровья на основе ваших анализов и анкеты. Конкретные рекомендации от нутрициолога.
          </motion.p>

          <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-3">
            <Link href="/auth" className="btn-gold" style={{ fontSize: '0.95rem' }}>
              Пройти анкетирование
            </Link>
            <Link href="/#how" className="btn-outline-pill" style={{ fontSize: '0.95rem' }}>
              Как это работает
            </Link>
          </motion.div>
        </motion.div>
      </motion.div>

      {/* Scroll cue */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.8, duration: 0.8 }}
        className="absolute bottom-8 right-8 lg:right-16 z-10 flex items-center gap-3"
        aria-hidden
      >
        <span className="text-white/20 text-[10px] tracking-[0.2em] uppercase font-sans">Scroll</span>
        <div className="w-8 h-px bg-white/15" />
      </motion.div>
    </section>
  )
}

// ─── How it works — light editorial section ──────────────────────────────────

function HowSection() {
  return (
    <section id="how" className="bg-[#e5ece0] py-24 lg:py-36 overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-16">

        {/* Label */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-[#1c2918]/38 text-[11px] tracking-[0.3em] uppercase mb-10 font-sans"
        >
          Как это работает
        </motion.p>

        {/* Big display heading */}
        <motion.h2
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.9, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="font-display font-light text-[#1c2918] leading-[1.02] mb-20 lg:mb-28"
          style={{ fontSize: 'clamp(2.6rem, 7vw, 6.5rem)' }}
        >
          Три шага<br />к пониманию<br />своего здоровья
        </motion.h2>

        {/* Steps grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-[#1c2918]/10">
          {STEPS.map((step, i) => (
            <motion.div
              key={step.num}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.7, delay: i * 0.14, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="py-10 lg:py-0 lg:px-12 first:lg:pl-0 last:lg:pr-0 flex flex-col"
            >
              {/* Monumental number */}
              <span
                className="font-display font-light text-[#1c2918] leading-none select-none pointer-events-none"
                style={{ fontSize: 'clamp(5rem, 11vw, 9rem)', opacity: 0.08 }}
                aria-hidden
              >
                {step.num}
              </span>

              {/* Title */}
              <h3
                className="font-display font-light text-[#1c2918] leading-tight -mt-3 mb-4"
                style={{ fontSize: 'clamp(1.8rem, 3.5vw, 2.6rem)' }}
              >
                {step.title}
              </h3>

              {/* Description */}
              <p className="text-[#1c2918]/55 text-base leading-relaxed">
                {step.desc}
              </p>
            </motion.div>
          ))}
        </div>

        {/* CTA row */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, delay: 0.3 }}
          className="mt-20 lg:mt-28 pt-10 border-t border-[#1c2918]/10 flex flex-col sm:flex-row items-start sm:items-center gap-6"
        >
          <Link href="/auth" className="btn-gold" style={{ fontSize: '0.95rem' }}>
            Начать анкетирование
          </Link>
          <p className="text-[#1c2918]/40 text-sm max-w-xs leading-relaxed">
            Займёт 5–7 минут. Аккаунт создаётся автоматически по email.
          </p>
        </motion.div>
      </div>
    </section>
  )
}

// ─── CTA section — dark cinematic close ──────────────────────────────────────

function CtaSection() {
  return (
    <section
      id="start"
      className="relative bg-[#1c2918] overflow-hidden"
      style={{ minHeight: '72vh' }}
    >
      {/* Subtle sculpture atmosphere */}
      <div className="absolute inset-0 pointer-events-none select-none" aria-hidden>
        <img
          src="/assets/section3-sculpture.jpg"
          alt=""
          className="absolute right-0 bottom-0 w-2/3 h-full object-contain object-right-bottom opacity-10"
        />
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(to right, #1c2918 35%, transparent 100%)' }}
        />
      </div>

      {/* Left thin vertical line */}
      <div className="absolute left-6 sm:left-10 lg:left-16 top-16 bottom-16 w-px bg-white/6 hidden lg:block" aria-hidden />

      <div className="relative z-10 max-w-5xl mx-auto px-6 sm:px-10 lg:px-16 py-28 lg:py-36">
        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
          className="flex flex-col items-start gap-8"
        >
          <motion.p variants={fadeUp} className="text-white/30 text-[11px] tracking-[0.3em] uppercase font-sans">
            Персонализированный подход
          </motion.p>

          <motion.h2
            variants={fadeUp}
            className="font-display font-light text-white leading-[1.0]"
            style={{ fontSize: 'clamp(2.6rem, 7vw, 6rem)' }}
          >
            Ваш персональный<br />
            нутрициологический<br />
            профиль здоровья
          </motion.h2>

          <motion.p variants={fadeUp} className="text-white/45 text-base sm:text-lg leading-relaxed max-w-md">
            Заполните анкету об образе жизни. Загрузите анализы. Получите конкретные рекомендации.
          </motion.p>

          <motion.div variants={fadeUp} className="flex flex-col sm:flex-row items-start sm:items-center gap-6 mt-2">
            <Link href="/auth" className="btn-gold" style={{ fontSize: '0.95rem' }}>
              Попробовать бесплатно
            </Link>
            <p className="text-white/22 text-xs leading-relaxed">
              Данные хранятся на российских серверах<br />
              Политика конфиденциальности
            </p>
          </motion.div>
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
