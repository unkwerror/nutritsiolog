'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence, type Variants } from 'framer-motion'
import { apiRequest, getAccessToken } from '@/lib/api'
import { AppBackground, AppNav } from '@/components/ds/AppCommon'

// ─── Types ───────────────────────────────────────────────────────────────────

type MarkerRecommendation = {
  summary: string | null
  steps: string[]
  foods: { add: string[]; avoid: string[] } | null
  topics: string[]
}

type MarkerAssessment = {
  status: 'normal' | 'mild' | 'severe'
  direction: 'low' | 'high' | null
  optimumMin: string | null
  optimumMax: string | null
  optimumSource: 'catalog' | 'lab' | null
  recommendation: MarkerRecommendation | null
}

type Marker = {
  id: number
  name: string
  code: string | null
  section: string | null
  value: string | null
  unit: string | null
  referenceMin: string | null
  referenceMax: string | null
  referenceRaw: string | null
  isOutOfRange: boolean
  outOfRangeDirection: 'low' | 'high' | null
  isEdited: boolean
  originalValue: string | null
  comment: string | null
  method: string | null
  // Оценка по оптимумам нутрициолога (может отсутствовать у только что
  // добавленного/отредактированного маркера до перезагрузки анализа)
  assessment?: MarkerAssessment
}

type AnalysisDetail = {
  id: number
  status: 'pending' | 'processing' | 'done' | 'failed'
  labName: string | null
  patientFullName: string | null
  patientGender: string | null
  patientBirthDate: string | null
  sampleTakenAt: string | null
  reportDate: string | null
  markers: Marker[]
  createdAt: string
}

type EditForm = {
  value: string
  unit: string
  comment: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const EASE: [number, number, number, number] = [0.25, 0.46, 0.45, 0.94]

const STATUS_LABEL: Record<AnalysisDetail['status'], string> = {
  pending: 'В очереди',
  processing: 'Обработка…',
  done: 'Готово',
  failed: 'Ошибка',
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  try {
    return new Intl.DateTimeFormat('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

function formatRange(m: Marker): string {
  if (m.referenceRaw) return m.referenceRaw
  if (m.referenceMin !== null && m.referenceMax !== null) {
    return `${m.referenceMin}–${m.referenceMax}`
  }
  if (m.referenceMin !== null) return `≥${m.referenceMin}`
  if (m.referenceMax !== null) return `≤${m.referenceMax}`
  return '—'
}

// Статус маркера: приоритет — оценка по оптимумам нутрициолога (решение 032),
// fallback — флаг «вне нормы» из бланка (для только что добавленных маркеров).
function markerStatus(m: Marker): 'normal' | 'mild' | 'severe' {
  if (m.assessment) return m.assessment.status
  return m.isOutOfRange ? 'mild' : 'normal'
}

function markerDirection(m: Marker): 'low' | 'high' | null {
  return m.assessment ? m.assessment.direction : m.outOfRangeDirection
}

// mild — умеренное отклонение (жёлтый), severe — сильное (красный)
const STATUS_COLOR: Record<'normal' | 'mild' | 'severe', string> = {
  normal: 'rgba(255,255,255,0.9)',
  mild: '#fbbf24',
  severe: '#f87171',
}

// Оптимальный коридор нутрициолога, если он посчитан для маркера
function formatOptimum(m: Marker): string | null {
  const a = m.assessment
  if (!a || a.optimumSource !== 'catalog') return null
  if (a.optimumMin !== null && a.optimumMax !== null) return `${a.optimumMin}–${a.optimumMax}`
  if (a.optimumMin !== null) return `≥${a.optimumMin}`
  if (a.optimumMax !== null) return `≤${a.optimumMax}`
  return null
}

function outOfRangeCount(markers: Marker[]): number {
  return markers.filter((m) => markerStatus(m) !== 'normal').length
}

function pluralForm(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod100 >= 11 && mod100 <= 19) return many
  if (mod10 === 1) return one
  if (mod10 >= 2 && mod10 <= 4) return few
  return many
}

// ─── Animations ──────────────────────────────────────────────────────────────

const container: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06, delayChildren: 0.05 } },
}

const rowVariant: Variants = {
  hidden: { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } },
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: AnalysisDetail['status'] }) {
  const styleMap: Record<AnalysisDetail['status'], React.CSSProperties> = {
    done: {
      background: 'rgba(255,230,146,0.12)',
      color: '#ffe692',
      border: '1px solid rgba(255,230,146,0.22)',
    },
    pending: {
      background: 'rgba(255,255,255,0.06)',
      color: 'rgba(255,255,255,0.5)',
      border: '1px solid rgba(255,255,255,0.1)',
    },
    processing: {
      background: 'rgba(255,255,255,0.06)',
      color: 'rgba(255,255,255,0.65)',
      border: '1px solid rgba(255,255,255,0.1)',
    },
    failed: {
      background: 'rgba(200,50,50,0.12)',
      color: 'rgba(255,100,100,0.85)',
      border: '1px solid rgba(200,50,50,0.22)',
    },
  }

  return (
    <span
      className="font-sans text-[11px] tracking-[0.08em] uppercase rounded-full px-3 py-1 shrink-0"
      style={styleMap[status]}
    >
      {STATUS_LABEL[status]}
    </span>
  )
}

// ─── Marker Row ───────────────────────────────────────────────────────────────

type MarkerRowProps = { marker: Marker; onClick: () => void }

function MarkerRow({ marker, onClick }: MarkerRowProps) {
  const status = markerStatus(marker)
  const dir = markerDirection(marker)
  const oor = status !== 'normal'
  const accent = STATUS_COLOR[status]
  const dotColor = oor ? accent : marker.isEdited ? '#ffe692' : 'rgba(255,255,255,0.14)'
  const valueColor = oor ? accent : 'rgba(255,255,255,0.9)'
  const rowBg =
    status === 'severe'
      ? 'rgba(248,113,113,0.07)'
      : status === 'mild'
        ? 'rgba(251,191,36,0.06)'
        : 'transparent'
  const rangeLabel = formatOptimum(marker) ?? formatRange(marker)
  const arrow = oor ? (dir === 'high' ? '↑' : dir === 'low' ? '↓' : '') : ''

  return (
    <motion.button
      variants={rowVariant}
      onClick={onClick}
      className="w-full text-left flex items-center gap-3 sm:gap-4 px-4 sm:px-5 py-4 rounded-xl transition-all hover:bg-white/[0.04]"
      style={{ background: rowBg }}
    >
      {/* Status dot */}
      <span
        className="shrink-0 w-2 h-2 rounded-full"
        style={{ background: dotColor }}
      />

      {/* Name + comment */}
      <div className="flex-1 min-w-0">
        <p className="font-sans text-sm text-white leading-snug truncate">{marker.name}</p>
        {marker.comment && (
          <p className="font-sans text-[13px] text-white/55 mt-0.5 truncate">{marker.comment}</p>
        )}
      </div>

      {/* Value + range */}
      <div className="shrink-0 text-right min-w-[5rem]">
        <p className="font-sans text-sm font-medium" style={{ color: valueColor }}>
          {arrow && <span className="text-[11px] mr-0.5">{arrow}</span>}
          {marker.value ?? '—'}
          {marker.unit && (
            <span className="text-white/35 text-[11px] font-normal ml-1">{marker.unit}</span>
          )}
        </p>
        <p className="font-sans text-[13px] text-white/60 mt-0.5">{rangeLabel}</p>
      </div>

      {/* Arrow */}
      <span className="shrink-0 text-white/18 text-base leading-none ml-0.5">›</span>
    </motion.button>
  )
}

// ─── Edit Drawer ──────────────────────────────────────────────────────────────

type EditDrawerProps = {
  marker: Marker
  form: EditForm
  saving: boolean
  saveError: string | null
  onChange: (field: keyof EditForm, value: string) => void
  onSave: () => void
  onClose: () => void
}

function EditDrawer({ marker, form, saving, saveError, onChange, onSave, onClose }: EditDrawerProps) {
  return (
    <>
      {/* Backdrop */}
      <motion.div
        className="fixed inset-0 z-40"
        style={{ background: 'rgba(0,0,0,0.55)' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />

      {/* Drawer — full-width bottom sheet on mobile, max-w on desktop */}
      <motion.div
        className="fixed bottom-0 inset-x-0 z-50 flex justify-center items-end"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 340 }}
      >
        <div
          className="w-full sm:max-w-lg sm:mb-5 rounded-t-[1.75rem] sm:rounded-[1.75rem] px-5 pb-10 pt-3"
          style={{
            background: '#2d3d28',
            border: '1px solid rgba(255,255,255,0.09)',
            boxShadow: '0 -12px 48px rgba(0,0,0,0.45)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Handle bar */}
          <div className="flex justify-center mb-5">
            <div className="w-9 h-1 rounded-full bg-white/18" />
          </div>

          {/* Header */}
          <h3
            className="font-display font-light text-white leading-tight mb-1"
            style={{ fontSize: 'clamp(1.4rem, 4vw, 1.75rem)' }}
          >
            {marker.name}
          </h3>

          {marker.isEdited && marker.originalValue !== null && (
            <p className="font-sans text-[12px] text-white/38 mb-1">
              Исходное:{' '}
              <span className="text-white/55">
                {marker.originalValue}
                {marker.unit ? ` ${marker.unit}` : ''}
              </span>
            </p>
          )}

          {(() => {
            const status = markerStatus(marker)
            if (status === 'normal') return null
            const dir = markerDirection(marker)
            const accent = STATUS_COLOR[status]
            const optimum = formatOptimum(marker)
            const rec = marker.assessment?.recommendation ?? null
            const statusLabel =
              (status === 'severe' ? 'Сильное отклонение' : 'Умеренное отклонение') +
              (dir === 'high' ? ' · выше оптимума' : dir === 'low' ? ' · ниже оптимума' : '')
            return (
              <div className="mb-4">
                <p
                  className="font-sans text-[11px] tracking-[0.06em] uppercase"
                  style={{ color: accent }}
                >
                  {statusLabel}
                </p>
                {optimum && (
                  <p className="font-sans text-[12px] text-white/45 mt-1">
                    Оптимум нутрициолога:{' '}
                    <span className="text-white/70">
                      {optimum}
                      {marker.unit ? ` ${marker.unit}` : ''}
                    </span>
                  </p>
                )}

                {rec && (rec.summary || rec.steps.length > 0 || rec.foods) && (
                  <div
                    className="mt-4 rounded-2xl p-4"
                    style={{
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.08)',
                    }}
                  >
                    <p className="font-sans text-[11px] tracking-[0.14em] uppercase text-white/40 mb-2">
                      Рекомендация
                    </p>
                    {rec.summary && (
                      <p className="font-sans text-[14px] text-white/85 leading-relaxed">
                        {rec.summary}
                      </p>
                    )}
                    {rec.steps.length > 0 && (
                      <ul className="mt-3 flex flex-col gap-1.5">
                        {rec.steps.map((s, i) => (
                          <li
                            key={i}
                            className="font-sans text-[13px] text-white/70 leading-snug flex gap-2"
                          >
                            <span style={{ color: '#ffe692' }}>•</span>
                            <span>{s}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    {rec.foods && (rec.foods.add.length > 0 || rec.foods.avoid.length > 0) && (
                      <div className="mt-3 flex flex-col gap-1.5">
                        {rec.foods.add.length > 0 && (
                          <p className="font-sans text-[13px] text-white/75 leading-snug">
                            <span className="text-white/45">Добавить: </span>
                            {rec.foods.add.join(', ')}
                          </p>
                        )}
                        {rec.foods.avoid.length > 0 && (
                          <p className="font-sans text-[13px] text-white/75 leading-snug">
                            <span className="text-white/45">Убрать: </span>
                            {rec.foods.avoid.join(', ')}
                          </p>
                        )}
                      </div>
                    )}
                    {rec.topics.length > 0 && (
                      <p className="font-sans text-[12px] text-white/40 mt-3">
                        См. в рекомендациях: {rec.topics.join(', ')}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )
          })()}

          {/* Form fields */}
          <div className="mt-5 flex flex-col gap-4">
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="font-sans text-[12px] text-white/60 uppercase tracking-[0.14em] mb-1.5 block">
                  Значение
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={form.value}
                  onChange={(e) => onChange('value', e.target.value)}
                  className="glass-input w-full px-4 py-3 text-base rounded-xl"
                  placeholder="0.0"
                />
              </div>
              <div className="w-28">
                <label className="font-sans text-[12px] text-white/60 uppercase tracking-[0.14em] mb-1.5 block">
                  Единица
                </label>
                <input
                  type="text"
                  value={form.unit}
                  onChange={(e) => onChange('unit', e.target.value)}
                  className="glass-input w-full px-4 py-3 text-base rounded-xl"
                  placeholder="мкг/л"
                />
              </div>
            </div>

            <div>
              <label className="font-sans text-[12px] text-white/60 uppercase tracking-[0.14em] mb-1.5 block">
                Комментарий
              </label>
              <textarea
                value={form.comment}
                onChange={(e) => onChange('comment', e.target.value)}
                className="glass-input w-full px-4 py-3 text-base rounded-xl resize-none"
                rows={3}
                placeholder="Добавьте заметку к этому маркеру…"
              />
            </div>
          </div>

          {/* Save error */}
          {saveError && (
            <p className="font-sans text-xs mt-3" style={{ color: 'rgba(248,113,113,0.9)' }}>
              {saveError}
            </p>
          )}

          {/* Actions */}
          <div className="flex gap-3 mt-6">
            <button
              onClick={onSave}
              disabled={saving}
              className="btn-gold flex-1"
            >
              {saving ? 'Сохранение…' : 'Сохранить'}
            </button>
            <button onClick={onClose} className="btn-outline-gold px-6">
              Отмена
            </button>
          </div>
        </div>
      </motion.div>
    </>
  )
}

// ─── Add Marker ───────────────────────────────────────────────────────────────

type NewMarkerPayload = {
  name: string
  value: number | null
  unit: string | null
  section: string | null
  comment: string | null
  isOutOfRange: boolean
}

function AddMarkerPanel({ onAdd }: { onAdd: (p: NewMarkerPayload) => Promise<void> }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [value, setValue] = useState('')
  const [unit, setUnit] = useState('')
  const [comment, setComment] = useState('')
  const [oor, setOor] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const canAdd = name.trim().length > 0 && !busy

  function reset() {
    setName('')
    setValue('')
    setUnit('')
    setComment('')
    setOor(false)
    setErr(null)
  }

  async function submit() {
    if (!canAdd) return
    let numValue: number | null = null
    const raw = value.trim()
    if (raw !== '') {
      const n = Number(raw.replace(',', '.'))
      if (!Number.isFinite(n)) {
        setErr('Значение должно быть числом')
        return
      }
      numValue = n
    }
    setBusy(true)
    setErr(null)
    try {
      await onAdd({
        name: name.trim(),
        value: numValue,
        unit: unit.trim() || null,
        section: null,
        comment: comment.trim() || null,
        isOutOfRange: oor,
      })
      reset()
      setOpen(false)
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Не удалось добавить маркер')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-full border px-4 text-[12.5px] font-medium transition"
        style={{
          color: '#ffe692',
          borderColor: open ? '#ffe692' : 'rgba(255,230,146,0.5)',
          background: open ? 'rgba(255,230,146,0.14)' : 'rgba(255,230,146,0.06)',
        }}
      >
        <span className={`text-base leading-none transition-transform ${open ? 'rotate-45' : ''}`}>+</span>
        {open ? 'Отмена' : 'Добавить маркер'}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: EASE }}
            className="overflow-hidden"
          >
            <div
              className="mt-3.5 rounded-2xl p-4"
              style={{ border: '1px solid rgba(255,230,146,0.2)', background: 'rgba(255,230,146,0.05)' }}
            >
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-[1.4fr_1fr]">
                <input
                  className="glass-input w-full rounded-xl px-3.5 py-2.5 text-base"
                  placeholder="Маркер (напр. Магний)"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                <div className="flex gap-2.5">
                  <input
                    className="glass-input w-full rounded-xl px-3.5 py-2.5 text-base"
                    placeholder="Значение"
                    inputMode="decimal"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                  />
                  <input
                    className="glass-input w-24 rounded-xl px-3.5 py-2.5 text-base"
                    placeholder="ед."
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                  />
                </div>
              </div>

              <div className="mt-2.5 flex flex-wrap items-center gap-2.5">
                <div className="flex gap-1.5">
                  {[
                    { on: !oor, label: 'В норме', v: false },
                    { on: oor, label: 'Отклонение', v: true },
                  ].map((s) => (
                    <button
                      key={s.label}
                      onClick={() => setOor(s.v)}
                      className="rounded-full border px-3 py-1.5 text-[12.5px] transition"
                      style={
                        s.on
                          ? { borderColor: '#ffe692', background: 'rgba(255,230,146,0.12)', color: '#ffe692' }
                          : { borderColor: 'rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.6)' }
                      }
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
                <input
                  className="glass-input min-w-[140px] flex-1 rounded-xl px-3.5 py-2.5 text-base"
                  placeholder="Комментарий (необязательно)"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                />
                <button onClick={() => void submit()} disabled={!canAdd} className="btn-gold px-5 py-2.5 disabled:opacity-40">
                  {busy ? 'Добавление…' : 'Добавить'}
                </button>
              </div>

              {err && (
                <p className="font-sans text-xs mt-3" style={{ color: 'rgba(248,113,113,0.9)' }}>
                  {err}
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type PageProps = { params: { id: string } }

export default function AnalysisDetailPage({ params }: PageProps) {
  const router = useRouter()
  const { id } = params

  const [analysis, setAnalysis] = useState<AnalysisDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)

  const [editingMarker, setEditingMarker] = useState<Marker | null>(null)
  const [editForm, setEditForm] = useState<EditForm>({ value: '', unit: '', comment: '' })
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const refreshAnalysis = useCallback(async () => {
    const data = await apiRequest<AnalysisDetail>(`/api/v1/analysis/${id}`)
    setAnalysis(data)
  }, [id])

  useEffect(() => {
    if (!getAccessToken()) {
      router.replace('/auth')
      return
    }
    apiRequest<AnalysisDetail>(`/api/v1/analysis/${id}`)
      .then(setAnalysis)
      .catch((e: unknown) => {
        setFetchError(e instanceof Error ? e.message : 'Не удалось загрузить анализ')
      })
      .finally(() => setLoading(false))
  }, [id, router])

  const groupedMarkers = useMemo<[string, Marker[]][]>(() => {
    if (!analysis) return []
    const map = new Map<string, Marker[]>()
    for (const m of analysis.markers) {
      const section = m.section ?? 'Прочее'
      const existing = map.get(section)
      if (existing) {
        existing.push(m)
      } else {
        map.set(section, [m])
      }
    }
    return Array.from(map.entries())
  }, [analysis])

  function openEdit(m: Marker) {
    setEditingMarker(m)
    setEditForm({ value: m.value ?? '', unit: m.unit ?? '', comment: m.comment ?? '' })
    setSaveError(null)
  }

  function closeEdit() {
    setEditingMarker(null)
    setSaveError(null)
  }

  function handleFormChange(field: keyof EditForm, value: string) {
    setEditForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSave() {
    if (!editingMarker || !analysis) return
    const markerId = editingMarker.id
    const analysisId = analysis.id
    setSaving(true)
    setSaveError(null)
    try {
      const body: { value?: number | null; unit?: string; comment?: string } = {}

      const rawValue = editForm.value.trim()
      const prevValue = editingMarker.value ?? ''
      if (rawValue !== prevValue) {
        if (rawValue === '') {
          body.value = null
        } else {
          const n = Number(rawValue.replace(',', '.'))
          if (!Number.isFinite(n)) {
            setSaveError('Значение должно быть числом')
            setSaving(false)
            return
          }
          body.value = n
        }
      }

      if (editForm.unit.trim() !== (editingMarker.unit ?? '')) body.unit = editForm.unit.trim()
      if (editForm.comment.trim() !== (editingMarker.comment ?? '')) body.comment = editForm.comment.trim()

      // Ничего не изменилось — просто закрываем без запроса.
      if (Object.keys(body).length === 0) {
        closeEdit()
        return
      }

      await apiRequest<Marker>(`/api/v1/analysis/${analysisId}/markers/${markerId}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      })
      // Перечитываем анализ целиком: сервер пересчитывает оценку по оптимумам
      // (статус/цвет/рекомендация) для новой ревизии маркера
      await refreshAnalysis()
      closeEdit()
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : 'Ошибка сохранения')
    } finally {
      setSaving(false)
    }
  }

  async function handleAddMarker(payload: NewMarkerPayload) {
    if (!analysis) return
    await apiRequest<Marker>(`/api/v1/analysis/${analysis.id}/markers`, {
      method: 'POST',
      body: JSON.stringify(payload),
    })
    // Перечитываем анализ, чтобы новый маркер получил оценку по оптимумам
    await refreshAnalysis()
  }

  // Loading
  if (loading) {
    return (
      <main style={{ position: 'relative', minHeight: '100vh' }}>
        <AppBackground glow="14%" />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <AppNav onBack={() => router.push('/analyses')} backLabel="К анализам" />
          <div className="flex items-center justify-center" style={{ minHeight: '60vh' }}>
            <p className="font-sans text-sm text-white/35">Загрузка…</p>
          </div>
        </div>
      </main>
    )
  }

  // Error / not found
  if (fetchError || !analysis) {
    return (
      <main style={{ position: 'relative', minHeight: '100vh' }}>
        <AppBackground glow="14%" />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <AppNav onBack={() => router.push('/analyses')} backLabel="К анализам" />
          <div className="flex flex-col items-center justify-center gap-5 px-6" style={{ minHeight: '60vh' }}>
            <p className="font-sans text-sm text-white/55 text-center">{fetchError ?? 'Анализ не найден'}</p>
            <Link href="/analyses" className="btn-outline-gold" style={{ fontSize: '0.875rem' }}>
              ← К анализам
            </Link>
          </div>
        </div>
      </main>
    )
  }

  const oorCount = outOfRangeCount(analysis.markers)
  const oorLabel =
    oorCount > 0
      ? `${oorCount} ${pluralForm(oorCount, 'показатель', 'показателя', 'показателей')} вне нормы`
      : null

  return (
    <main style={{ position: 'relative', minHeight: '100vh' }}>
      <AppBackground glow="14%" />
      <div style={{ position: 'relative', zIndex: 1 }}>
        <AppNav onBack={() => router.push('/analyses')} backLabel="К анализам" />

        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 pt-8 pb-28">

        {/* Analysis header */}
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: EASE }}
          className="mb-10"
        >
          <div className="flex items-start justify-between gap-4 mb-2">
            <h1
              className="font-display font-light text-white leading-tight"
              style={{ fontSize: 'clamp(1.7rem, 4vw, 2.8rem)' }}
            >
              {analysis.labName ?? `Анализ #${analysis.id}`}
            </h1>
            <StatusBadge status={analysis.status} />
          </div>

          {/* Meta */}
          <div className="flex flex-wrap gap-x-5 gap-y-1 mt-3">
            {analysis.patientFullName && (
              <span className="font-sans text-sm text-white/55">{analysis.patientFullName}</span>
            )}
            {analysis.sampleTakenAt && (
              <span className="font-sans text-sm text-white/35">
                Забор: {formatDate(analysis.sampleTakenAt)}
              </span>
            )}
            {analysis.reportDate && (
              <span className="font-sans text-sm text-white/35">
                Результат: {formatDate(analysis.reportDate)}
              </span>
            )}
            {!analysis.sampleTakenAt && !analysis.reportDate && (
              <span className="font-sans text-sm text-white/30">
                Загружен: {formatDate(analysis.createdAt)}
              </span>
            )}
          </div>

          {/* Out-of-range summary */}
          {oorLabel && (
            <p
              className="font-sans text-xs mt-4 tracking-[0.04em]"
              style={{ color: 'rgba(251,146,60,0.85)' }}
            >
              {oorLabel}
            </p>
          )}
        </motion.div>

        {/* Divider */}
        <div className="border-t border-white/10 mb-8" />

        {/* Markers header + add control */}
        {(analysis.status === 'done' || analysis.markers.length > 0) && (
          <div className="mb-7">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <h2 className="font-sans text-[11px] tracking-[0.24em] uppercase text-white/40">
                Показатели · {analysis.markers.length}
              </h2>
            </div>
            <AddMarkerPanel onAdd={handleAddMarker} />
          </div>
        )}

        {/* Markers by section */}
        {groupedMarkers.length === 0 ? (
          <p className="font-sans text-sm text-white/35">
            {analysis.status === 'pending' || analysis.status === 'processing'
              ? 'Анализ ещё обрабатывается…'
              : 'Маркеры не найдены'}
          </p>
        ) : (
          <div className="flex flex-col gap-10">
            {groupedMarkers.map(([section, markers]) => (
              <section key={section}>
                {/* Section header */}
                <div className="flex items-center justify-between mb-2 px-1">
                  <h2 className="font-sans text-[10px] tracking-[0.24em] uppercase text-white/38">
                    {section}
                  </h2>
                  <span className="font-sans text-[12px] text-white/45">{markers.length}</span>
                </div>

                {/* Rows */}
                <motion.div
                  variants={container}
                  initial="hidden"
                  animate="visible"
                  className="flex flex-col gap-0.5"
                >
                  {markers.map((m) => (
                    <MarkerRow key={m.id} marker={m} onClick={() => openEdit(m)} />
                  ))}
                </motion.div>
              </section>
            ))}
          </div>
        )}

        {/* Footer hint */}
        {groupedMarkers.length > 0 && (
          <p className="font-sans text-[13px] text-white/50 text-center mt-12">
            Нажмите на маркер, чтобы отредактировать значение
          </p>
        )}
        </div>
      </div>

      {/* Edit drawer */}
      <AnimatePresence>
        {editingMarker && (
          <EditDrawer
            marker={editingMarker}
            form={editForm}
            saving={saving}
            saveError={saveError}
            onChange={handleFormChange}
            onSave={() => { void handleSave() }}
            onClose={closeEdit}
          />
        )}
      </AnimatePresence>
    </main>
  )
}
