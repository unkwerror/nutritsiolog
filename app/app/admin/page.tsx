'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, useReducedMotion, AnimatePresence } from 'framer-motion'
import { apiRequest, getAccessToken, API_BASE } from '@/lib/api'

// ─── API types (mirror api/src/modules/admin/schemas.ts) ─────────────────────

type Gender = 'male' | 'female'

type UserListItem = {
  id: string
  firstName: string
  lastName: string
  middleName: string | null
  email: string | null
  phone: string | null
  gender: Gender | null
  createdAt: string
  analysesCount: number
  hasQuestionnaire: boolean
}
type SearchResponse = { total: number; limit: number; offset: number; users: UserListItem[] }

type Marker = {
  id: number
  name: string
  code: string | null
  section: string | null
  value: string | null
  unit: string | null
  referenceRaw: string | null
  isOutOfRange: boolean
  outOfRangeDirection: 'low' | 'high' | null
  isEdited: boolean
  comment: string | null
  method: string | null
}
type Analysis = {
  id: number
  status: string
  detectedTypes: string[] | null
  labName: string | null
  createdAt: string
  markers: Marker[]
}
type Signal = {
  category: string
  title: string
  text: string
  severity: 'info' | 'warning' | 'critical'
  sources: string[]
}
type UserDetail = {
  user: {
    id: string
    firstName: string
    lastName: string
    middleName: string | null
    gender: Gender | null
    dateOfBirth: string | null
    email: string | null
    phone: string | null
    consentPd: boolean
    consentMedicalData: boolean
    createdAt: string
  }
  analyses: Analysis[]
  questionnaire: { tags: string[]; createdAt: string } | null
  recommendations: { signals: Signal[]; hasQuestionnaire: boolean; hasAnalyses: boolean }
}

// ─── helpers ──────────────────────────────────────────────────────────────────

const GENDER_RU: Record<Gender, string> = { male: 'Мужской', female: 'Женский' }

const SEVERITY: Record<Signal['severity'], { color: string; dot: string; label: string }> = {
  info: { color: 'rgba(255,255,255,0.45)', dot: 'rgba(255,255,255,0.4)', label: 'Рекомендация' },
  warning: { color: 'rgba(255,200,80,0.9)', dot: '#ffc850', label: 'Внимание' },
  critical: { color: 'rgba(255,140,110,0.95)', dot: '#ff9a7a', label: 'Важно' },
}

function pluralRu(n: number, forms: [string, string, string]): string {
  const m10 = n % 10
  const m100 = n % 100
  if (m10 === 1 && m100 !== 11) return forms[0]
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return forms[1]
  return forms[2]
}
function ageFrom(iso: string | null): number | null {
  if (!iso) return null
  const dob = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(dob.getTime())) return null
  const now = new Date()
  let age = now.getFullYear() - dob.getFullYear()
  const m = now.getMonth() - dob.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--
  return age
}
function fmtDate(iso: string): string {
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }).format(
    new Date(iso)
  )
}
function trimNumeric(v: string | null): string {
  if (v == null) return '—'
  return v.includes('.') ? v.replace(/\.?0+$/, '') : v
}

// ─── living background (forest + breathing tree-of-life + glow) ───────────────

function LivingBackground() {
  const reduce = useReducedMotion()
  return (
    <div aria-hidden className="absolute inset-0 z-0 overflow-hidden" style={{ background: 'var(--grad-hero)' }}>
      <motion.img
        src="/assets/brand/tree-of-life.svg"
        alt=""
        draggable={false}
        className="absolute pointer-events-none select-none"
        style={{ right: '-10%', top: '50%', y: '-50%', width: 'min(62vw, 680px)', opacity: 0.42 }}
        animate={reduce ? undefined : { scale: [1, 1.035, 1] }}
        transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
      />
      <div
        className="absolute pointer-events-none"
        style={{
          left: '46%',
          top: '14%',
          width: 640,
          height: 640,
          maxWidth: '80vw',
          transform: 'translate(-50%,-50%)',
          background: 'var(--glow-gold)',
          filter: 'blur(54px)',
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          opacity: 0.2,
          mixBlendMode: 'overlay',
          backgroundImage: "url('/assets/brand/grain.svg')",
          backgroundSize: '170px',
        }}
      />
    </div>
  )
}

function ProgressRing({ value, size = 76, stroke = 5 }: { value: number; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const [shown, setShown] = useState(0)
  useEffect(() => {
    const t = setTimeout(() => setShown(value), 120)
    return () => clearTimeout(t)
  }, [value])
  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={stroke} />
        <defs>
          <linearGradient id="ringg" x1="0" y1="0" x2="1" y2="1">
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
          stroke="url(#ringg)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (shown / 100) * c}
          style={{ transition: 'stroke-dashoffset 1.1s cubic-bezier(0.16,1,0.3,1)' }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center font-display text-white" style={{ fontSize: 16 }}>
        {value}%
      </div>
    </div>
  )
}

// ─── page ──────────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const router = useRouter()
  const [gate, setGate] = useState<'checking' | 'ok' | 'denied'>('checking')

  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResponse | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<UserDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [tab, setTab] = useState<'anketa' | 'analyses' | 'recs'>('anketa')
  const [pdfBusy, setPdfBusy] = useState(false)

  // Admin gate — server checks email allowlist; non-admins bounce to dashboard.
  useEffect(() => {
    apiRequest('/api/v1/admin/me')
      .then(() => setGate('ok'))
      .catch(() => setGate('denied'))
  }, [])
  useEffect(() => {
    if (gate === 'denied') router.replace('/dashboard')
  }, [gate, router])

  // Debounced search.
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)
  const runSearch = useCallback((q: string) => {
    apiRequest<SearchResponse>(`/api/v1/admin/users?q=${encodeURIComponent(q)}&limit=50`)
      .then(setResults)
      .catch(() => setResults({ total: 0, limit: 50, offset: 0, users: [] }))
  }, [])
  useEffect(() => {
    if (gate !== 'ok') return
    if (debounce.current) clearTimeout(debounce.current)
    debounce.current = setTimeout(() => runSearch(query), 250)
    return () => {
      if (debounce.current) clearTimeout(debounce.current)
    }
  }, [query, gate, runSearch])

  // Load detail on selection.
  useEffect(() => {
    if (!selectedId) {
      setDetail(null)
      return
    }
    setDetailLoading(true)
    setTab('anketa')
    apiRequest<UserDetail>(`/api/v1/admin/users/${selectedId}`)
      .then(setDetail)
      .catch(() => setDetail(null))
      .finally(() => setDetailLoading(false))
  }, [selectedId])

  async function downloadPdf(userId: string) {
    setPdfBusy(true)
    try {
      const token = getAccessToken()
      const res = await fetch(`${API_BASE}/api/v1/admin/users/${userId}/profile.pdf`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: 'include',
      })
      if (!res.ok) throw new Error('pdf')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const cd = res.headers.get('Content-Disposition') ?? ''
      const m = /filename="([^"]+)"/.exec(cd)
      a.download = m?.[1] ?? 'profile.pdf'
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch {
      alert('Не удалось выгрузить PDF. Обновите страницу и попробуйте снова.')
    } finally {
      setPdfBusy(false)
    }
  }

  if (gate !== 'ok') {
    return (
      <main className="relative grid min-h-screen place-items-center" style={{ background: 'var(--grad-hero)' }}>
        <p className="font-sans text-sm" style={{ color: 'var(--ink-muted)' }}>
          {gate === 'checking' ? 'Проверяем доступ…' : 'Доступ запрещён'}
        </p>
      </main>
    )
  }

  const users = results?.users ?? []

  return (
    <main className="relative min-h-screen">
      <LivingBackground />

      <div className="relative z-10">
        {/* top bar */}
        <nav
          className="sticky top-0 z-40 flex items-center justify-between px-5 py-4 sm:px-8"
          style={{
            background: 'rgba(40,51,31,0.55)',
            backdropFilter: 'blur(14px)',
            WebkitBackdropFilter: 'blur(14px)',
            borderBottom: '1px solid var(--line)',
          }}
        >
          <a href="/dashboard" className="inline-flex items-center gap-3">
            <img src="/assets/brand/monogram.svg" alt="" width={32} height={32} />
            <span className="font-display italic text-white" style={{ fontWeight: 500, fontSize: 20 }}>
              Нутрициолог
            </span>
          </a>
          <a
            href="/dashboard"
            className="font-sans text-[13px]"
            style={{ color: 'var(--ink-dim)', letterSpacing: '0.04em' }}
          >
            ← Выход
          </a>
        </nav>

        <div className="mx-auto max-w-[74rem] px-5 pb-24 pt-8 sm:px-8 lg:pt-12">
          <div className="mb-2 flex items-center gap-3">
            <span
              className="font-sans"
              style={{
                fontSize: 11,
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                color: 'var(--forest)',
                background: 'var(--gold)',
                padding: '3px 10px',
                borderRadius: 6,
                fontWeight: 600,
              }}
            >
              Админ
            </span>
            <span
              className="font-sans"
              style={{ fontSize: 11, letterSpacing: '0.28em', textTransform: 'uppercase', color: 'var(--ink-muted)' }}
            >
              Консоль нутрициолога
            </span>
          </div>
          <h1
            className="font-display mb-8 text-white"
            style={{ fontWeight: 500, fontSize: 'clamp(2.2rem,5vw,3.4rem)', lineHeight: 1.02 }}
          >
            Пользователи
          </h1>

          <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[320px_1fr]">
            {/* left: search + list */}
            <div className="flex flex-col gap-3">
              <div className="relative">
                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 opacity-50">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.6">
                    <circle cx="11" cy="11" r="7" />
                    <path d="M21 21l-4-4" strokeLinecap="round" />
                  </svg>
                </span>
                <input
                  className="glass-input w-full py-3 pl-10 pr-3 text-sm"
                  placeholder="Поиск по email или имени"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              {results && (
                <p className="px-0.5 font-sans text-xs" style={{ color: 'var(--ink-muted)' }}>
                  {users.length} из {results.total}
                </p>
              )}
              <ul className="flex flex-col gap-1.5">
                {users.map((u) => {
                  const on = selectedId === u.id
                  return (
                    <li key={u.id}>
                      <button
                        onClick={() => setSelectedId(u.id)}
                        className="flex w-full items-center gap-3 rounded-xl p-3 text-left transition-colors"
                        style={{
                          border: `1px solid ${on ? 'rgba(255,230,146,0.45)' : 'var(--line)'}`,
                          background: on ? 'rgba(255,230,146,0.07)' : 'rgba(255,255,255,0.03)',
                        }}
                      >
                        <span
                          className="grid h-[38px] w-[38px] flex-shrink-0 place-items-center rounded-full font-display italic"
                          style={{
                            background: 'rgba(255,230,146,0.12)',
                            border: '1px solid rgba(255,230,146,0.25)',
                            color: 'var(--gold)',
                            fontSize: 15,
                          }}
                        >
                          {u.firstName[0] ?? '·'}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm text-white">
                            {u.lastName} {u.firstName}
                          </span>
                          <span className="block truncate text-xs" style={{ color: 'var(--ink-muted)' }}>
                            {u.email ?? u.phone ?? '—'}
                          </span>
                        </span>
                        <span
                          className="h-[7px] w-[7px] flex-shrink-0 rounded-full"
                          style={{ background: u.hasQuestionnaire ? 'var(--gold)' : 'rgba(255,255,255,0.25)' }}
                        />
                      </button>
                    </li>
                  )
                })}
                {results && users.length === 0 && (
                  <li
                    className="px-3 py-6 text-center font-sans text-[13px]"
                    style={{ color: 'var(--ink-muted)' }}
                  >
                    Никого не найдено
                  </li>
                )}
              </ul>
            </div>

            {/* right: detail */}
            {!selectedId ? (
              <div
                className="grid min-h-[320px] place-items-center rounded-[18px] font-sans text-sm"
                style={{ color: 'var(--ink-muted)', border: '1px dashed var(--line)' }}
              >
                Выберите пользователя слева
              </div>
            ) : detailLoading || !detail ? (
              <div
                className="grid min-h-[320px] place-items-center rounded-[18px] font-sans text-sm"
                style={{ color: 'var(--ink-muted)', border: '1px solid var(--line)' }}
              >
                {detailLoading ? 'Загружаем профиль…' : 'Профиль недоступен'}
              </div>
            ) : (
              <AdminDetail
                detail={detail}
                tab={tab}
                setTab={setTab}
                onPdf={() => downloadPdf(detail.user.id)}
                pdfBusy={pdfBusy}
              />
            )}
          </div>
        </div>
      </div>
    </main>
  )
}

// ─── detail panel ─────────────────────────────────────────────────────────────

function AdminDetail({
  detail,
  tab,
  setTab,
  onPdf,
  pdfBusy,
}: {
  detail: UserDetail
  tab: 'anketa' | 'analyses' | 'recs'
  setTab: (t: 'anketa' | 'analyses' | 'recs') => void
  onPdf: () => void
  pdfBusy: boolean
}) {
  const { user, recommendations } = detail
  const ready = recommendations.hasQuestionnaire && recommendations.hasAnalyses
  const completeness =
    (recommendations.hasQuestionnaire ? 50 : 0) + (recommendations.hasAnalyses ? 50 : 0)
  const age = ageFrom(user.dateOfBirth)
  const meta = [
    user.gender ? GENDER_RU[user.gender] : null,
    age != null ? `${age} ${pluralRu(age, ['год', 'года', 'лет'])}` : null,
  ].filter(Boolean)

  const TABS: [typeof tab, string][] = [
    ['anketa', 'Анкета'],
    ['analyses', 'Анализы'],
    ['recs', 'Рекомендации'],
  ]

  return (
    <div
      className="overflow-hidden rounded-[18px]"
      style={{ border: '1px solid var(--line)', background: 'rgba(255,255,255,0.035)' }}
    >
      {/* header */}
      <div
        className="flex flex-wrap items-center gap-5 p-5 sm:p-7"
        style={{ borderBottom: '1px solid var(--line)' }}
      >
        <ProgressRing value={completeness} />
        <div className="min-w-[200px] flex-1">
          <h2
            className="font-display mb-1 text-white"
            style={{ fontWeight: 500, fontSize: 'clamp(1.5rem,3vw,2rem)', lineHeight: 1.1 }}
          >
            {user.lastName} {user.firstName} {user.middleName ?? ''}
          </h2>
          <p className="text-[13px]" style={{ color: 'var(--ink-dim)' }}>
            {user.email ?? user.phone ?? '—'}
          </p>
          {meta.length > 0 && (
            <p className="mt-2.5 text-[12.5px]" style={{ color: 'var(--ink-dim)' }}>
              {meta.join('  ·  ')}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-2.5 text-right">
          <span
            className="inline-flex items-center gap-2 font-sans text-[12.5px]"
            style={{ color: ready ? 'rgba(255,230,146,0.85)' : 'var(--ink-muted)' }}
          >
            <span
              className="h-[6px] w-[6px] rounded-full"
              style={{ background: ready ? 'var(--gold)' : 'rgba(255,255,255,0.3)' }}
            />
            {ready ? 'Профиль готов' : 'Не завершён'}
          </span>
          <p className="text-xs" style={{ color: 'var(--ink-faint)' }}>
            Регистрация: {fmtDate(user.createdAt)}
          </p>
          <button
            onClick={onPdf}
            disabled={pdfBusy}
            className="btn-outline-gold"
            style={{ height: 38, minHeight: 38, padding: '0 16px', fontSize: 13, gap: 8, opacity: pdfBusy ? 0.6 : 1 }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3v12M8 11l4 4 4-4" />
              <path d="M5 19h14" />
            </svg>
            {pdfBusy ? 'Готовим…' : 'Выгрузить PDF'}
          </button>
        </div>
      </div>

      {/* tabs */}
      <div className="flex gap-1 px-5 pt-3 sm:px-7">
        {TABS.map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className="relative font-sans"
            style={{
              padding: '8px 14px 14px',
              fontSize: 13.5,
              letterSpacing: '0.02em',
              color: tab === k ? '#fff' : 'var(--ink-muted)',
            }}
          >
            {label}
            {tab === k && (
              <span
                className="absolute bottom-0 left-3.5 right-3.5 h-0.5 rounded"
                style={{ background: 'linear-gradient(90deg,#d4a020,#ffe692)' }}
              />
            )}
          </button>
        ))}
      </div>

      <div style={{ borderTop: '1px solid var(--line)' }} className="p-5 sm:p-7">
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            {tab === 'anketa' && <TabAnketa detail={detail} />}
            {tab === 'analyses' && <TabAnalyses analyses={detail.analyses} />}
            {tab === 'recs' && <TabRecs signals={detail.recommendations.signals} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4 py-2.5" style={{ borderBottom: '1px solid var(--line-soft)' }}>
      <span className="text-[13.5px]" style={{ color: 'var(--ink-dim)' }}>
        {k}
      </span>
      <span className="text-right text-sm text-white">{v}</span>
    </div>
  )
}

function Empty({ text }: { text: string }) {
  return (
    <div
      className="grid min-h-[180px] place-items-center rounded-[14px] p-6 text-center font-sans text-sm"
      style={{ color: 'var(--ink-muted)', border: '1px dashed var(--line)' }}
    >
      {text}
    </div>
  )
}

function TabAnketa({ detail }: { detail: UserDetail }) {
  const { user, questionnaire } = detail
  const age = ageFrom(user.dateOfBirth)
  return (
    <div>
      <div className="grid grid-cols-1 gap-x-8 sm:grid-cols-2">
        <Row k="Пол" v={user.gender ? GENDER_RU[user.gender] : '—'} />
        <Row k="Возраст" v={age != null ? `${age} ${pluralRu(age, ['год', 'года', 'лет'])}` : '—'} />
        <Row k="Email" v={user.email ?? '—'} />
        <Row k="Телефон" v={user.phone ?? '—'} />
        <Row k="Согласие на ПД" v={user.consentPd ? 'Да' : 'Нет'} />
        <Row k="Согласие на медданные" v={user.consentMedicalData ? 'Да' : 'Нет'} />
      </div>
      <div className="mt-5">
        <p className="mb-2.5 text-[12.5px]" style={{ color: 'var(--ink-dim)' }}>
          Сигналы из анкеты
        </p>
        {questionnaire && questionnaire.tags.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {questionnaire.tags.map((t) => (
              <span
                key={t}
                className="text-[12.5px]"
                style={{
                  color: 'rgba(255,230,146,0.85)',
                  background: 'var(--gold-soft)',
                  border: '1px solid rgba(255,230,146,0.2)',
                  padding: '5px 12px',
                  borderRadius: 999,
                }}
              >
                {t}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-[13px]" style={{ color: 'var(--ink-muted)' }}>
            Анкета ещё не заполнена
          </p>
        )}
      </div>
    </div>
  )
}

function TabAnalyses({ analyses }: { analyses: Analysis[] }) {
  if (analyses.length === 0) return <Empty text="Пользователь не загружал анализы" />
  const allMarkers = analyses.flatMap((a) => a.markers)
  return (
    <div>
      <ul className="mb-5 flex flex-col gap-2">
        {analyses.map((a) => (
          <li
            key={a.id}
            className="flex items-center gap-3 rounded-[11px] p-3"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--line)' }}
          >
            <span
              className="grid h-[34px] w-[34px] place-items-center rounded-lg"
              style={{ background: 'rgba(255,230,146,0.1)', color: 'var(--gold)' }}
            >
              {/* inline so stroke="currentColor" tints to gold (an <img> would render black) */}
              <svg width="18" height="18" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M13 4 h6 M14 4 v7.2 L8.6 22.5 A3 3 0 0 0 11.3 27 h9.4 A3 3 0 0 0 23.4 22.5 L18 11.2 V4" />
                <path d="M11.4 18 h9.2" />
              </svg>
            </span>
            <span className="flex-1">
              <span className="block text-[13.5px] text-white">{a.labName ?? 'Анализ'}</span>
              <span className="block text-xs" style={{ color: 'var(--ink-muted)' }}>
                {fmtDate(a.createdAt)} · {a.detectedTypes?.length ? a.detectedTypes.join(', ') : 'тип не определён'}
              </span>
            </span>
            <span
              className="inline-flex items-center gap-1.5 text-[12px]"
              style={{ color: a.status === 'done' ? 'rgba(255,230,146,0.8)' : 'var(--ink-muted)' }}
            >
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: a.status === 'done' ? 'var(--gold)' : 'rgba(255,255,255,0.3)' }}
              />
              {a.status === 'done' ? 'готово' : a.status === 'failed' ? 'ошибка' : 'обработка'}
            </span>
          </li>
        ))}
      </ul>

      {allMarkers.length > 0 ? (
        <>
          <p
            className="mb-3 font-sans"
            style={{ fontSize: 11, letterSpacing: '0.28em', textTransform: 'uppercase', color: 'var(--ink-muted)' }}
          >
            Распознанные маркеры
          </p>
          <div className="overflow-hidden rounded-[14px]" style={{ border: '1px solid var(--line)' }}>
            {allMarkers.map((m, i) => (
              <div
                key={m.id}
                className="flex items-center justify-between px-4 py-3"
                style={{
                  borderTop: i ? '1px solid var(--line-soft)' : 'none',
                  background: 'rgba(255,255,255,0.025)',
                }}
              >
                <span className="flex items-center gap-3">
                  <span
                    className="h-[7px] w-[7px] rounded-full"
                    style={{ background: m.isOutOfRange ? '#ffc850' : 'rgba(255,230,146,0.55)' }}
                  />
                  <span className="text-[13.5px] text-white">{m.name}</span>
                </span>
                <span className="flex items-center gap-3">
                  <span className="font-display text-[15px] text-white">
                    {trimNumeric(m.value)} {m.unit ?? ''}
                  </span>
                  <span
                    className="min-w-[88px] text-right text-[11.5px]"
                    style={{ color: m.isOutOfRange ? 'rgba(255,200,80,0.85)' : 'var(--ink-muted)' }}
                  >
                    {m.isOutOfRange
                      ? m.outOfRangeDirection === 'high'
                        ? 'выше нормы'
                        : 'ниже нормы'
                      : 'в норме'}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <p className="text-[13px]" style={{ color: 'var(--ink-muted)' }}>
          Анализы загружены, идёт распознавание…
        </p>
      )}
    </div>
  )
}

function TabRecs({ signals }: { signals: Signal[] }) {
  if (signals.length === 0) return <Empty text="Рекомендации появятся после загрузки анализов и анкеты" />
  return (
    <div style={{ borderTop: '1px solid var(--line)' }}>
      {signals.map((sig, i) => {
        const s = SEVERITY[sig.severity]
        return (
          <article
            key={`${sig.title}-${i}`}
            className="flex gap-4 py-[18px]"
            style={{ borderBottom: '1px solid var(--line)' }}
          >
            <span className="font-display leading-none" style={{ fontSize: 26, color: 'rgba(255,230,146,0.14)' }}>
              {String(i + 1).padStart(2, '0')}
            </span>
            <div>
              <div className="mb-1.5 flex items-center gap-2.5">
                <span className="h-[7px] w-[7px] rounded-full" style={{ background: s.dot }} />
                <span
                  className="font-sans"
                  style={{ fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase', color: s.color }}
                >
                  {sig.category} · {s.label}
                </span>
              </div>
              <h3 className="font-display mb-2 text-white" style={{ fontWeight: 500, fontSize: 19, lineHeight: 1.15 }}>
                {sig.title}
              </h3>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--ink-80)' }}>
                {sig.text}
              </p>
            </div>
          </article>
        )
      })}
    </div>
  )
}
