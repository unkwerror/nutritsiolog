'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiRequest, getAccessToken, API_BASE } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { AppBackground, AppNav, Icon } from '@/components/ds/AppCommon'
import { Button, Spinner, StatusBadge } from '@/components/ds/primitives'

const ALLOWED_MIME = ['application/pdf', 'image/jpeg', 'image/png']
const MAX_FILES = 5
const MAX_SIZE_MB = 10

type AnalysisStatus = 'pending' | 'processing' | 'done' | 'failed'
type PendingFile = { file: File; id: string; error?: string }
type UploadRow = {
  id: string
  fileName: string
  analysisId: number | null
  status: AnalysisStatus | 'uploading' | 'error'
  message?: string
}
type UploadResponse = { analysisId: number; status: string }
type SseEvent = { status: AnalysisStatus; analysisId: number }

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
function inFlight(s: UploadRow['status']): boolean {
  return s === 'uploading' || s === 'pending' || s === 'processing'
}

// SSE-стрим статуса; при любом сбое (401 на протухшем токене, обрыв прокси,
// стрим закрылся без терминального события) — fallback на поллинг GET /analysis/:id.
// Раньше сбой стрима оставлял строку крутиться вечно без ошибки.
async function watchAnalysis(analysisId: number, signal: AbortSignal, onStatus: (s: AnalysisStatus) => void): Promise<void> {
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
          onStatus(evt.status)
          if (evt.status === 'done' || evt.status === 'failed') return
        } catch {
          /* skip */
        }
      }
    }
  } catch {
    if (signal.aborted) return
  }

  // Fallback-поллинг: ~6 минут по 4 секунды
  for (let i = 0; i < 90 && !signal.aborted; i++) {
    await new Promise((r) => setTimeout(r, 4000))
    if (signal.aborted) return
    try {
      const a = await apiRequest<{ status: AnalysisStatus }>(`/api/v1/analysis/${analysisId}`)
      onStatus(a.status)
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

  useEffect(() => {
    if (!authLoading && !user && !getAccessToken()) router.replace('/auth')
  }, [authLoading, user, router])

  // Обрываем SSE/поллинг при уходе со страницы — иначе до 5 открытых стримов
  // продолжают дёргать setState на размонтированном компоненте
  useEffect(() => () => abortRef.current?.abort(), [])

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

  const handleSubmit = useCallback(async () => {
    if (!getAccessToken()) {
      router.replace('/auth')
      return
    }
    const valid = files.filter((f) => !f.error)
    if (valid.length === 0) return
    setSubmitting(true)
    setNotice(null)
    setRows(valid.map((f) => ({ id: f.id, fileName: f.file.name, analysisId: null, status: 'uploading' as const })))
    setFiles([])
    const abort = new AbortController()
    abortRef.current = abort
    await Promise.all(
      valid.map(async (f) => {
        try {
          const form = new FormData()
          form.append('file', f.file)
          const result = await apiRequest<UploadResponse>('/api/v1/analysis/upload', { method: 'POST', body: form })
          updateRow(f.id, { analysisId: result.analysisId, status: (result.status as AnalysisStatus) ?? 'pending' })
          await watchAnalysis(result.analysisId, abort.signal, (s) => updateRow(f.id, { status: s }))
        } catch (err) {
          updateRow(f.id, { status: 'error', message: err instanceof Error ? err.message : 'Не удалось загрузить файл' })
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
  }, [files, router, updateRow])

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
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                          <Spinner size={12} />
                          <span style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.5)' }}>{r.status === 'uploading' ? 'Загрузка…' : 'Распознавание…'}</span>
                        </span>
                      ) : (
                        <StatusBadge status={r.status === 'error' ? 'failed' : r.status} />
                      )}
                    </div>
                  </li>
                ))}
              </ul>

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
