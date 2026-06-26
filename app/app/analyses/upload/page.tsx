'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence, type Variants } from 'framer-motion'
import { apiRequest, getAccessToken, API_BASE } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { Navbar } from '@/components/Navbar'

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

const ease: [number, number, number, number] = [0.25, 0.46, 0.45, 0.94]

const fade: Variants = {
  initial: { opacity: 0, y: 32 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.7, ease } },
}

const STATUS_LABEL: Record<UploadRow['status'], string> = {
  uploading: 'Загрузка…',
  pending: 'В очереди',
  processing: 'Распознавание…',
  done: 'Готово',
  failed: 'Ошибка распознавания',
  error: 'Ошибка',
}

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

async function watchAnalysis(
  analysisId: number,
  token: string,
  onStatus: (s: AnalysisStatus) => void,
): Promise<void> {
  const res = await fetch(`${API_BASE}/api/v1/analysis/${analysisId}/events`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.body) return
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
      } catch { /* skip */ }
    }
  }
}

export default function UploadPage() {
  const router = useRouter()
  const { user, isLoading: authLoading } = useAuth()
  const inputRef = useRef<HTMLInputElement>(null)

  const [files, setFiles] = useState<PendingFile[]>([])
  const [rows, setRows] = useState<UploadRow[]>([])
  const [dragging, setDragging] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!authLoading && !user && !getAccessToken()) router.replace('/auth')
  }, [authLoading, user, router])

  const addFiles = useCallback((incoming: FileList | File[]) => {
    setFiles((prev) => {
      const next = [...prev]
      for (const file of Array.from(incoming)) {
        if (next.length >= MAX_FILES) break
        next.push({ file, id: uid(), error: validateFile(file) ?? undefined })
      }
      return next
    })
  }, [])

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragging(false)
      if (e.dataTransfer.files.length > 0) addFiles(e.dataTransfer.files)
    },
    [addFiles],
  )

  const removeFile = useCallback((id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id))
  }, [])

  const updateRow = useCallback((id: string, patch: Partial<UploadRow>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  }, [])

  const handleSubmit = useCallback(async () => {
    const token = getAccessToken()
    if (!token) { router.replace('/auth'); return }
    const valid = files.filter((f) => !f.error)
    if (valid.length === 0) return
    setSubmitting(true)
    const initialRows: UploadRow[] = valid.map((f) => ({
      id: f.id, fileName: f.file.name, analysisId: null, status: 'uploading',
    }))
    setRows(initialRows)
    setFiles([])
    await Promise.all(
      valid.map(async (f) => {
        try {
          const form = new FormData()
          form.append('file', f.file)
          const result = await apiRequest<UploadResponse>('/api/v1/analysis/upload', {
            method: 'POST', body: form,
          })
          updateRow(f.id, { analysisId: result.analysisId, status: (result.status as AnalysisStatus) ?? 'pending' })
          await watchAnalysis(result.analysisId, token, (s) => updateRow(f.id, { status: s }))
        } catch (err) {
          updateRow(f.id, {
            status: 'error',
            message: err instanceof Error ? err.message : 'Не удалось загрузить файл',
          })
        }
      }),
    )
    setSubmitting(false)
  }, [files, router, updateRow])

  const validCount = files.filter((f) => !f.error).length

  return (
    <main
      className="min-h-screen"
      style={{ background: 'linear-gradient(160deg, #35462f 0%, #4a6040 60%, #3d5435 100%)' }}
    >
      <Navbar transparent={false} variant="dark" />

      <div className="mx-auto max-w-xl px-6 sm:px-10 pt-32 pb-28">
        <motion.div variants={fade} initial="initial" animate="animate">
          <p className="font-sans text-[11px] tracking-[0.28em] uppercase text-white/40 mb-5">
            Загрузка
          </p>
          <h1
            className="font-display font-light leading-[1.04] text-white mb-3"
            style={{ fontSize: 'clamp(2.4rem, 5vw, 4.5rem)' }}
          >
            Анализы
          </h1>
          <p className="font-sans text-[15px] text-white/55 mb-10 max-w-md">
            Загрузите фото или PDF результатов лабораторных исследований.
            Мы распознаем показатели автоматически.
          </p>

          {/* Dropzone */}
          <div
            className={`rounded-[16px] border-2 border-dashed px-6 py-12 text-center transition-all cursor-pointer ${
              dragging ? 'dropzone-active' : ''
            }`}
            style={{
              borderColor: dragging ? '#ffe692' : 'rgba(255,255,255,0.2)',
              background: dragging ? 'rgba(255,230,146,0.04)' : 'rgba(255,255,255,0.03)',
            }}
            onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click() }}
          >
            <input
              ref={inputRef}
              type="file"
              multiple
              accept="application/pdf,image/jpeg,image/png"
              className="hidden"
              onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = '' }}
            />
            <p className="font-sans text-[15px] text-white/80">Перетащите файлы сюда</p>
            <p className="font-sans text-[13px] text-white/40 mt-1.5">
              или нажмите, чтобы выбрать · PDF, JPEG, PNG · до {MAX_SIZE_MB} МБ
            </p>
          </div>

          {/* Pending files */}
          <AnimatePresence>
            {files.length > 0 && (
              <motion.ul
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-5 space-y-2 overflow-hidden"
              >
                {files.map((f) => (
                  <li
                    key={f.id}
                    className="flex items-center justify-between gap-3 px-4 py-3 rounded-[10px]"
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                  >
                    <div className="min-w-0">
                      <p className="font-sans text-[14px] text-white truncate">{f.file.name}</p>
                      <p
                        className="font-sans text-[12px] mt-0.5"
                        style={{ color: f.error ? '#ff9a9a' : 'rgba(255,255,255,0.4)' }}
                      >
                        {f.error ?? formatSize(f.file.size)}
                      </p>
                    </div>
                    <button
                      onClick={() => removeFile(f.id)}
                      className="shrink-0 font-sans text-[12px] tracking-[0.06em] uppercase text-white/35 hover:text-white/70 transition-colors"
                      aria-label="Удалить файл"
                    >
                      Убрать
                    </button>
                  </li>
                ))}
              </motion.ul>
            )}
          </AnimatePresence>

          {/* Submit */}
          {files.length > 0 && (
            <button
              onClick={() => void handleSubmit()}
              disabled={submitting || validCount === 0}
              className="btn-gold w-full mt-6 text-[15px]"
            >
              {submitting
                ? 'Загрузка…'
                : `Распознать анализы${validCount > 1 ? ` (${validCount})` : ''}`}
            </button>
          )}

          {/* Processing rows */}
          <AnimatePresence>
            {rows.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-12"
              >
                <p className="font-sans text-[11px] tracking-[0.28em] uppercase text-white/40 mb-4">
                  Обработка
                </p>
                <ul className="border-t border-white/10">
                  {rows.map((r) => (
                    <li
                      key={r.id}
                      className="flex items-center justify-between gap-3 border-b border-white/10 py-4"
                    >
                      <div className="min-w-0">
                        <p className="font-sans text-[14px] text-white truncate">{r.fileName}</p>
                        {r.message && (
                          <p className="font-sans text-[12px] text-[#ff9a9a] mt-0.5">{r.message}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {(r.status === 'uploading' || r.status === 'processing' || r.status === 'pending') && (
                          <span
                            className="inline-block h-3 w-3 rounded-full border-2 animate-spin"
                            style={{ borderColor: 'rgba(255,230,146,0.25)', borderTopColor: '#ffe692' }}
                            aria-hidden
                          />
                        )}
                        {(r.status === 'done' || r.status === 'failed' || r.status === 'error') && (
                          <span
                            className="inline-block h-1.5 w-1.5 rounded-full"
                            style={{
                              background: r.status === 'done' ? 'rgba(255,230,146,0.8)' : '#ff9a9a',
                            }}
                          />
                        )}
                        <span
                          className="font-sans text-[13px]"
                          style={{ color: r.status === 'done' ? 'rgba(255,230,146,0.8)' : r.status === 'failed' || r.status === 'error' ? '#ff9a9a' : 'rgba(255,255,255,0.45)' }}
                        >
                          {STATUS_LABEL[r.status]}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>

                {rows.every((r) => r.status === 'done' || r.status === 'failed' || r.status === 'error') &&
                  !submitting && (
                    <div className="mt-8 flex flex-wrap items-center gap-4">
                      <Link href="/dashboard" className="btn-gold text-sm">
                        В личный кабинет
                      </Link>
                      <Link href="/recommendations" className="btn-outline-gold text-sm">
                        Рекомендации
                      </Link>
                    </div>
                  )}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </main>
  )
}
