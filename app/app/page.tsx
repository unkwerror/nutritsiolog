'use client'

import Link from 'next/link'
import { motion, useScroll, useTransform, type Variants } from 'framer-motion'
import { useRef } from 'react'
import { Navbar } from '@/components/Navbar'

// ─── Animation presets ──────────────────────────────────────────────────────

const EASE = [0.25, 0.46, 0.45, 0.94] as const

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 40 },
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

// ─── Decorative botanical SVG ────────────────────────────────────────────────

function BotanicalDecoration() {
  return (
    <svg
      className="absolute right-0 top-0 h-full pointer-events-none select-none"
      style={{ width: 'auto', maxWidth: '52vw' }}
      viewBox="0 0 260 800"
      fill="none"
      preserveAspectRatio="xMaxYMid meet"
      aria-hidden
    >
      {/* Central stem */}
      <path
        d="M 130 820 C 128 680 142 560 128 420 C 112 280 132 160 130 -20"
        stroke="rgba(255,255,255,0.05)"
        strokeWidth="1.2"
      />
      {/* Right leaf 1 */}
      <path d="M 130 420 C 165 400 200 382 232 354" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
      <path
        d="M 232 354 C 222 330 184 326 162 346 C 150 357 148 372 157 382 C 167 394 198 392 220 376 C 230 366 235 356 232 354 Z"
        stroke="rgba(255,255,255,0.04)"
        fill="rgba(255,255,255,0.015)"
        strokeWidth="0.8"
      />
      {/* Left leaf 1 */}
      <path d="M 128 505 C 96 486 62 466 35 438" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
      <path
        d="M 35 438 C 48 414 87 414 110 434 C 120 444 120 460 112 470 C 102 481 74 478 52 464 C 36 452 30 442 35 438 Z"
        stroke="rgba(255,255,255,0.03)"
        fill="rgba(255,255,255,0.01)"
        strokeWidth="0.8"
      />
      {/* Right leaf 2 (upper) */}
      <path d="M 130 312 C 158 292 188 274 218 252" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
      <path
        d="M 218 252 C 210 230 173 227 152 246 C 141 255 140 270 148 280 C 158 292 188 290 206 276 C 216 267 220 256 218 252 Z"
        stroke="rgba(255,255,255,0.03)"
        fill="rgba(255,255,255,0.01)"
        strokeWidth="0.8"
      />
      {/* Left leaf 2 (upper) */}
      <path d="M 128 215 C 98 197 70 182 46 164" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
      <path
        d="M 46 164 C 57 142 92 142 112 162 C 120 172 120 187 112 196 C 102 206 76 204 58 191 C 44 181 40 168 46 164 Z"
        stroke="rgba(255,255,255,0.03)"
        fill="rgba(255,255,255,0.01)"
        strokeWidth="0.8"
      />
      {/* Tendrils */}
      <path d="M 232 354 C 238 344 245 338 252 333" stroke="rgba(255,255,255,0.025)" strokeWidth="0.8" />
      <path d="M 218 252 C 226 244 232 238 240 232" stroke="rgba(255,255,255,0.025)" strokeWidth="0.8" />
      <path d="M 130 610 C 158 592 184 578 208 562" stroke="rgba(255,255,255,0.03)" strokeWidth="0.8" />
      <path d="M 128 680 C 100 664 78 652 56 638" stroke="rgba(255,255,255,0.025)" strokeWidth="0.8" />
    </svg>
  )
}

// ─── Hero — forest-green immersive ──────────────────────────────────────────

function HeroSection() {
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] })
  const textY = useTransform(scrollYProgress, [0, 1], ['0%', '8%'])

  return (
    <section
      ref={ref}
      className="relative min-h-screen overflow-hidden"
      style={{ background: 'linear-gradient(160deg, #2d3d28 0%, #35462f 38%, #4a6040 75%, #3d5435 100%)' }}
    >
      <Navbar />

      {/* Radial gold glow — behind headline */}
      <div
        className="absolute pointer-events-none select-none"
        style={{
          left: '50%',
          top: '42%',
          transform: 'translate(-50%, -50%)',
          width: '70vw',
          height: '70vw',
          maxWidth: 620,
          maxHeight: 620,
          background:
            'radial-gradient(circle, rgba(255,230,146,0.07) 0%, rgba(255,230,146,0.03) 45%, transparent 70%)',
          filter: 'blur(48px)',
        }}
        aria-hidden
      />

      {/* Botanical decoration — right side */}
      <BotanicalDecoration />

      {/* Hero text — vertically centered left */}
      <motion.div
        className="relative z-10 flex flex-col justify-center min-h-screen pb-8 px-6 sm:px-10 lg:px-16"
        style={{ y: textY }}
      >
        <motion.div
          variants={heroStagger}
          initial="hidden"
          animate="visible"
          className="max-w-xl"
        >
          {/* Eyebrow */}
          <motion.p
            variants={fadeUp}
            className="text-white/40 text-[11px] tracking-[0.32em] uppercase mb-7 font-sans"
          >
            Персональный нутрициологический профиль
          </motion.p>

          {/* Headline */}
          <motion.h1
            variants={fadeUp}
            className="font-display font-light text-white leading-[0.88] mb-8"
            style={{ fontSize: 'clamp(4rem, 11vw, 11rem)' }}
          >
            Нутри&#x2011;<br />
            <span className="text-gold">циолог</span>
          </motion.h1>

          {/* Body copy */}
          <motion.p
            variants={fadeUp}
            className="text-white/55 text-base sm:text-lg leading-relaxed mb-10 max-w-sm"
          >
            На основе анализов и анкеты — конкретные шаги к улучшению здоровья.
          </motion.p>

          {/* CTAs */}
          <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-3">
            <Link href="/auth" className="btn-gold" style={{ fontSize: '0.9375rem' }}>
              Начать
            </Link>
            <Link href="/#how" className="btn-outline-gold" style={{ fontSize: '0.9375rem' }}>
              Как это работает
            </Link>
          </motion.div>
        </motion.div>
      </motion.div>

      {/* Scroll indicator — bottom right */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.1, duration: 0.85, ease: EASE }}
        className="absolute bottom-9 right-8 lg:right-16 z-10 flex flex-col items-center gap-2"
        aria-hidden
      >
        <div className="w-px h-12 bg-white/15" />
        <span
          className="text-white/25 text-[10px] tracking-[0.28em] uppercase font-sans"
          style={{ writingMode: 'vertical-rl' }}
        >
          Scroll
        </span>
      </motion.div>
    </section>
  )
}

// ─── How it works — cream editorial section ──────────────────────────────────

function HowSection() {
  return (
    <section id="how" className="py-20 lg:py-[5rem] overflow-hidden" style={{ background: '#f2f5ee' }}>
      <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-16">

        {/* Label */}
        <motion.p
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.7, ease: EASE }}
          className="text-[11px] tracking-[0.3em] uppercase mb-8 font-sans"
          style={{ color: 'rgba(53,70,47,0.5)' }}
        >
          Как это работает
        </motion.p>

        {/* Display heading */}
        <motion.h2
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.85, ease: EASE }}
          className="font-display font-light mb-16 lg:mb-24"
          style={{
            color: '#35462f',
            fontSize: 'clamp(2.4rem, 6vw, 5.5rem)',
            lineHeight: 1.05,
          }}
        >
          Три шага<br />к пониманию<br />своего здоровья
        </motion.h2>

        {/* Steps — rows divided by hairlines */}
        <div style={{ borderTop: '1px solid rgba(53,70,47,0.1)' }}>
          {STEPS.map((step, i) => (
            <motion.div
              key={step.num}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.8, delay: i * 0.12, ease: EASE }}
              className="grid grid-cols-1 sm:grid-cols-[auto_1fr] lg:grid-cols-[auto_minmax(0,16rem)_1fr] gap-x-8 gap-y-3 items-baseline py-10 lg:py-12"
              style={{ borderBottom: '1px solid rgba(53,70,47,0.1)' }}
            >
              {/* Ghost number */}
              <span
                className="font-display font-light leading-none select-none pointer-events-none"
                style={{ fontSize: 'clamp(3.5rem, 7vw, 6rem)', color: 'rgba(53,70,47,0.06)' }}
                aria-hidden
              >
                {step.num}
              </span>

              {/* Title */}
              <h3
                className="font-display font-light leading-tight"
                style={{ fontSize: 'clamp(1.8rem, 3.4vw, 2.6rem)', color: '#35462f' }}
              >
                {step.title}
              </h3>

              {/* Description */}
              <p
                className="text-base sm:text-[1.0625rem] leading-relaxed max-w-xl font-sans"
                style={{ color: 'rgba(53,70,47,0.65)' }}
              >
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
          <Link href="/auth" className="btn-gold" style={{ fontSize: '0.9375rem' }}>
            Начать анкетирование
          </Link>
          <p className="font-sans text-sm max-w-xs leading-relaxed" style={{ color: 'rgba(53,70,47,0.55)' }}>
            Займёт 5–7 минут. Аккаунт создаётся автоматически по email.
          </p>
        </motion.div>
      </div>
    </section>
  )
}

// ─── CTA — forest-green close ─────────────────────────────────────────────────

function CtaSection() {
  return (
    <section
      id="start"
      className="relative overflow-hidden"
      style={{ background: 'linear-gradient(160deg, #2a3825 0%, #35462f 50%, #3a5030 100%)' }}
    >
      {/* Gold glow — right accent */}
      <div
        className="absolute pointer-events-none select-none"
        style={{
          right: '-8%',
          top: '50%',
          transform: 'translateY(-50%)',
          width: '55vw',
          height: '55vw',
          maxWidth: 560,
          maxHeight: 560,
          background:
            'radial-gradient(circle, rgba(255,230,146,0.05) 0%, rgba(255,230,146,0.02) 50%, transparent 70%)',
          filter: 'blur(36px)',
        }}
        aria-hidden
      />

      {/* Hairline top border */}
      <div className="absolute top-0 inset-x-0 h-px" style={{ background: 'rgba(255,255,255,0.08)' }} />

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
            <Link href="/auth" className="btn-gold" style={{ fontSize: '0.9375rem' }}>
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
