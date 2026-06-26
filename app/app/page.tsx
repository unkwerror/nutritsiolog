'use client'

import Link from 'next/link'
import { motion, useScroll, useTransform, type Variants } from 'framer-motion'
import { useRef } from 'react'
import { Navbar } from '@/components/Navbar'

// ─── Animation presets ──────────────────────────────────────────────────────

const EASE = [0.25, 0.46, 0.45, 0.94] as const

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 50 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.85, ease: EASE } },
}

const heroStagger: Variants = {
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

// ─── Hero — immersive black frame ────────────────────────────────────────────

function HeroSection() {
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] })
  const sculptureY = useTransform(scrollYProgress, [0, 1], ['0%', '18%'])
  const textY = useTransform(scrollYProgress, [0, 1], ['0%', '8%'])

  return (
    <section ref={ref} className="relative min-h-screen bg-[#000000] overflow-hidden">
      {/* Navbar */}
      <Navbar />

      {/* Sculpture — parallax right, floating */}
      <motion.div
        className="absolute right-0 top-0 w-full h-full lg:w-[56%] pointer-events-none select-none"
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

      {/* Cinematic vignette — keep left text legible */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 75% 100% at 18% 55%, transparent 28%, rgba(0,0,0,0.7) 100%)',
        }}
        aria-hidden
      />

      {/* Hero text — bottom-anchored, left */}
      <motion.div
        className="relative z-10 flex flex-col justify-end min-h-screen pb-16 sm:pb-20 px-6 sm:px-10 lg:px-16"
        style={{ y: textY }}
      >
        <motion.div
          variants={heroStagger}
          initial="hidden"
          animate="visible"
          className="max-w-[62%] sm:max-w-[54%] lg:max-w-[50%]"
        >
          <motion.p
            variants={fadeUp}
            className="text-white/40 text-[11px] sm:text-xs tracking-[0.3em] uppercase mb-6 font-sans"
          >
            Нутрициологический профиль
          </motion.p>

          <motion.h1
            variants={fadeUp}
            className="font-display font-light text-white leading-[0.88]"
            style={{ fontSize: 'clamp(4rem, 11vw, 11rem)' }}
          >
            Нутри&shy;<br />циолог
          </motion.h1>

          <motion.p
            variants={fadeUp}
            className="text-white/50 text-base sm:text-lg leading-relaxed mt-6 mb-8 max-w-sm"
          >
            Персональный профиль здоровья на основе ваших анализов и анкеты. Конкретные рекомендации от нутрициолога.
          </motion.p>

          <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-3">
            <Link href="/auth" className="btn-primary" style={{ fontSize: '0.95rem' }}>
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
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.0, duration: 0.85, ease: EASE }}
        className="absolute bottom-8 right-8 lg:right-16 z-10 flex items-center gap-3"
        aria-hidden
      >
        <span className="text-white/20 text-[10px] tracking-[0.25em] uppercase font-sans">Scroll</span>
        <div className="w-10 h-px bg-white/20" />
      </motion.div>
    </section>
  )
}

// ─── How it works — white editorial section ──────────────────────────────────

function HowSection() {
  return (
    <section id="how" className="bg-[#ffffff] py-20 lg:py-[5rem] overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-16">

        {/* Label */}
        <motion.p
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.7, ease: EASE }}
          className="text-[#6d6d6d] text-[11px] tracking-[0.3em] uppercase mb-8 font-sans"
        >
          Как это работает
        </motion.p>

        {/* Big display heading */}
        <motion.h2
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.85, ease: EASE }}
          className="font-display font-light text-[#181818] mb-16 lg:mb-24"
          style={{ fontSize: 'clamp(2.4rem, 6vw, 5.5rem)', lineHeight: 1.05 }}
        >
          Три шага<br />к пониманию<br />своего здоровья
        </motion.h2>

        {/* Steps — horizontal list rows divided by hairlines */}
        <div className="border-t border-[#181818]/8">
          {STEPS.map((step, i) => (
            <motion.div
              key={step.num}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.8, delay: i * 0.12, ease: EASE }}
              className="grid grid-cols-1 sm:grid-cols-[auto_1fr] lg:grid-cols-[auto_minmax(0,16rem)_1fr] gap-x-8 gap-y-3 items-baseline py-10 lg:py-12 border-b border-[#181818]/8"
            >
              {/* Ghost number */}
              <span
                className="font-display font-light text-[#181818] leading-none select-none pointer-events-none"
                style={{ fontSize: 'clamp(3.5rem, 7vw, 6rem)', opacity: 0.08 }}
                aria-hidden
              >
                {step.num}
              </span>

              {/* Title */}
              <h3
                className="font-display font-light text-[#181818] leading-tight"
                style={{ fontSize: 'clamp(1.8rem, 3.4vw, 2.6rem)' }}
              >
                {step.title}
              </h3>

              {/* Description */}
              <p className="text-[#6d6d6d] text-base sm:text-[1.0625rem] leading-relaxed max-w-xl">
                {step.desc}
              </p>
            </motion.div>
          ))}
        </div>

        {/* CTA row */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.8, ease: EASE }}
          className="mt-16 lg:mt-20 flex flex-col sm:flex-row items-start sm:items-center gap-6"
        >
          <Link href="/auth" className="btn-primary-dark" style={{ fontSize: '0.95rem' }}>
            Начать анкетирование
          </Link>
          <p className="text-[#6d6d6d] text-sm max-w-xs leading-relaxed">
            Займёт 5–7 минут. Аккаунт создаётся автоматически по email.
          </p>
        </motion.div>
      </div>
    </section>
  )
}

// ─── CTA — immersive black close ─────────────────────────────────────────────

function CtaSection() {
  return (
    <section id="start" className="relative bg-[#000000] overflow-hidden">
      {/* Subtle sculpture atmosphere with green decorative glow */}
      <div className="absolute inset-0 pointer-events-none select-none" aria-hidden>
        <img
          src="/assets/section3-sculpture.jpg"
          alt=""
          className="absolute right-0 bottom-0 w-2/3 h-full object-contain object-right-bottom opacity-[0.12]"
        />
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(to right, #000000 38%, transparent 100%)' }}
        />
        <div
          className="absolute -right-20 top-1/4 w-[40rem] h-[40rem] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(160,224,171,0.06) 0%, transparent 65%)' }}
        />
      </div>

      <div className="relative z-10 max-w-5xl mx-auto px-6 sm:px-10 lg:px-16 py-20 lg:py-[5rem]">
        <motion.div
          variants={heroStagger}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
          className="flex flex-col items-start gap-8"
        >
          <motion.p
            variants={fadeUp}
            className="text-white/40 text-[11px] tracking-[0.3em] uppercase font-sans"
          >
            Персонализированный подход
          </motion.p>

          <motion.h2
            variants={fadeUp}
            className="font-display font-light text-white"
            style={{ fontSize: 'clamp(2.4rem, 6vw, 5.5rem)', lineHeight: 1.05 }}
          >
            Ваш персональный<br />
            нутрициологический<br />
            профиль здоровья
          </motion.h2>

          <motion.p
            variants={fadeUp}
            className="text-white/50 text-base sm:text-lg leading-relaxed max-w-md"
          >
            Заполните анкету об образе жизни. Загрузите анализы. Получите конкретные рекомендации.
          </motion.p>

          <motion.div variants={fadeUp} className="mt-2">
            <Link href="/auth" className="btn-primary" style={{ fontSize: '0.95rem' }}>
              Попробовать бесплатно
            </Link>
          </motion.div>

          <motion.p variants={fadeUp} className="text-white/20 text-xs leading-relaxed">
            Данные хранятся на российских серверах · Политика конфиденциальности
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
