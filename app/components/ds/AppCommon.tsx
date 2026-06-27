'use client'

// Shared app-shell helpers, FX and chrome — ported from the DS `AppCommon.jsx`.
// Icons, reveal-on-scroll, the living forest background (tree-of-life in a ring +
// pollen motes), the in-app top bar, count-up numbers and the celebratory burst.

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'

type CSSVars = CSSProperties & Record<`--${string}`, string | number>

// ── Bespoke line-icon set (currentColor so it tints per state) ────────────────

const ICON_SVG: Record<string, string> = {
  survey:
    '<rect x="8" y="6" width="16" height="22" rx="2.5"/><path d="M12 6 V4.5 A1.5 1.5 0 0 1 13.5 3 h5 A1.5 1.5 0 0 1 20 4.5 V6"/><path d="M12.5 13 h7 M12.5 17 h7 M12.5 21 h4.5"/>',
  lab: '<path d="M13 4 h6 M14 4 v7.2 L8.6 22.5 A3 3 0 0 0 11.3 27 h9.4 A3 3 0 0 0 23.4 22.5 L18 11.2 V4"/><path d="M11.4 18 h9.2"/>',
  insight:
    '<path d="M16 5 C16 11 12 13 9 15 C12 17 16 19 16 27 C16 19 20 17 23 15 C20 13 16 11 16 5 Z"/><path d="M25 6 C25 8 24 8.6 23 9.2 C24 9.8 25 10.4 25 12.5 C25 10.4 26 9.8 27 9.2 C26 8.6 25 8 25 6 Z" stroke-width="1"/>',
  upload: '<path d="M16 20 V7 M11.5 11.5 L16 7 L20.5 11.5"/><path d="M7 19 v4 A2 2 0 0 0 9 25 h14 A2 2 0 0 0 25 23 v-4"/>',
  shield: '<path d="M16 4 L26 8 v7 c0 6.5 -4.4 10.8 -10 13 C10.4 25.8 6 21.5 6 15 V8 Z"/><path d="M12 15.5 L15 18.5 L20.5 12.5"/>',
}

export function Icon({ name, size = 24, color = 'var(--gold)', style = {} }: { name: string; size?: number; color?: string; style?: CSSProperties }) {
  return (
    <span
      aria-hidden="true"
      style={{ display: 'inline-flex', width: size, height: size, color, ...style }}
      dangerouslySetInnerHTML={{
        __html: `<svg viewBox="0 0 32 32" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round">${ICON_SVG[name] ?? ''}</svg>`,
      }}
    />
  )
}

// ── Reveal-on-scroll / on-mount ───────────────────────────────────────────────

export function useReveal<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => {
        if (e.isIntersecting) {
          el.classList.add('in')
          io.unobserve(el)
        }
      }),
      { threshold: 0.15, rootMargin: '0px 0px -6% 0px' }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return ref
}

export function Reveal({ children, delay = 0, className = '', style = {} }: { children: ReactNode; delay?: number; className?: string; style?: CSSProperties }) {
  const ref = useReveal()
  return (
    <div ref={ref} className={`reveal ${className}`} style={{ transitionDelay: `${delay}ms`, ...style }}>
      {children}
    </div>
  )
}

// ── Count-up number ───────────────────────────────────────────────────────────

export function AnimatedNumber({ value, duration = 900, suffix = '' }: { value: number; duration?: number; suffix?: string }) {
  const [n, setN] = useState(0)
  useEffect(() => {
    let raf = 0
    let t0 = 0
    const tick = (t: number) => {
      if (!t0) t0 = t
      const p = Math.min(1, (t - t0) / duration)
      const e = 1 - Math.pow(1 - p, 3)
      setN(Math.round(value * e))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value, duration])
  return (
    <>
      {n}
      {suffix}
    </>
  )
}

// ── Circular progress ring ────────────────────────────────────────────────────

export function ProgressRing({ value = 0, size = 96, stroke = 5, children }: { value?: number; size?: number; stroke?: number; children?: ReactNode }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const [shown, setShown] = useState(0)
  useEffect(() => {
    const t = setTimeout(() => setShown(value), 120)
    return () => clearTimeout(t)
  }, [value])
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={stroke} />
        <defs>
          <linearGradient id="ds-ringg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#d4a020" />
            <stop offset="0.6" stopColor="#ffe692" />
            <stop offset="1" stopColor="#fff4d5" />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="url(#ds-ringg)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (shown / 100) * c}
          style={{ transition: 'stroke-dashoffset 1.1s cubic-bezier(0.16,1,0.3,1)' }}
        />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>{children}</div>
    </div>
  )
}

// ── Living app background (tree-of-life in a ring + pollen + drift) ────────────

const BRAND = '/assets/brand/'

export function AppBackground({ glow = '46%' }: { glow?: string }) {
  // Landing-style rising particles (l-mote) — full-viewport, prominent.
  const motes = useMemo(
    () =>
      Array.from({ length: 22 }).map(() => ({
        left: `${(2 + Math.random() * 96).toFixed(1)}%`,
        size: (3 + Math.random() * 5).toFixed(1),
        dur: (24 + Math.random() * 26).toFixed(1),
        delay: (-Math.random() * 38).toFixed(1),
        dx: `${((Math.random() * 2 - 1) * 90).toFixed(0)}px`,
        mo: (0.4 + Math.random() * 0.5).toFixed(2),
      })),
    []
  )
  return (
    <div
      aria-hidden="true"
      style={{ position: 'absolute', inset: 0, zIndex: 0, overflow: 'hidden', background: 'linear-gradient(160deg, #2d3d28 0%, #35462f 48%, #3a5030 100%)' }}
    >
      <div className="app-tree">
        <img className="app-tree-img is-breathing" src={`${BRAND}tree-bare.svg`} alt="" />
        <img className="app-ring is-spinning" src={`${BRAND}ring-spin.svg`} alt="" />
      </div>
      <div style={{ position: 'absolute', inset: 0, opacity: 0.28, mixBlendMode: 'overlay', background: `url('${BRAND}grain.svg')`, backgroundSize: '170px' }} />
      <div
        className="app-glow is-drifting"
        style={{ position: 'absolute', left: '50%', top: glow, transform: 'translate(-50%,-50%)', width: 640, height: 640, maxWidth: '80vw', maxHeight: '80vw', background: 'var(--glow-gold)', filter: 'blur(54px)' }}
      />
      <div style={{ position: 'absolute', inset: 0 }}>
        {motes.map((m, i) => {
          const s: CSSVars = { left: m.left, width: `${m.size}px`, height: `${m.size}px`, animationDuration: `${m.dur}s`, animationDelay: `${m.delay}s`, '--dx': m.dx, '--mo': m.mo }
          return <span key={i} className="l-mote" style={s} />
        })}
        <span className="app-sheen" />
      </div>
    </div>
  )
}

// ── In-app top bar ────────────────────────────────────────────────────────────

export function AppNav({
  completeness = null,
  onBack,
  backLabel,
  userInitial = 'И',
}: {
  completeness?: number | null
  onBack?: () => void
  backLabel?: string
  userInitial?: string
}) {
  return (
    <nav
      className={`app-nav${onBack ? ' has-back' : ''}`}
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 40,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 'calc(1rem + env(safe-area-inset-top, 0px)) clamp(1.25rem, 5vw, 3rem) 1rem',
        background: 'rgba(40,51,31,0.55)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
        {onBack && (
          <button
            onClick={onBack}
            className="nav-back"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: 13, letterSpacing: '0.04em' }}
          >
            <span style={{ fontSize: 16 }}>←</span>
            {backLabel ?? 'Назад'}
          </button>
        )}
        {/* Логотип всегда ведёт на лендинг (корень) со всех экранов */}
        <Link href="/" aria-label="На главную" title="На главную" style={{ display: 'inline-flex', alignItems: 'center', gap: 11, textDecoration: 'none', cursor: 'pointer' }}>
          <img src={`${BRAND}monogram.svg`} alt="На главную" width={32} height={32} />
          <span className="app-nav-word font-display" style={{ fontStyle: 'italic', fontWeight: 500, fontSize: 20, color: '#fff' }}>
            Нутрициолог
          </span>
        </Link>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        {completeness != null && (
          <div className="app-nav-pct" style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <div style={{ width: 88, height: 4, borderRadius: 4, background: 'rgba(255,255,255,0.12)', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${completeness}%`, borderRadius: 4, background: 'linear-gradient(90deg,#d4a020,#ffe692)', transition: 'width .9s cubic-bezier(0.16,1,0.3,1)' }} />
            </div>
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>{completeness}%</span>
          </div>
        )}
        <Link
          href="/profile"
          aria-label="Профиль"
          style={{ display: 'grid', placeItems: 'center', width: 34, height: 34, borderRadius: '50%', background: 'rgba(255,230,146,0.12)', border: '1px solid rgba(255,230,146,0.3)', fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 15, color: 'var(--gold)', textDecoration: 'none' }}
        >
          {userInitial}
        </Link>
      </div>
    </nav>
  )
}

// ── Rising gold particles (landing-style, full-viewport) ──────────────────────

export function Motes({ count = 22 }: { count?: number }) {
  const motes = useMemo(
    () =>
      Array.from({ length: count }).map(() => ({
        left: `${(2 + Math.random() * 96).toFixed(1)}%`,
        size: (3 + Math.random() * 5).toFixed(1),
        dur: (24 + Math.random() * 26).toFixed(1),
        delay: (-Math.random() * 38).toFixed(1),
        dx: `${((Math.random() * 2 - 1) * 90).toFixed(0)}px`,
        mo: (0.4 + Math.random() * 0.5).toFixed(2),
      })),
    [count]
  )
  return (
    <div aria-hidden="true" style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
      {motes.map((m, i) => {
        const s: CSSVars = { left: m.left, width: `${m.size}px`, height: `${m.size}px`, animationDuration: `${m.dur}s`, animationDelay: `${m.delay}s`, '--dx': m.dx, '--mo': m.mo }
        return <span key={i} className="l-mote" style={s} />
      })}
    </div>
  )
}

// ── Celebratory burst ─────────────────────────────────────────────────────────

export function Burst({ n = 20 }: { n?: number }) {
  const parts = useMemo(
    () =>
      Array.from({ length: n }).map((_, i) => {
        const a = (i / n) * Math.PI * 2 + (Math.random() - 0.5) * 0.4
        const dist = 70 + Math.random() * 120
        return {
          x: Math.round(Math.cos(a) * dist),
          y: Math.round(Math.sin(a) * dist),
          size: (3 + Math.random() * 5).toFixed(1),
          delay: (Math.random() * 0.18).toFixed(2),
          dur: (0.9 + Math.random() * 0.7).toFixed(2),
        }
      }),
    [n]
  )
  return (
    <div className="burst" aria-hidden="true">
      {parts.map((p, i) => {
        const s: CSSVars = { width: `${p.size}px`, height: `${p.size}px`, animationDelay: `${p.delay}s`, animationDuration: `${p.dur}s`, '--bx': `${p.x}px`, '--by': `${p.y}px` }
        return <span key={i} className="burst-p" style={s} />
      })}
    </div>
  )
}
