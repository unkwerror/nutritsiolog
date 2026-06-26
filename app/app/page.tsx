'use client'

import Link from 'next/link'
import { motion, useScroll, useTransform, type Variants } from 'framer-motion'
import { useRef } from 'react'
import { Navbar } from '@/components/Navbar'

// ─── Animation presets ───────────────────────────────────────────────────────

const EASE = [0.25, 0.46, 0.45, 0.94] as const

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.85, ease: EASE } },
}

const heroStagger: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.13 } },
}

// ─── Step icons (line-art, 40×40 viewBox) ────────────────────────────────────

function IconQuestionnaire() {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden>
      <rect x="8" y="6" width="24" height="28" rx="3" stroke="rgba(255,230,146,0.7)" strokeWidth="1.2" />
      <path d="M14 14h12M14 19h12M14 24h7" stroke="rgba(255,230,146,0.5)" strokeWidth="1.1" strokeLinecap="round" />
      <circle cx="28.5" cy="29.5" r="5.5" fill="rgba(53,70,47,1)" stroke="rgba(255,230,146,0.6)" strokeWidth="1.1" />
      <path d="M26 29.5 28 31.5l3-3" stroke="rgba(255,230,146,0.85)" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IconAnalysis() {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden>
      <rect x="9" y="5" width="18" height="22" rx="2.5" stroke="rgba(255,230,146,0.65)" strokeWidth="1.2" />
      <path d="M13 11h10M13 15h10M13 19h6" stroke="rgba(255,230,146,0.45)" strokeWidth="1.1" strokeLinecap="round" />
      {/* scan line animation baked via CSS */}
      <path d="M13 23L32 23" stroke="rgba(255,230,146,0.3)" strokeWidth="0.8" strokeDasharray="2 2" />
      <path d="M21 28 C21 28 24 24 27 26 C30 28 31 32 34 33" stroke="rgba(255,230,146,0.6)" strokeWidth="1.2" strokeLinecap="round" />
      <circle cx="34" cy="33" r="1.8" fill="rgba(255,230,146,0.7)" />
    </svg>
  )
}

function IconProfile() {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden>
      {/* Person */}
      <circle cx="20" cy="14" r="5" stroke="rgba(255,230,146,0.65)" strokeWidth="1.2" />
      <path d="M10 34c0-5.523 4.477-10 10-10s10 4.477 10 10" stroke="rgba(255,230,146,0.5)" strokeWidth="1.2" strokeLinecap="round" />
      {/* Leaf sprout */}
      <path
        d="M29 8 C29 8 32 5 35 7 C35 7 33 12 29 11 Z"
        fill="rgba(255,230,146,0.15)"
        stroke="rgba(255,230,146,0.6)"
        strokeWidth="0.9"
        strokeLinejoin="round"
      />
      <path d="M29 11 L31 14" stroke="rgba(255,230,146,0.5)" strokeWidth="0.9" strokeLinecap="round" />
    </svg>
  )
}

// ─── Steps data ──────────────────────────────────────────────────────────────

const STEPS = [
  {
    num: '01',
    title: 'Анкета',
    desc: 'Ответьте на вопросы об образе жизни, питании и симптомах — займёт 5–7 минут.',
    Icon: IconQuestionnaire,
    tag: '5 минут',
  },
  {
    num: '02',
    title: 'Анализы',
    desc: 'Загрузите PDF или фото результатов лабораторных исследований. Алгоритм их распознает автоматически.',
    Icon: IconAnalysis,
    tag: 'ИИ-распознавание',
  },
  {
    num: '03',
    title: 'Профиль',
    desc: 'Получите персональные нутрициологические рекомендации с конкретными шагами.',
    Icon: IconProfile,
    tag: 'Персонально',
  },
]

// ─── Benefits ────────────────────────────────────────────────────────────────

const BENEFITS = [
  { title: '24 маркера', desc: 'В фокусе анализа: витамины, гормоны, липиды, ферменты' },
  { title: 'Ваша норма', desc: 'Нутрициологические оптимумы, а не только лабораторные диапазоны' },
  { title: 'Контекст', desc: 'Анкета добавляет образ жизни к биохимии' },
  { title: 'Конфиденциально', desc: 'Данные хранятся на российских серверах' },
]

// ─── Botanical decoration ─────────────────────────────────────────────────────

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
      <path d="M 130 820 C 128 680 142 560 128 420 C 112 280 132 160 130 -20"
        stroke="rgba(255,255,255,0.05)" strokeWidth="1.2" />
      {/* Right leaf 1 */}
      <path d="M 130 420 C 165 400 200 382 232 354" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
      <path d="M 232 354 C 222 330 184 326 162 346 C 150 357 148 372 157 382 C 167 394 198 392 220 376 C 230 366 235 356 232 354 Z"
        stroke="rgba(255,255,255,0.04)" fill="rgba(255,255,255,0.015)" strokeWidth="0.8" />
      {/* Left leaf 1 */}
      <path d="M 128 505 C 96 486 62 466 35 438" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
      <path d="M 35 438 C 48 414 87 414 110 434 C 120 444 120 460 112 470 C 102 481 74 478 52 464 C 36 452 30 442 35 438 Z"
        stroke="rgba(255,255,255,0.03)" fill="rgba(255,255,255,0.01)" strokeWidth="0.8" />
      {/* Right leaf 2 */}
      <path d="M 130 312 C 158 292 188 274 218 252" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
      <path d="M 218 252 C 210 230 173 227 152 246 C 141 255 140 270 148 280 C 158 292 188 290 206 276 C 216 267 220 256 218 252 Z"
        stroke="rgba(255,255,255,0.03)" fill="rgba(255,255,255,0.01)" strokeWidth="0.8" />
      {/* Left leaf 2 */}
      <path d="M 128 215 C 98 197 70 182 46 164" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
      <path d="M 46 164 C 57 142 92 142 112 162 C 120 172 120 187 112 196 C 102 206 76 204 58 191 C 44 181 40 168 46 164 Z"
        stroke="rgba(255,255,255,0.03)" fill="rgba(255,255,255,0.01)" strokeWidth="0.8" />
      {/* Tendrils */}
      <path d="M 232 354 C 238 344 245 338 252 333" stroke="rgba(255,255,255,0.025)" strokeWidth="0.8" />
      <path d="M 218 252 C 226 244 232 238 240 232" stroke="rgba(255,255,255,0.025)" strokeWidth="0.8" />
      <path d="M 130 610 C 158 592 184 578 208 562" stroke="rgba(255,255,255,0.03)" strokeWidth="0.8" />
      <path d="M 128 680 C 100 664 78 652 56 638" stroke="rgba(255,255,255,0.025)" strokeWidth="0.8" />
    </svg>
  )
}

// Floating ambient dots
function AmbientDots() {
  const dots = [
    { cx: '18%', cy: '22%', r: 1.4, delay: 0 },
    { cx: '72%', cy: '15%', r: 1.0, delay: 0.6 },
    { cx: '88%', cy: '58%', r: 1.6, delay: 1.2 },
    { cx: '8%', cy: '68%', r: 1.1, delay: 0.4 },
    { cx: '55%', cy: '82%', r: 1.3, delay: 1.8 },
    { cx: '42%', cy: '35%', r: 0.9, delay: 0.9 },
  ]
  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none select-none" aria-hidden>
      {dots.map((d, i) => (
        <motion.circle
          key={i} cx={d.cx} cy={d.cy} r={d.r}
          fill="rgba(255,230,146,0.35)"
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: [0, 1, 0.4, 1, 0], scale: [0, 1, 1.4, 1, 0] }}
          transition={{ duration: 4.5, delay: d.delay, repeat: Infinity, repeatDelay: 3 + i }}
        />
      ))}
    </svg>
  )
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

function HeroSection() {
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] })
  const textY = useTransform(scrollYProgress, [0, 1], ['0%', '8%'])
  const opacity = useTransform(scrollYProgress, [0, 0.7], [1, 0])

  return (
    <section ref={ref} className="relative min-h-screen overflow-hidden"
      style={{ background: 'linear-gradient(160deg, #2d3d28 0%, #35462f 38%, #4a6040 75%, #3d5435 100%)' }}>
      <Navbar />

      {/* Gold glow */}
      <div className="absolute pointer-events-none select-none" style={{
        left: '50%', top: '42%', transform: 'translate(-50%, -50%)',
        width: '70vw', height: '70vw', maxWidth: 620, maxHeight: 620,
        background: 'radial-gradient(circle, rgba(255,230,146,0.07) 0%, rgba(255,230,146,0.03) 45%, transparent 70%)',
        filter: 'blur(48px)',
      }} aria-hidden />

      <AmbientDots />
      <BotanicalDecoration />

      <motion.div
        className="relative z-10 flex flex-col justify-center min-h-screen pb-8 px-6 sm:px-10 lg:px-16"
        style={{ y: textY, opacity }}
      >
        <motion.div variants={heroStagger} initial="hidden" animate="visible" className="max-w-xl">
          <motion.p variants={fadeUp}
            className="text-white/40 text-[11px] tracking-[0.32em] uppercase mb-7 font-sans">
            Персональный нутрициологический профиль
          </motion.p>

          <motion.h1 variants={fadeUp}
            className="font-display font-light text-white leading-[0.88] mb-8"
            style={{ fontSize: 'clamp(4rem, 11vw, 11rem)' }}>
            Нутри&#x2011;<br />
            <span className="text-gold">циолог</span>
          </motion.h1>

          <motion.p variants={fadeUp}
            className="text-white/55 text-base sm:text-lg leading-relaxed mb-10 max-w-sm">
            На основе анализов и анкеты — конкретные шаги к улучшению здоровья.
          </motion.p>

          <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-3">
            <Link href="/auth" className="btn-gold" style={{ fontSize: '0.9375rem' }}>
              Начать
            </Link>
            <Link href="/#how" className="btn-outline-gold" style={{ fontSize: '0.9375rem' }}>
              Как это работает
            </Link>
          </motion.div>

          {/* Stat pills */}
          <motion.div variants={fadeUp} className="flex flex-wrap gap-3 mt-10">
            {['24 маркера', 'ИИ-распознавание', 'Нутрициологические нормы'].map((tag) => (
              <span key={tag}
                className="font-sans text-[11px] tracking-[0.12em] px-3 py-1.5 rounded-full"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.45)' }}>
                {tag}
              </span>
            ))}
          </motion.div>
        </motion.div>
      </motion.div>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        transition={{ delay: 1.1, duration: 0.85, ease: EASE }}
        className="absolute bottom-9 right-8 lg:right-16 z-10 flex flex-col items-center gap-2" aria-hidden>
        <motion.div className="w-px bg-white/15"
          animate={{ height: [24, 48, 24] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }} />
        <span className="text-white/25 text-[10px] tracking-[0.28em] uppercase font-sans"
          style={{ writingMode: 'vertical-rl' }}>Scroll</span>
      </motion.div>
    </section>
  )
}

// ─── How it works — dark forest palette ──────────────────────────────────────

function HowSection() {
  return (
    <section id="how" className="relative overflow-hidden py-24 lg:py-36"
      style={{ background: 'linear-gradient(180deg, #2a3825 0%, #35462f 45%, #3a5030 100%)' }}>

      {/* Subtle grid texture */}
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: 'radial-gradient(rgba(255,255,255,0.03) 1px, transparent 1px)',
        backgroundSize: '40px 40px',
      }} aria-hidden />

      {/* Gold accent line top */}
      <div className="absolute top-0 inset-x-0 h-px"
        style={{ background: 'linear-gradient(90deg, transparent 0%, rgba(255,230,146,0.25) 30%, rgba(255,230,146,0.25) 70%, transparent 100%)' }} />

      <div className="relative z-10 max-w-7xl mx-auto px-6 sm:px-10 lg:px-16">

        <motion.p
          initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }} transition={{ duration: 0.7, ease: EASE }}
          className="text-[11px] tracking-[0.3em] uppercase mb-8 font-sans text-white/35">
          Как это работает
        </motion.p>

        <motion.h2
          initial={{ opacity: 0, y: 50 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }} transition={{ duration: 0.85, ease: EASE }}
          className="font-display font-light text-white mb-16 lg:mb-24 leading-tight"
          style={{ fontSize: 'clamp(2.4rem, 6vw, 5.5rem)' }}>
          Три шага<br />к пониманию<br />
          <span style={{ color: 'rgba(255,230,146,0.75)' }}>своего здоровья</span>
        </motion.h2>

        {/* Step rows */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          {STEPS.map((step, i) => (
            <motion.div key={step.num}
              initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.8, delay: i * 0.1, ease: EASE }}
              className="group grid grid-cols-1 sm:grid-cols-[4.5rem_1fr] lg:grid-cols-[4.5rem_18rem_1fr] gap-x-8 gap-y-4 items-center py-10 lg:py-12 transition-all"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>

              {/* Number + icon stacked */}
              <div className="flex items-center gap-4 sm:flex-col sm:items-start sm:gap-2">
                <span className="font-display font-light text-white/10 leading-none select-none"
                  style={{ fontSize: 'clamp(2.5rem, 5vw, 4rem)' }} aria-hidden>
                  {step.num}
                </span>
                <div className="flex-shrink-0 transition-transform duration-500 group-hover:scale-110 group-hover:-translate-y-0.5">
                  <step.Icon />
                </div>
              </div>

              {/* Title + tag */}
              <div>
                <h3 className="font-display font-light text-white leading-tight mb-2"
                  style={{ fontSize: 'clamp(1.8rem, 3vw, 2.5rem)' }}>
                  {step.title}
                </h3>
                <span className="inline-block font-sans text-[11px] tracking-[0.15em] uppercase px-2.5 py-1 rounded-full"
                  style={{ background: 'rgba(255,230,146,0.08)', color: 'rgba(255,230,146,0.6)', border: '1px solid rgba(255,230,146,0.15)' }}>
                  {step.tag}
                </span>
              </div>

              {/* Description */}
              <p className="font-sans text-base sm:text-[1.0625rem] leading-relaxed text-white/55 max-w-xl">
                {step.desc}
              </p>
            </motion.div>
          ))}
        </div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }} transition={{ duration: 0.8, ease: EASE }}
          className="mt-16 lg:mt-20 flex flex-col sm:flex-row items-start sm:items-center gap-6">
          <Link href="/auth" className="btn-gold" style={{ fontSize: '0.9375rem' }}>
            Начать анкетирование
          </Link>
          <p className="font-sans text-sm text-white/40 max-w-xs leading-relaxed">
            Займёт 5–7 минут. Аккаунт создаётся автоматически по email.
          </p>
        </motion.div>
      </div>
    </section>
  )
}

// ─── Benefits grid ────────────────────────────────────────────────────────────

function BenefitsSection() {
  return (
    <section className="relative overflow-hidden py-20 lg:py-28"
      style={{ background: 'linear-gradient(180deg, #3a5030 0%, #4a6040 60%, #35462f 100%)' }}>

      {/* Horizontal divider top */}
      <div className="absolute top-0 inset-x-0 h-px"
        style={{ background: 'rgba(255,255,255,0.06)' }} />

      <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-16">
        <motion.p
          initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }} transition={{ duration: 0.7, ease: EASE }}
          className="text-[11px] tracking-[0.3em] uppercase mb-14 font-sans text-white/30">
          Что входит в профиль
        </motion.p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {BENEFITS.map((b, i) => (
            <motion.div key={b.title}
              initial={{ opacity: 0, y: 32 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.75, delay: i * 0.08, ease: EASE }}
              className="glass-card rounded-[16px] px-6 py-7 hover:bg-white/[0.06] transition-colors">
              <p className="font-display font-light text-white mb-2 leading-tight"
                style={{ fontSize: 'clamp(1.5rem, 2.5vw, 2rem)' }}>
                {b.title}
              </p>
              <p className="font-sans text-sm text-white/50 leading-relaxed">{b.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── CTA ──────────────────────────────────────────────────────────────────────

function CtaSection() {
  return (
    <section id="start" className="relative overflow-hidden"
      style={{ background: 'linear-gradient(160deg, #2a3825 0%, #35462f 50%, #3a5030 100%)' }}>

      {/* Gold glow right */}
      <div className="absolute pointer-events-none select-none" style={{
        right: '-8%', top: '50%', transform: 'translateY(-50%)',
        width: '55vw', height: '55vw', maxWidth: 560, maxHeight: 560,
        background: 'radial-gradient(circle, rgba(255,230,146,0.05) 0%, rgba(255,230,146,0.02) 50%, transparent 70%)',
        filter: 'blur(36px)',
      }} aria-hidden />

      {/* Hairline */}
      <div className="absolute top-0 inset-x-0 h-px" style={{ background: 'rgba(255,255,255,0.08)' }} />

      <div className="relative z-10 max-w-5xl mx-auto px-6 sm:px-10 lg:px-16 py-24 lg:py-36">
        <motion.div variants={heroStagger} initial="hidden"
          whileInView="visible" viewport={{ once: true, margin: '-80px' }}
          className="flex flex-col items-start gap-8">
          <motion.p variants={fadeUp}
            className="text-white/40 text-[11px] tracking-[0.3em] uppercase font-sans">
            Персонализированный подход
          </motion.p>

          <motion.h2 variants={fadeUp} className="font-display font-light text-white"
            style={{ fontSize: 'clamp(2.4rem, 6vw, 5.5rem)', lineHeight: 1.05 }}>
            Ваш персональный<br />
            нутрициологический<br />
            <span style={{ color: 'rgba(255,230,146,0.75)' }}>профиль здоровья</span>
          </motion.h2>

          <motion.p variants={fadeUp}
            className="text-white/50 text-base sm:text-lg leading-relaxed max-w-md">
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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <main>
      <HeroSection />
      <HowSection />
      <BenefitsSection />
      <CtaSection />
    </main>
  )
}
