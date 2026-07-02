'use client'

// Design-system primitives — forms, surfaces, feedback.
// Ported from the Нутрициолог Design System `components/` (inline styles + CSS
// vars, no Tailwind). Consumed by the app screens.

import { createElement, type CSSProperties, type ReactNode, type HTMLAttributes } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

// Signature ease for all micro-interactions (matches the app screens).
export const EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1]

// ── Button ───────────────────────────────────────────────────────────────────

type ButtonProps = {
  children: ReactNode
  variant?: 'gold' | 'outline-gold' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  href?: string
  disabled?: boolean
  type?: 'button' | 'submit'
} & Omit<HTMLAttributes<HTMLElement>, 'onDrag' | 'onDragStart' | 'onDragEnd' | 'onAnimationStart' | 'onAnimationEnd' | 'onAnimationIteration'>

const BTN_SIZES: Record<'sm' | 'md' | 'lg', CSSProperties> = {
  // 44px min — комфортная зона нажатия (аудитория 45+, mobile-first)
  sm: { minHeight: 44, padding: '0 1.25rem', fontSize: '0.875rem' },
  md: { minHeight: 52, padding: '0 2rem', fontSize: '0.9375rem' },
  lg: { minHeight: 56, padding: '0 2.25rem', fontSize: '1.0625rem' },
}
const BTN_VARIANTS: Record<'gold' | 'outline-gold' | 'ghost', CSSProperties> = {
  gold: { border: '1.5px solid var(--gold)', background: 'var(--gold)', color: 'var(--forest)', fontWeight: 600 },
  'outline-gold': { border: '1.5px solid var(--gold-dim)', background: 'transparent', color: 'var(--gold)', fontWeight: 500 },
  ghost: { border: '1.5px solid rgba(255,255,255,0.28)', background: 'transparent', color: 'rgba(255,255,255,0.8)', fontWeight: 500 },
}

export function Button({
  children,
  variant = 'gold',
  size = 'md',
  href,
  disabled = false,
  type = 'button',
  className = '',
  style = {},
  ...rest
}: ButtonProps) {
  const reduce = useReducedMotion()
  const finalStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: 'var(--font-sans)',
    borderRadius: 'var(--radius-pill)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'opacity .14s ease, border-color .14s, background .14s',
    textDecoration: 'none',
    whiteSpace: 'nowrap',
    opacity: disabled ? 0.4 : 1,
    userSelect: 'none',
    ...BTN_SIZES[size],
    ...BTN_VARIANTS[variant],
    ...style,
  }
  // Тактильный отклик: лёгкий подъём на hover + сжатие на нажатии.
  const hoverFx = reduce || disabled ? undefined : { y: -1.5 }
  const tapFx = reduce || disabled ? undefined : { scale: 0.97 }
  const motionFx = { whileHover: hoverFx, whileTap: tapFx, transition: { duration: 0.18, ease: EASE_OUT } }
  if (href && !disabled) {
    return (
      <motion.a href={href} className={className} style={finalStyle} {...motionFx} {...rest}>
        {children}
      </motion.a>
    )
  }
  return (
    <motion.button type={type} className={className} style={finalStyle} disabled={disabled} {...motionFx} {...rest}>
      {children}
    </motion.button>
  )
}

// ── Input + Field ─────────────────────────────────────────────────────────────

type InputProps = {
  theme?: 'glass' | 'clean'
} & React.InputHTMLAttributes<HTMLInputElement>

export function Input({ theme = 'glass', className = '', style = {}, ...rest }: InputProps) {
  const cls = theme === 'clean' ? 'input-clean' : 'glass-input'
  return (
    <input
      className={`${cls} ${className}`}
      style={{
        width: '100%',
        padding: '0.875rem 1rem',
        fontSize: '1rem', // ≥16px — iOS Safari не зумит поле при фокусе
        fontFamily: 'var(--font-sans)',
        borderRadius: 'var(--radius-sm)',
        ...style,
      }}
      {...rest}
    />
  )
}

export function Field({ label, children, hint }: { label?: ReactNode; children: ReactNode; hint?: ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
      {label && (
        <label style={{ fontFamily: 'var(--font-sans)', fontSize: '0.875rem', fontWeight: 500, color: 'rgba(255,255,255,0.7)' }}>
          {label}
        </label>
      )}
      {children}
      {hint && (
        <span style={{ fontSize: '0.8125rem', color: 'rgba(255,255,255,0.55)', fontFamily: 'var(--font-sans)' }}>{hint}</span>
      )}
    </div>
  )
}

// ── RadioGroup / CheckboxRow ──────────────────────────────────────────────────

type Option = { value: string; label: ReactNode }
type OptionSize = 'md' | 'lg'

const OPTION_BTN = (on: boolean, size: OptionSize): CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  gap: size === 'lg' ? '0.875rem' : '0.75rem',
  borderRadius: 'var(--radius-sm)',
  padding: size === 'lg' ? '0.9375rem 1.125rem' : '0.75rem 1rem',
  minHeight: size === 'lg' ? 56 : 44, // ≥44px — комфортная зона нажатия
  textAlign: 'left',
  cursor: 'pointer',
  transition: 'border-color .15s, background .15s',
  border: on ? '1.5px solid rgba(255,230,146,0.65)' : '1.5px solid rgba(255,255,255,0.1)',
  background: on ? 'rgba(255,230,146,0.05)' : 'rgba(255,255,255,0.025)',
  width: '100%',
})

const OPTION_LABEL = (size: OptionSize): CSSProperties => ({
  fontFamily: 'var(--font-sans)',
  fontSize: size === 'lg' ? '0.9375rem' : '0.875rem',
  lineHeight: 1.4,
  color: 'rgba(255,255,255,0.92)',
})

export function RadioGroup({
  options = [],
  value,
  onChange = () => {},
  name,
  size = 'md',
}: {
  options: Option[]
  value?: string
  onChange?: (v: string) => void
  name?: string
  size?: OptionSize
}) {
  const reduce = useReducedMotion()
  const ctrl = size === 'lg' ? 18 : 16
  return (
    <div style={{ display: 'grid', gap: '0.5rem' }} role="radiogroup">
      {options.map((o) => {
        const on = value === o.value
        return (
          <motion.button
            key={o.value}
            type="button"
            name={name}
            onClick={() => onChange(o.value)}
            aria-pressed={on}
            style={OPTION_BTN(on, size)}
            whileTap={reduce ? undefined : { scale: 0.985 }}
            transition={{ duration: 0.15, ease: EASE_OUT }}
          >
            <span
              style={{
                display: 'inline-flex',
                height: ctrl,
                width: ctrl,
                flexShrink: 0,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '50%',
                border: `1px solid ${on ? 'var(--gold)' : 'rgba(255,255,255,0.28)'}`,
              }}
            >
              {on && <span style={{ height: ctrl / 2, width: ctrl / 2, borderRadius: '50%', background: 'var(--gold)' }} />}
            </span>
            <span style={OPTION_LABEL(size)}>{o.label}</span>
          </motion.button>
        )
      })}
    </div>
  )
}

export function CheckboxRow({
  options = [],
  values = [],
  onToggle = () => {},
  size = 'md',
}: {
  options: Option[]
  values?: string[]
  onToggle?: (v: string) => void
  size?: OptionSize
}) {
  const reduce = useReducedMotion()
  const ctrl = size === 'lg' ? 18 : 16
  return (
    <div style={{ display: 'grid', gap: '0.5rem' }}>
      {options.map((o) => {
        const on = values.includes(o.value)
        return (
          <motion.button
            key={o.value}
            type="button"
            onClick={() => onToggle(o.value)}
            aria-pressed={on}
            style={OPTION_BTN(on, size)}
            whileTap={reduce ? undefined : { scale: 0.985 }}
            transition={{ duration: 0.15, ease: EASE_OUT }}
          >
            <span
              style={{
                display: 'inline-flex',
                height: ctrl,
                width: ctrl,
                flexShrink: 0,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 5,
                transition: 'all .15s',
                border: `1px solid ${on ? 'var(--gold)' : 'rgba(255,255,255,0.28)'}`,
                background: on ? 'var(--gold)' : 'transparent',
              }}
            >
              {on && (
                <svg width={ctrl - 6} height={ctrl - 6} viewBox="0 0 12 12" fill="none" aria-hidden="true">
                  <path d="M2.5 6.2 5 8.5l4.5-5" stroke="#35462f" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </span>
            <span style={OPTION_LABEL(size)}>{o.label}</span>
          </motion.button>
        )
      })}
    </div>
  )
}

// ── GlassCard ─────────────────────────────────────────────────────────────────

const GLASS: Record<'card' | 'modal' | 'step', CSSProperties> = {
  card: {
    background: 'rgba(255,255,255,0.04)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    border: '1px solid rgba(255,255,255,0.09)',
    boxShadow: '4px 4px 24px rgba(0,0,0,0.35), inset 1px 1px 0 rgba(255,255,255,0.08)',
    borderRadius: 'var(--radius-md)',
  },
  modal: {
    background: 'rgba(255,255,255,0.07)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    border: '1px solid rgba(255,255,255,0.12)',
    boxShadow: '0 24px 56px rgba(0,0,0,0.4), inset 1px 1px 0 rgba(255,255,255,0.1)',
    borderRadius: 'var(--radius-lg)',
  },
  step: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.09)',
    boxShadow: '4px 4px 16px rgba(0,0,0,0.3), inset 1px 1px 0 rgba(255,255,255,0.08)',
    borderRadius: 'var(--radius-md)',
  },
}

export function GlassCard({
  variant = 'card',
  as = 'div',
  className = '',
  style = {},
  children,
  ...rest
}: {
  variant?: 'card' | 'modal' | 'step'
  as?: 'div' | 'section' | 'article' | 'aside'
  children: ReactNode
} & HTMLAttributes<HTMLElement>) {
  return createElement(as, { className, style: { ...GLASS[variant], ...style }, ...rest }, children)
}

// ── Chip ──────────────────────────────────────────────────────────────────────

const CHIP_TONES: Record<'glass' | 'gold', CSSProperties> = {
  glass: {
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.12)',
    color: 'rgba(255,255,255,0.6)',
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)',
    boxShadow: 'inset 1px 1px 0 rgba(255,255,255,0.08)',
  },
  gold: { background: 'rgba(255,230,146,0.08)', border: '1px solid rgba(255,230,146,0.15)', color: 'rgba(255,230,146,0.6)' },
}

export function Chip({ children, tone = 'glass', style = {}, ...rest }: { children: ReactNode; tone?: 'glass' | 'gold' } & HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        fontFamily: 'var(--font-sans)',
        fontSize: '0.6875rem',
        letterSpacing: '0.12em',
        padding: '0.375rem 0.875rem',
        borderRadius: 9999,
        ...CHIP_TONES[tone],
        ...style,
      }}
      {...rest}
    >
      {children}
    </span>
  )
}

// ── StatusBadge ───────────────────────────────────────────────────────────────

const STATUS: Record<string, { label: string; color: string; dot: boolean }> = {
  pending: { label: 'В очереди', color: 'rgba(255,255,255,0.45)', dot: false },
  processing: { label: 'Обработка', color: 'rgba(255,255,255,0.45)', dot: false },
  done: { label: 'Готово', color: 'rgba(255,230,146,0.8)', dot: true },
  failed: { label: 'Ошибка', color: '#ff9a9a', dot: true },
  active: { label: 'Заполнена', color: 'rgba(255,230,146,0.8)', dot: true },
  inactive: { label: 'Не заполнена', color: 'rgba(255,255,255,0.45)', dot: false },
}

export function StatusBadge({ status = 'pending', label, color, dot }: { status?: string; label?: string; color?: string; dot?: boolean }) {
  const s = STATUS[status] ?? STATUS.pending!
  const _label = label ?? s.label
  const _color = color ?? s.color
  const _dot = dot ?? s.dot
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
      {_dot && (
        <span style={{ display: 'inline-block', height: 6, width: 6, borderRadius: '50%', background: _color === '#ff9a9a' ? '#ff9a9a' : 'var(--gold)' }} />
      )}
      <span style={{ fontFamily: 'var(--font-sans)', fontSize: '0.8125rem', color: _color }}>{_label}</span>
    </span>
  )
}

// ── Spinner ───────────────────────────────────────────────────────────────────

export function Spinner({ size = 12 }: { size?: number }) {
  return (
    <span
      style={{
        display: 'inline-block',
        height: size,
        width: size,
        borderRadius: '50%',
        border: '2px solid rgba(255,230,146,0.25)',
        borderTopColor: 'var(--gold)',
        animation: 'ds-spin 0.7s linear infinite',
      }}
      aria-hidden="true"
    />
  )
}

// ── ProgressSteps ─────────────────────────────────────────────────────────────

export function ProgressSteps({ total = 3, current = 0, style = {} }: { total?: number; current?: number; style?: CSSProperties }) {
  return (
    <div style={{ display: 'flex', gap: '0.375rem', ...style }}>
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          style={{
            height: 2,
            flex: 1,
            borderRadius: 9999,
            transition: 'background .3s',
            background: i <= current ? 'rgba(255,230,146,0.75)' : 'rgba(255,255,255,0.1)',
          }}
        />
      ))}
    </div>
  )
}

// ── FadeUp — staggered mount reveal (framer-motion) ──────────────────────────
// Спокойное появление блока при монтировании: opacity 0 + y 12 → 0.
// Уважает prefers-reduced-motion (без сдвига, только fade). Задержка
// ограничена 0.35s, чтобы каскад не растягивался.

export function FadeUp({
  children,
  delay = 0,
  y = 12,
  style = {},
  className = '',
}: {
  children: ReactNode
  delay?: number
  y?: number
  style?: CSSProperties
  className?: string
}) {
  const reduce = useReducedMotion()
  return (
    <motion.div
      className={className}
      style={style}
      initial={{ opacity: 0, y: reduce ? 0 : y }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: EASE_OUT, delay: Math.min(delay, 0.35) }}
    >
      {children}
    </motion.div>
  )
}
