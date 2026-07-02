'use client'

// Landing — full Design-System port: preloader curtain, kinetic Playfair hero
// with parallax sculptures + gold motes, marquee, scroll reveals, vector
// ornaments and a haloed CTA. Visual-only (no API).

import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { Button, Chip, GlassCard } from '@/components/ds/primitives'
import { Reveal } from '@/components/ds/AppCommon'

type CSSVars = CSSProperties & Record<`--${string}`, string | number>

const PHOTO = '/assets/'
const BRAND = '/assets/brand/'
const START_HREF = '/auth'

// ── Preloader ─────────────────────────────────────────────────────────────────

function Preloader({ onDone }: { onDone: () => void }) {
  const [progress, setProgress] = useState(0)
  const [lift, setLift] = useState(false)
  useEffect(() => {
    let p = 0
    const id = setInterval(() => {
      p = Math.min(100, p + (p < 70 ? 4 : 2.2))
      setProgress(p)
      if (p >= 100) {
        clearInterval(id)
        setTimeout(() => setLift(true), 360)
        setTimeout(() => onDone(), 1280)
      }
    }, 34)
    return () => clearInterval(id)
  }, [onDone])

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        transform: lift ? 'translateY(-100%)' : 'translateY(0)',
        transition: 'transform 0.92s cubic-bezier(0.76,0,0.24,1)',
        background: 'linear-gradient(160deg, #2d3d28 0%, #35462f 60%, #28331f 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      <div style={{ position: 'absolute', inset: 0, opacity: 0.4, background: `url('${BRAND}pattern-vine.svg')`, backgroundSize: '150px' }} />
      <div style={{ position: 'absolute', left: '50%', top: '46%', width: 520, height: 520, transform: 'translate(-50%,-50%)', background: 'var(--glow-gold)', filter: 'blur(50px)' }} />
      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ position: 'relative', width: 168, height: 168, display: 'grid', placeItems: 'center' }}>
          <svg width="168" height="168" viewBox="0 0 168 168" style={{ position: 'absolute', animation: 'spin 6s linear infinite' }} aria-hidden="true">
            <circle cx="84" cy="84" r="80" fill="none" stroke="rgba(255,230,146,0.18)" strokeWidth="1" />
            <circle cx="84" cy="84" r="80" fill="none" stroke="#ffe692" strokeWidth="1.4" strokeLinecap="round" strokeDasharray="40 463" />
          </svg>
          <img src={`${BRAND}monogram.svg`} alt="Нутрициолог" width={116} style={{ animation: 'mono-pulse 2.4s ease-in-out infinite' }} />
        </div>
        <p style={{ marginTop: 26, fontFamily: 'var(--font-sans)', fontSize: 12, letterSpacing: '0.42em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)', paddingLeft: '0.42em' }}>
          Нутрициолог
        </p>
        <div style={{ marginTop: 22, width: 220, height: 1.5, background: 'rgba(255,255,255,0.12)', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${progress}%`, background: 'linear-gradient(90deg,#d4a020,#ffe692,#fff4d5)', transition: 'width 0.1s linear' }} />
        </div>
        <p style={{ marginTop: 12, fontFamily: 'var(--font-sans)', fontSize: 10.5, letterSpacing: '0.2em', color: 'rgba(255,255,255,0.3)' }}>{Math.round(progress)}%</p>
      </div>
    </div>
  )
}

// ── Hero ──────────────────────────────────────────────────────────────────────

function HeroNav() {
  const [open, setOpen] = useState(false)
  const links: [string, string][] = [
    ['Как это работает', '#how'],
    ['О сервисе', '#start'],
  ]
  const scrollTo = (h: string) => (e: React.MouseEvent) => {
    setOpen(false)
    const el = document.getElementById(h.slice(1))
    if (el) {
      e.preventDefault()
      window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 8, behavior: 'smooth' })
    }
  }
  return (
    <nav style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'calc(1.1rem + env(safe-area-inset-top, 0px)) clamp(1.5rem,5vw,3.5rem) 1.1rem' }}>
      <a href="#" style={{ display: 'inline-flex', alignItems: 'center', gap: 12, textDecoration: 'none' }}>
        <img src={`${BRAND}monogram.svg`} alt="Нутрициолог" width={40} height={40} />
        <span className="font-display hero-wordmark" style={{ fontSize: 22, fontStyle: 'italic', color: '#fff', fontWeight: 500 }}>
          Нутрициолог
        </span>
      </a>
      <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
        <span className="hero-navlinks" style={{ display: 'flex', gap: 28 }}>
          {links.map(([l, h]) => (
            <a key={l} href={h} onClick={scrollTo(h)} style={{ fontFamily: 'var(--font-sans)', fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.72)', textDecoration: 'none' }}>
              {l}
            </a>
          ))}
        </span>
        <a className="hero-reg" href={START_HREF} style={{ display: 'inline-flex', alignItems: 'center', height: 34, padding: '0 1.3rem', borderRadius: 75, border: '1.5px solid rgba(255,230,146,0.5)', color: '#ffe692', fontFamily: 'var(--font-sans)', fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', textDecoration: 'none' }}>
          Войти · Начать
        </a>
        <button className="hero-burger" data-open={open} aria-label="Меню" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          <span /> <span /> <span />
        </button>
      </div>
      <div className="hero-menu" data-open={open}>
        {links.map(([l, h]) => (
          <a key={l} href={h} onClick={scrollTo(h)}>
            {l}
          </a>
        ))}
        <a href={START_HREF}>Войти · Начать</a>
      </div>
    </nav>
  )
}

type MoteSpec = { left: string; size: string; dur: string; delay: string; dx: string; mo: string }

function HeroMotes() {
  // Случайные позиции считаем только на клиенте — иначе hydration mismatch.
  const [motes, setMotes] = useState<MoteSpec[]>([])
  useEffect(() => {
    setMotes(
      Array.from({ length: 22 }).map(() => ({
        left: `${(2 + Math.random() * 96).toFixed(1)}%`,
        size: (3 + Math.random() * 5).toFixed(1),
        dur: (24 + Math.random() * 26).toFixed(1),
        delay: (-Math.random() * 38).toFixed(1),
        dx: `${((Math.random() * 2 - 1) * 90).toFixed(0)}px`,
        mo: (0.4 + Math.random() * 0.5).toFixed(2),
      }))
    )
  }, [])
  return (
    <div aria-hidden="true" style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 6 }}>
      {motes.map((m, i) => {
        const s: CSSVars = { left: m.left, width: `${m.size}px`, height: `${m.size}px`, animationDuration: `${m.dur}s`, animationDelay: `${m.delay}s`, '--dx': m.dx, '--mo': m.mo }
        return <span key={i} className="l-mote" style={s} />
      })}
    </div>
  )
}

function Hero({ start }: { start: boolean }) {
  const layers = useRef<(HTMLImageElement | null)[]>([])
  useEffect(() => {
    let raf = 0
    const onScroll = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const y = window.scrollY
        layers.current.forEach((el) => {
          if (!el) return
          const sp = parseFloat(el.dataset.speed ?? '0')
          el.style.transform = `translate3d(0, ${y * sp}px, 0)`
        })
      })
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      cancelAnimationFrame(raf)
    }
  }, [])
  const setL = (i: number) => (el: HTMLImageElement | null) => {
    layers.current[i] = el
  }
  const go = start ? 'go' : ''

  return (
    <section style={{ position: 'relative', minHeight: '100vh', overflow: 'hidden', background: 'linear-gradient(160deg, #2d3d28 0%, #35462f 38%, #4a6040 75%, #3d5435 100%)' }}>
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }} aria-hidden="true">
        <img ref={setL(0)} data-speed="0.12" src={`${PHOTO}section2-bg.jpg`} alt="" style={{ position: 'absolute', top: '-10%', right: '-4%', width: '60%', opacity: 0.22, objectFit: 'contain', mixBlendMode: 'soft-light', maskImage: 'radial-gradient(ellipse 58% 56% at 76% 26%, #000 14%, transparent 64%)', WebkitMaskImage: 'radial-gradient(ellipse 58% 56% at 76% 26%, #000 14%, transparent 64%)' }} />
        <img ref={setL(1)} data-speed="0.05" src={`${PHOTO}auth-bg.png`} alt="" className="animate-float" style={{ position: 'absolute', left: '-4%', top: '4%', height: '88%', opacity: 0.4, objectFit: 'contain', mixBlendMode: 'screen' }} />
        <img ref={setL(2)} data-speed="0.18" src={`${PHOTO}hero-bg.jpg`} alt="" style={{ position: 'absolute', right: '-3%', top: '50%', transform: 'translateY(-50%)', width: '52%', opacity: 0.82, objectFit: 'contain', mixBlendMode: 'screen', maskImage: 'radial-gradient(ellipse 78% 86% at 70% 60%, #000 44%, transparent 80%)', WebkitMaskImage: 'radial-gradient(ellipse 78% 86% at 70% 60%, #000 44%, transparent 80%)' }} />
        <img ref={setL(3)} data-speed="0.28" src={`${PHOTO}section3-sculpture.jpg`} alt="" className="animate-float-slow" style={{ position: 'absolute', right: '2%', top: '8%', width: '28%', opacity: 0.55, objectFit: 'contain', mixBlendMode: 'screen' }} />
      </div>

      <div aria-hidden="true" style={{ position: 'absolute', left: '50%', top: '44%', transform: 'translate(-50%,-50%)', width: 680, height: 680, maxWidth: '72vw', maxHeight: '72vw', background: 'var(--glow-gold)', filter: 'blur(50px)' }} />
      <div aria-hidden="true" style={{ position: 'absolute', inset: 0, opacity: 0.4, mixBlendMode: 'overlay', background: `url('${BRAND}grain.svg')`, backgroundSize: '180px', pointerEvents: 'none' }} />
      <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, rgba(45,61,40,0.9) 0%, rgba(45,61,40,0.5) 34%, rgba(45,61,40,0) 60%)' }} />

      <div style={{ position: 'relative', zIndex: 20 }}>
        <HeroNav />
      </div>
      <HeroMotes />

      <div style={{ position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: 'calc(100vh - 78px)', padding: '0 clamp(1.5rem, 5vw, 5rem)', maxWidth: 1120, width: '100%', boxSizing: 'border-box' }}>
        <p className={`hero-eyebrow ${go}`} style={{ fontSize: 11, letterSpacing: '0.34em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.42)', margin: '0 0 30px' }}>
          Персональный нутрициологический профиль
        </p>
        <h1 style={{ margin: 0, width: 'fit-content', maxWidth: '100%' }}>
          <span className="line-mask">
            <span className={`line-inner headline-gold ${go}`} style={{ transitionDelay: '160ms' }}>
              Нутрициолог
            </span>
          </span>
        </h1>
        <Reveal delay={460} style={{ margin: '2.2rem 0 0' }}>
          <img src={`${BRAND}flourish-divider.svg`} alt="" style={{ width: 300, maxWidth: '80%', display: 'block' }} />
        </Reveal>
        <Reveal delay={560}>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 19, lineHeight: 1.6, margin: '1.8rem 0 2.5rem', maxWidth: 400 }}>
            На основе ваших анализов и анкеты — конкретные шаги к&nbsp;улучшению здоровья.
          </p>
        </Reveal>
        <Reveal delay={680}>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            <Button variant="gold" size="lg" href={START_HREF}>
              Начать путь
            </Button>
            <Button variant="outline-gold" size="lg" href="#how">
              Как это работает
            </Button>
          </div>
        </Reveal>
      </div>

      <div aria-hidden="true" style={{ position: 'absolute', bottom: 34, right: 'clamp(1.5rem,5vw,5rem)', zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
        <span className="scroll-line" />
        <span style={{ color: 'rgba(255,255,255,0.28)', fontSize: 10, letterSpacing: '0.3em', textTransform: 'uppercase', writingMode: 'vertical-rl', fontFamily: 'var(--font-sans)' }}>Листайте</span>
      </div>
    </section>
  )
}

// ── Marquee / How / Benefits / CTA ────────────────────────────────────────────

function Marquee() {
  const items = ['24 маркера', 'Витамин D', 'Ферритин', 'B12', 'ТТГ', 'Гомоцистеин', 'Магний', 'Омега-3', 'Инсулин', 'Кортизол']
  const run = [...items, ...items]
  return (
    <div style={{ background: '#28331f', borderTop: '1px solid rgba(255,230,146,0.12)', borderBottom: '1px solid rgba(255,230,146,0.12)', overflow: 'hidden', padding: '1.1rem 0' }}>
      <div style={{ display: 'flex', width: 'max-content', animation: 'marquee 28s linear infinite' }}>
        {run.map((t, i) => (
          <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 28, padding: '0 28px', fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 26, color: 'rgba(255,255,255,0.5)', whiteSpace: 'nowrap' }}>
            {t}
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#ffe692', opacity: 0.7 }} />
          </span>
        ))}
      </div>
    </div>
  )
}

const STEPS = [
  { num: '01', title: 'Анкета', tag: '5 минут', desc: 'Ответьте на вопросы об образе жизни, питании и симптомах — займёт 5–7 минут.' },
  { num: '02', title: 'Анализы', tag: 'ИИ-распознавание', desc: 'Загрузите PDF или фото лабораторных результатов. Алгоритм распознает их автоматически.' },
  { num: '03', title: 'Профиль', tag: 'Персонально', desc: 'Получите персональные нутрициологические рекомендации с конкретными шагами.' },
]

function How() {
  return (
    <section id="how" className="slide-sec" style={{ position: 'relative', overflow: 'hidden', padding: 'clamp(6rem,12vw,11rem) 0', background: 'linear-gradient(180deg, #2a3825 0%, #35462f 45%, #3a5030 100%)' }}>
      <div aria-hidden="true" style={{ position: 'absolute', inset: 0, opacity: 0.42, background: `url('${BRAND}pattern-vine.svg')`, backgroundSize: '150px' }} />
      <div style={{ position: 'absolute', top: 0, insetInline: 0, height: 1, background: 'linear-gradient(90deg, transparent, rgba(255,230,146,0.3) 30%, rgba(255,230,146,0.3) 70%, transparent)' }} />
      <div style={{ position: 'relative', zIndex: 10, maxWidth: '80rem', margin: '0 auto', padding: '0 clamp(1.5rem,5vw,4rem)' }}>
        <Reveal>
          <p style={{ fontSize: 11, letterSpacing: '0.3em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.38)', margin: '0 0 28px' }}>Как это работает</p>
        </Reveal>
        <Reveal delay={80}>
          <h2 className="font-display" style={{ fontSize: 'clamp(2.6rem,6vw,5.5rem)', color: '#fff', lineHeight: 1.04, margin: '0 0 5rem', fontWeight: 500 }}>
            Три шага к пониманию
            <br />
            <span style={{ fontStyle: 'italic', color: 'rgba(255,230,146,0.85)' }}>своего здоровья</span>
          </h2>
        </Reveal>
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          {STEPS.map((s, i) => (
            <Reveal key={s.num} delay={i * 90} className="step-row how-step" style={{ display: 'grid', gridTemplateColumns: '7rem 16rem 1fr', gap: '0 2.5rem', alignItems: 'center', padding: 'clamp(2rem,4vw,3.25rem) 0', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
              <span className="font-display step-num" style={{ fontSize: 'clamp(3rem,6vw,5.5rem)', color: 'rgba(255,230,146,0.12)', lineHeight: 1, fontWeight: 600 }}>
                {s.num}
              </span>
              <div>
                <h3 className="font-display" style={{ fontSize: 'clamp(2rem,3vw,2.75rem)', color: '#fff', lineHeight: 1.05, margin: '0 0 0.6rem', fontWeight: 500 }}>
                  {s.title}
                </h3>
                <Chip tone="gold">{s.tag}</Chip>
              </div>
              <p style={{ fontSize: 17, lineHeight: 1.65, color: 'rgba(255,255,255,0.58)', maxWidth: '34rem', margin: 0 }}>{s.desc}</p>
            </Reveal>
          ))}
        </div>
        <Reveal delay={120} style={{ marginTop: '4.5rem', display: 'flex', alignItems: 'center', gap: '1.8rem', flexWrap: 'wrap' }}>
          <Button variant="gold" size="lg" href={START_HREF}>
            Начать анкетирование
          </Button>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', maxWidth: '18rem', lineHeight: 1.6, margin: 0 }}>Займёт 5–7 минут. Аккаунт создаётся автоматически по email.</p>
        </Reveal>
      </div>
    </section>
  )
}

const BENEFITS = [
  { title: '24 маркера', desc: 'В фокусе анализа: витамины, гормоны, липиды, ферменты' },
  { title: 'Ваша норма', desc: 'Нутрициологические оптимумы, а не лабораторные диапазоны' },
  { title: 'Контекст', desc: 'Анкета добавляет образ жизни к биохимии' },
  { title: 'Приватно', desc: 'Данные хранятся на российских серверах' },
]

function Benefits() {
  return (
    <section className="slide-sec" style={{ position: 'relative', overflow: 'hidden', padding: 'clamp(5rem,9vw,8rem) 0', background: 'linear-gradient(180deg, #3a5030 0%, #4a6040 60%, #35462f 100%)' }}>
      <div style={{ maxWidth: '80rem', margin: '0 auto', padding: '0 clamp(1.5rem,5vw,4rem)' }}>
        <Reveal>
          <p style={{ fontSize: 11, letterSpacing: '0.3em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.32)', margin: '0 0 3.5rem' }}>Что входит в профиль</p>
        </Reveal>
        <div className="benefits-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20 }}>
          {BENEFITS.map((b, i) => (
            <Reveal key={b.title} delay={i * 90}>
              <GlassCard variant="card" style={{ padding: '1.9rem 1.6rem', borderRadius: 16, position: 'relative', overflow: 'hidden', height: '100%' }}>
                <img src={`${BRAND}corner-flourish.svg`} alt="" aria-hidden="true" style={{ position: 'absolute', top: 0, right: 0, width: 64, opacity: 0.4, transform: 'scaleX(-1)' }} />
                <p className="font-display" style={{ fontSize: 'clamp(1.6rem,2.2vw,2.1rem)', color: '#fff', lineHeight: 1.1, margin: '0 0 0.6rem', fontWeight: 500 }}>{b.title}</p>
                <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.52)', lineHeight: 1.6, margin: 0 }}>{b.desc}</p>
              </GlassCard>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

function Cta() {
  return (
    <section id="start" className="slide-sec" style={{ position: 'relative', overflow: 'hidden', background: 'linear-gradient(160deg, #2a3825 0%, #35462f 50%, #28331f 100%)' }}>
      <div aria-hidden="true" className="animate-halo" style={{ position: 'absolute', right: '8%', top: '50%', width: 560, height: 560, maxWidth: '60vw', maxHeight: '60vw', background: 'var(--glow-gold)', filter: 'blur(40px)' }} />
      <div style={{ position: 'absolute', top: 0, insetInline: 0, height: 1, background: 'rgba(255,255,255,0.1)' }} />
      <div style={{ position: 'relative', zIndex: 10, maxWidth: '64rem', margin: '0 auto', padding: 'clamp(6rem,11vw,10rem) clamp(1.5rem,5vw,4rem)', textAlign: 'center' }}>
        <Reveal style={{ display: 'flex', justifyContent: 'center', marginBottom: 28 }}>
          <img src={`${BRAND}monogram.svg`} alt="" width={76} />
        </Reveal>
        <Reveal delay={80}>
          <h2 className="font-display" style={{ fontSize: 'clamp(2.6rem,6vw,5.5rem)', color: '#fff', lineHeight: 1.05, margin: '0 0 1.5rem', fontWeight: 500 }}>
            Ваш персональный
            <br />
            <span style={{ fontStyle: 'italic', color: 'rgba(255,230,146,0.85)' }}>профиль здоровья</span>
          </h2>
        </Reveal>
        <Reveal delay={160}>
          <img src={`${BRAND}flourish-divider.svg`} alt="" style={{ width: 280, maxWidth: '70%', margin: '0 auto 1.8rem', display: 'block' }} />
        </Reveal>
        <Reveal delay={220}>
          <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 18, lineHeight: 1.6, maxWidth: '30rem', margin: '0 auto 2.5rem' }}>Заполните анкету. Загрузите анализы. Получите конкретные рекомендации.</p>
        </Reveal>
        <Reveal delay={300}>
          <Button variant="gold" size="lg" href={START_HREF}>
            Попробовать бесплатно
          </Button>
          <p style={{ color: 'rgba(255,255,255,0.22)', fontSize: 12, marginTop: '2.5rem' }}>Данные хранятся на российских серверах · Политика конфиденциальности</p>
        </Reveal>
      </div>
    </section>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const [loaded, setLoaded] = useState(false)
  const [start, setStart] = useState(false)

  // Прелоадер показываем один раз за сессию — при повторном визите пропускаем.
  useEffect(() => {
    if (sessionStorage.getItem('seenIntro')) setLoaded(true)
  }, [])

  useEffect(() => {
    if (!loaded) return
    const t = setTimeout(() => setStart(true), 80)
    return () => clearTimeout(t)
  }, [loaded])

  // Reveal sections (.slide-sec) as they scroll into view.
  useEffect(() => {
    if (!loaded) return
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add('in')
          io.unobserve(e.target)
        }
      }),
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' }
    )
    document.querySelectorAll('.slide-sec').forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [loaded])

  return (
    <main>
      {!loaded && (
        <Preloader
          onDone={() => {
            sessionStorage.setItem('seenIntro', '1')
            setLoaded(true)
          }}
        />
      )}
      <Hero start={start} />
      <Marquee />
      <How />
      <Benefits />
      <Cta />
    </main>
  )
}
