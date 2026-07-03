'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiRequest, getAccessToken, API_BASE } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { AppBackground, AppNav, Icon } from '@/components/ds/AppCommon'
import { Button, StatusBadge } from '@/components/ds/primitives'

const ALLOWED_MIME = ['application/pdf', 'image/jpeg', 'image/png']
const MAX_FILES = 5
const MAX_SIZE_MB = 10

// Единая шкала прогресса 0–100 объединяет две фазы:
//  0–35%  — байтовая загрузка файла (XHR upload progress)
//  35–100% — распознавание на сервере (SSE, прогресс воркера 0–100 → 35–97)
const UPLOAD_CEIL = 35

type AnalysisStatus = 'pending' | 'processing' | 'done' | 'failed'
type PendingFile = { file: File; id: string; error?: string }
type RowStatus = AnalysisStatus | 'uploading' | 'error'
type UploadRow = {
  id: string
  fileName: string
  analysisId: number | null
  status: RowStatus
  progress: number
  message?: string
}
type UploadResponse = { analysisId: number; status: string }
type SseEvent = { status: AnalysisStatus; analysisId: number; progress?: number }

function uid(): string {
  return Math.random().toString(36).slice(2)
}
function validateFile(file: File): string | null {
  if (!ALLOWED_MIME.includes(file.type)) return 'Поддерживаются PDF, JPEG, PNG'
  if (file.size > MAX_SIZE_MB * 1024 * 1024) return `Файл больше ${MAX_SIZE_MB} МБ`
  return null
}
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} КБ`
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`
}
function inFlight(s: RowStatus): boolean {
  return s === 'uploading' || s === 'pending' || s === 'processing'
}
function phaseLabel(s: RowStatus): string {
  if (s === 'uploading') return 'Загрузка'
  if (s === 'pending') return 'В очереди'
  return 'Распознавание'
}
// Потолок прогресса для фазы: пока не пришёл следующий чекпоинт, бар плавно
// «подползает» к потолку, но не перепрыгивает его (чтобы 100% был только на done)
function ceilFor(s: RowStatus): number {
  switch (s) {
    case 'uploading':
      return UPLOAD_CEIL
    case 'pending':
      return 42
    case 'processing':
      return 97
    default:
      return 100
  }
}

// Загрузка через XHR ради прогресса по байтам (fetch его не даёт). На 401
// откатываемся к apiRequest (там single-flight refresh токена) без прогресса.
function uploadWithProgress(file: File, onProgress: (fraction: number) => void): Promise<UploadResponse> {
  return new Promise((resolve, reject) => {
    const token = getAccessToken()
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${API_BASE}/api/v1/analysis/upload`)
    xhr.withCredentials = true
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`)

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded / e.total)
    }
    xhr.onload = () => {
      if (xhr.status === 401) {
        const form = new FormData()
        form.append('file', file)
        apiRequest<UploadResponse>('/api/v1/analysis/upload', { method: 'POST', body: form })
          .then(resolve)
          .catch(reject)
        return
      }
      try {
        const data = JSON.parse(xhr.responseText) as UploadResponse & {
          error?: { message?: string }
          message?: string
        }
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(data)
        } else {
          const msg =
            data?.error?.message ??
            data?.message ??
            (xhr.status === 413
              ? 'Файл слишком большой — максимум 10 МБ'
              : `Ошибка сервера (HTTP ${xhr.status})`)
          reject(new Error(msg))
        }
      } catch {
        reject(new Error(`Ошибка сервера (HTTP ${xhr.status})`))
      }
    }
    xhr.onerror = () => reject(new Error('Не удалось загрузить файл'))
    xhr.onabort = () => reject(new DOMException('aborted', 'AbortError'))

    const form = new FormData()
    form.append('file', file)
    xhr.send(form)
  })
}

// SSE-стрим статуса + прогресса; при любом сбое — fallback на поллинг.
async function watchAnalysis(
  analysisId: number,
  signal: AbortSignal,
  onUpdate: (status: AnalysisStatus, progress?: number) => void
): Promise<void> {
  try {
    const token = getAccessToken()
    const res = await fetch(`${API_BASE}/api/v1/analysis/${analysisId}/events`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      signal,
    })
    if (!res.ok || !res.body) throw new Error(`SSE HTTP ${res.status}`)
    const reader = res.body.getReader()
    const dec = new TextDecoder()
    let buf = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buf += dec.decode(value, { stream: true })
      const lines = buf.split('\n')
      buf = lines.pop() ?? ''
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        try {
          const evt = JSON.parse(line.slice(6)) as SseEvent
          onUpdate(evt.status, evt.progress)
          if (evt.status === 'done' || evt.status === 'failed') return
        } catch {
          /* skip */
        }
      }
    }
  } catch {
    if (signal.aborted) return
  }

  // Fallback-поллинг: ~6 минут по 4 секунды (без точного прогресса — бар подползает)
  for (let i = 0; i < 90 && !signal.aborted; i++) {
    await new Promise((r) => setTimeout(r, 4000))
    if (signal.aborted) return
    try {
      const a = await apiRequest<{ status: AnalysisStatus }>(`/api/v1/analysis/${analysisId}`)
      onUpdate(a.status)
      if (a.status === 'done' || a.status === 'failed') return
    } catch {
      /* временный сбой — продолжаем поллинг */
    }
  }
  if (!signal.aborted) throw new Error('Превышено время ожидания распознавания')
}

export default function UploadPage() {
  const router = useRouter()
  const { user, isLoading: authLoading } = useAuth()
  const inputRef = useRef<HTMLInputElement>(null)

  const [files, setFiles] = useState<PendingFile[]>([])
  const [rows, setRows] = useState<UploadRow[]>([])
  const [dragging, setDragging] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  // Целевой прогресс на строку — куда бар должен доехать (задаётся загрузкой/SSE)
  const targetsRef = useRef<Map<string, number>>(new Map())

  useEffect(() => {
    if (!authLoading && !user && !getAccessToken()) router.replace('/auth')
  }, [authLoading, user, router])

  // Обрываем SSE/поллинг при уходе со страницы
  useEffect(() => () => abortRef.current?.abort(), [])

  // Анимация прогресс-баров: плавно тянем displayed → target и мягко «подползаем»
  // к потолку фазы, чтобы бар всегда двигался и ощущался динамическим.
  useEffect(() => {
    if (!submitting) return
    const iv = setInterval(() => {
      setRows((prev) => {
        let changed = false
        const next = prev.map((r) => {
          if (r.status === 'done') {
            if (r.progress >= 100) return r
            changed = true
            return { ...r, progress: 100 }
          }
          if (r.status === 'error' || r.status === 'failed') return r
          const cap = ceilFor(r.status)
          const target = Math.min(Math.max(targetsRef.current.get(r.id) ?? 0, r.progress), cap)
          const ease = (target - r.progress) * 0.14
          const crawl = r.progress < cap - 0.5 ? 0.35 : 0
          const advanced = Math.min(cap, r.progress + Math.max(ease, crawl))
          if (advanced - r.progress < 0.05) return r
          changed = true
          return { ...r, progress: advanced }
        })
        return changed ? next : prev
      })
    }, 90)
    return () => clearInterval(iv)
  }, [submitting])

  const addFiles = useCallback(
    (incoming: FileList | File[]) => {
      const arr = Array.from(incoming)
      const room = Math.max(0, MAX_FILES - files.length)
      setNotice(arr.length > room ? `Можно загрузить не более ${MAX_FILES} файлов за раз` : null)
      setFiles((prev) => [
        ...prev,
        ...arr.slice(0, room).map((file) => ({ file, id: uid(), error: validateFile(file) ?? undefined })),
      ])
    },
    [files.length]
  )

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragging(false)
      if (e.dataTransfer.files.length > 0) addFiles(e.dataTransfer.files)
    },
    [addFiles]
  )

  const removeFile = useCallback((id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id))
  }, [])

  const updateRow = useCallback((id: string, patch: Partial<UploadRow>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  }, [])

  const setTarget = useCallback((id: string, value: number) => {
    const cur = targetsRef.current.get(id) ?? 0
    targetsRef.current.set(id, Math.max(cur, value))
  }, [])

  const handleSubmit = useCallback(async () => {
    if (!getAccessToken()) {
      router.replace('/auth')
      return
    }
    const valid = files.filter((f) => !f.error)
    if (valid.length === 0) return
    setSubmitting(true)
    setNotice(null)
    targetsRef.current.clear()
    setRows(
      valid.map((f) => ({
        id: f.id,
        fileName: f.file.name,
        analysisId: null,
        status: 'uploading' as const,
        progress: 0,
      }))
    )
    setFiles([])
    const abort = new AbortController()
    abortRef.current = abort
    await Promise.all(
      valid.map(async (f) => {
        try {
          const result = await uploadWithProgress(f.file, (frac) => {
            // Байтовая загрузка → 0..35% общей шкалы
            targetsRef.current.set(f.id, Math.min(UPLOAD_CEIL, frac * UPLOAD_CEIL))
          })
          setTarget(f.id, UPLOAD_CEIL)
          updateRow(f.id, {
            analysisId: result.analysisId,
            status: (result.status as AnalysisStatus) ?? 'pending',
          })
          await watchAnalysis(result.analysisId, abort.signal, (s, p) => {
            updateRow(f.id, { status: s })
            if (typeof p === 'number') {
              // Прогресс воркера 0..100 → 35..97% общей шкалы (done ставит 100)
              const overall = s === 'done' ? 100 : UPLOAD_CEIL + (Math.min(100, Math.max(0, p)) / 100) * 62
              setTarget(f.id, overall)
            }
          })
        } catch (err) {
          if (err instanceof DOMException && err.name === 'AbortError') return
          updateRow(f.id, {
            status: 'error',
            message: err instanceof Error ? err.message : 'Не удалось загрузить файл',
          })
        }
      })
    )
    // Пересчитываем профиль после распознавания — сохраняем снимок в историю
    try {
      await apiRequest('/api/v1/profile/recalculate', { method: 'POST' })
    } catch {
      /* профиль пересчитается при следующем открытии рекомендаций */
    }
    setSubmitting(false)
  }, [files, router, updateRow, setTarget])

  const validCount = files.filter((f) => !f.error).length
  const allDone = rows.length > 0 && rows.every((r) => !inFlight(r.status))
  const anyDone = rows.some((r) => r.status === 'done')

  return (
    <main style={{ position: 'relative', minHeight: '100vh' }}>
      <AppBackground glow="14%" />
      <div style={{ position: 'relative', zIndex: 1 }}>
        <AppNav onBack={() => router.push('/dashboard')} backLabel="В кабинет" />
        <div style={{ maxWidth: '40rem', margin: '0 auto', padding: 'clamp(2rem,5vw,3.5rem) clamp(1.25rem,5vw,2rem) 6rem' }}>
          <p className="eyebrow" style={{ marginBottom: 14 }}>Загрузка анализов</p>
          <h1 className="font-display" style={{ fontWeight: 500, fontSize: 'clamp(2.2rem,5vw,3.4rem)', color: '#fff', lineHeight: 1.05, margin: '0 0 0.75rem' }}>
            Анализы
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 15, margin: '0 0 2.25rem', maxWidth: '30rem', lineHeight: 1.5 }}>
            Загрузите фото или PDF результатов. Алгоритм распознает показатели автоматически и сверит их с нутрициологическими нормами.
          </p>

          {rows.length === 0 && (
            <>
              <div
                className="dropzone"
                role="button"
                tabIndex={0}
                onClick={() => inputRef.current?.click()}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click() }}
                onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                style={{ borderRadius: 18, padding: 'clamp(2.5rem,6vw,3.5rem) 1.5rem', textAlign: 'center', cursor: 'pointer', border: `2px dashed ${dragging ? 'var(--gold)' : 'rgba(255,255,255,0.2)'}`, background: dragging ? 'rgba(255,230,146,0.06)' : 'rgba(255,255,255,0.03)', transition: 'all .2s' }}
              >
                <input ref={inputRef} type="file" multiple accept="application/pdf,image/jpeg,image/png" style={{ display: 'none' }} onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = '' }} />
                <span style={{ display: 'inline-grid', placeItems: 'center', width: 60, height: 60, borderRadius: 16, background: 'rgba(255,230,146,0.1)', marginBottom: 16 }}>
                  <Icon name="upload" size={30} />
                </span>
                <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: 16, margin: '0 0 6px' }}>Перетащите файлы сюда</p>
                <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 14, margin: 0 }}>или нажмите, чтобы выбрать · PDF, JPEG, PNG · до {MAX_SIZE_MB} МБ</p>
              </div>
              {notice && <p style={{ color: '#ffd27d', fontSize: 14, margin: '12px 0 0' }}>{notice}</p>}

              {files.length > 0 && (
                <div className="fade-up">
                  <ul style={{ listStyle: 'none', margin: '20px 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {files.map((f) => (
                      <li key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '0.85rem 1rem', borderRadius: 12, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
                        <span style={{ display: 'grid', placeItems: 'center', width: 38, height: 38, borderRadius: 9, background: 'rgba(255,230,146,0.1)', flexShrink: 0 }}>
                          <Icon name="lab" size={20} />
                        </span>
                        <span style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ display: 'block', color: '#fff', fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.file.name}</span>
                          <span style={{ display: 'block', fontSize: 12, color: f.error ? '#ff9a9a' : 'rgba(255,255,255,0.4)' }}>{f.error ?? formatSize(f.file.size)}</span>
                        </span>
                        <button onClick={() => removeFile(f.id)} style={{ flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: 13, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.55)', minHeight: 44, minWidth: 44, padding: '0 8px' }}>
                          Убрать
                        </button>
                      </li>
                    ))}
                  </ul>
                  <Button variant="gold" disabled={submitting || validCount === 0} onClick={() => void handleSubmit()} style={{ width: '100%', marginTop: 22 }}>
                    {submitting ? 'Загрузка…' : `Распознать анализы${validCount > 1 ? ` (${validCount})` : ''}`}
                  </Button>
                </div>
              )}
            </>
          )}

          {rows.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
                {rows.map((r) => (
                  <li key={r.id} style={{ padding: '1rem 1.15rem', borderRadius: 12, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ display: 'grid', placeItems: 'center', width: 34, height: 34, borderRadius: 8, background: 'rgba(255,230,146,0.1)', flexShrink: 0 }}>
                        <Icon name="lab" size={18} />
                      </span>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: 'block', color: '#fff', fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.fileName}</span>
                        {r.message && <span style={{ display: 'block', fontSize: 12, color: '#ff9a9a' }}>{r.message}</span>}
                      </span>
                      {inFlight(r.status) ? (
                        <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, width: 128, flexShrink: 0 }}>
                          <span style={{ display: 'flex', justifyContent: 'space-between', width: '100%', fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>
                            <span>{phaseLabel(r.status)}</span>
                            <span style={{ color: 'var(--gold)', fontVariantNumeric: 'tabular-nums' }}>{Math.round(r.progress)}%</span>
                          </span>
                          <span style={{ width: '100%', height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
                            <span style={{ display: 'block', height: '100%', width: `${r.progress}%`, borderRadius: 3, background: 'var(--gold)', transition: 'width .18s linear' }} />
                          </span>
                        </span>
                      ) : (
                        <StatusBadge status={r.status === 'error' ? 'failed' : r.status} />
                      )}
                    </div>
                  </li>
                ))}
              </ul>

              {submitting && (
                <div className="fade-up" style={{ marginTop: 20 }}>
                  <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13.5, lineHeight: 1.6, margin: '0 0 12px' }}>
                    Можно не ждать здесь — обработка продолжится сама. Прогресс и готовность видны в кабинете, а когда анализ обработается, придёт уведомление.
                  </p>
                  <Button variant="outline-gold" onClick={() => router.push('/dashboard')}>
                    Вернуться в кабинет
                  </Button>
                </div>
              )}

              {allDone && !submitting && (
                <div className="fade-up" style={{ marginTop: 24 }}>
                  {!anyDone && (
                    <p style={{ color: '#ff9a9a', fontSize: 14, margin: '0 0 14px', lineHeight: 1.5 }}>
                      Ни один файл не удалось распознать. Попробуйте загрузить более чёткое фото или PDF из лаборатории.
                    </p>
                  )}
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    {anyDone && (
                      <Button variant="gold" onClick={() => router.push('/recommendations')}>
                        Смотреть рекомендации
                      </Button>
                    )}
                    {!anyDone && (
                      <Button variant="gold" onClick={() => { setRows([]); setNotice(null) }}>
                        Попробовать ещё раз
                      </Button>
                    )}
                    <Button variant="outline-gold" onClick={() => router.push('/dashboard')}>
                      В кабинет
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
