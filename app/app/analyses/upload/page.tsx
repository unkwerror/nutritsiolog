'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { apiRequest, getAccessToken, API_BASE } from '@/lib/api'
import { Navbar } from '@/components/Navbar'

const ALLOWED_MIME = ['application/pdf', 'image/jpeg', 'image/png']
const MAX_FILES = 5
const MAX_SIZE_MB = 10

type UploadedFile = { file: File; id: string; error?: string }
type AnalysisStatus = 'pending' | 'processing' | 'done' | 'failed'

type Analysis = {
  id: number
  status: AnalysisStatus
}

type SseEvent = { status: AnalysisStatus; analysisId: number }

function validateFile(file: File): string | null {
  if (!ALLOWED_MIME.includes(file.type)) return 'Поддерживаются PDF, JPEG, PNG'
  if (file.size > MAX_SIZE_MB * 1024 * 1024) return `Файл больше ${MAX_SIZE_MB} МБ`
  return null
}

function uid() {
  return Math.random().toString(36).slice(2)
}

// SSE via fetch (requires Authorization header)
async function watchStatus(analysisId: number, token: string, onStatus: (s: AnalysisStatus) => void): Promise<void> {
  const res = await fetch(`${API_BASE}/api/v1/analyses/${analysisId}/status`, {
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
      } catch { /* ignore parse errors */ }
    }
  }
}

const STATUSES: Record<AnalysisStatus, { label: string; color: string }> = {
  pending:    { label: 'В очереди…',      color: 'text-white/55' },
  processing: { label: 'Распознаём…',     color: 'text-[#ffe692]' },
  done:       { label: 'Готово',          color: 'text-green-300' },
  failed:     { label: 'Ошибка распознавания', color: 'text-red-300' },
}

export default function UploadPage() {
  const router = useRouter()
  const [files, setFiles] = useState<UploadedFile[]>([])
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [results, setResults] = useState<{ id: number; status: AnalysisStatus; name: string }[]>([])
  const [globalError, setGlobalError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dragCounter = useRef(0)

  // Guard: redirect if not logged in
  useEffect(() => {
    if (!getAccessToken()) router.replace('/auth')
  }, [router])

  const addFiles = useCallback((incoming: FileList | File[]) => {
    const arr = Array.from(incoming)
    setFiles((prev) => {
      const combined = [...prev]
      for (const f of arr) {
        if (combined.length >= MAX_FILES) break
        combined.push({ file: f, id: uid(), error: validateFile(f) ?? undefined })
      }
      return combined
    })
  }, [])

  const onDragEnter = (e: React.DragEvent) => {
    e.preventDefault(); dragCounter.current++; setDragging(true)
  }
  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault(); dragCounter.current--
    if (dragCounter.current === 0) setDragging(false)
  }
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); dragCounter.current = 0; setDragging(false)
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files)
  }

  const removeFile = (id: string) => setFiles((prev) => prev.filter((f) => f.id !== id))

  async function handleUpload() {
    const valid = files.filter((f) => !f.error)
    if (!valid.length) return
    setUploading(true); setGlobalError(null); setResults([])
    const token = getAccessToken()

    try {
      for (const { file } of valid) {
        const form = new FormData()
        form.append('file', file)

        const analysis = await apiRequest<Analysis>('/api/v1/analyses', {
          method: 'POST',
          body: form,
        })

        const entry = { id: analysis.id, status: analysis.status as AnalysisStatus, name: file.name }
        setResults((prev) => [...prev, entry])

        // Start SSE watcher for this analysis
        if (token) {
          void watchStatus(analysis.id, token, (status) => {
            setResults((prev) => prev.map((r) => r.id === analysis.id ? { ...r, status } : r))
          })
        }
      }
    } catch (err) {
      setGlobalError(err instanceof Error ? err.message : 'Ошибка загрузки')
    } finally {
      setUploading(false)
    }
  }

  const hasValid = files.some((f) => !f.error)
  const allDone = results.length > 0 && results.every((r) => r.status === 'done' || r.status === 'failed')

  return (
    <main
      className="min-h-screen relative overflow-hidden"
      style={{ background: 'linear-gradient(to bottom, #35472e 0%, #4a6040 60%, #acbe9b 100%)' }}
    >
      {/* Background hint */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden>
        <img src="/assets/auth-bg.png" alt="" className="w-full h-full object-cover opacity-25" />
      </div>

      <div className="relative z-10 flex flex-col min-h-screen">
        <Navbar transparent />

        <div className="flex-1 flex flex-col items-center justify-center px-4 sm:px-8 py-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="w-full max-w-xl"
          >
            <h1 className="text-white font-light text-3xl sm:text-4xl mb-2">Загрузить анализы</h1>
            <p className="text-white/55 text-sm mb-8">
              PDF, JPEG или PNG · до {MAX_SIZE_MB} МБ · до {MAX_FILES} файлов за раз
            </p>

            {/* Results */}
            <AnimatePresence>
              {results.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="glass-modal rounded-2xl p-5 mb-6 flex flex-col gap-3"
                >
                  <p className="text-white/70 text-sm font-medium">Статус распознавания</p>
                  {results.map((r) => (
                    <div key={r.id} className="flex items-center justify-between gap-3">
                      <span className="text-white/80 text-sm truncate">{r.name}</span>
                      <span className={`text-sm shrink-0 ${STATUSES[r.status]?.color ?? 'text-white/55'}`}>
                        {STATUSES[r.status]?.label ?? r.status}
                        {r.status === 'processing' && (
                          <span className="inline-block ml-1 animate-pulse">·</span>
                        )}
                      </span>
                    </div>
                  ))}
                  {allDone && (
                    <button
                      onClick={() => router.push('/dashboard')}
                      className="btn-gold mt-2 text-sm"
                    >
                      Перейти к профилю
                    </button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Dropzone */}
            <div
              className={`relative border-2 border-dashed rounded-2xl p-8 sm:p-12 text-center transition-all duration-200 cursor-pointer mb-5 ${
                dragging
                  ? 'border-[#ffe692] bg-[rgba(255,230,146,0.06)]'
                  : 'border-white/20 hover:border-white/35 glass-modal'
              }`}
              onDragEnter={onDragEnter}
              onDragOver={(e) => e.preventDefault()}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
              role="button"
              aria-label="Область загрузки файлов"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.jpg,.jpeg,.png"
                className="sr-only"
                onChange={(e) => e.target.files && addFiles(e.target.files)}
              />

              <motion.div
                animate={dragging ? { scale: 1.04 } : { scale: 1 }}
                transition={{ duration: 0.15 }}
                className="flex flex-col items-center gap-3"
              >
                <div className="w-14 h-14 rounded-2xl glass-step flex items-center justify-center text-[#ffe692] text-2xl">
                  ↑
                </div>
                <div>
                  <p className="text-white/80 text-base font-medium">
                    {dragging ? 'Отпустите файлы' : 'Перетащите или нажмите для выбора'}
                  </p>
                  <p className="text-white/40 text-xs mt-1">PDF, JPEG, PNG</p>
                </div>
              </motion.div>
            </div>

            {/* File list */}
            <AnimatePresence>
              {files.map(({ file, id, error }) => (
                <motion.div
                  key={id}
                  initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                  animate={{ opacity: 1, height: 'auto', marginBottom: 8 }}
                  exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                  transition={{ duration: 0.2 }}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl ${error ? 'bg-red-500/15 border border-red-400/20' : 'glass-step'}`}
                >
                  <span className="text-white/80 text-xs font-mono w-8 shrink-0 text-center">
                    {file.name.split('.').pop()?.toUpperCase()}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-white/85 text-sm truncate">{file.name}</p>
                    {error ? (
                      <p className="text-red-300 text-xs">{error}</p>
                    ) : (
                      <p className="text-white/35 text-xs">{(file.size / 1024 / 1024).toFixed(1)} МБ</p>
                    )}
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); removeFile(id) }}
                    className="text-white/35 hover:text-white/70 transition-colors text-lg leading-none w-6 h-6 flex items-center justify-center shrink-0"
                    aria-label="Удалить файл"
                  >
                    ×
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>

            {/* Global error */}
            {globalError && (
              <p className="text-red-300/90 text-sm bg-red-500/10 rounded-lg px-3 py-2 mb-4">{globalError}</p>
            )}

            {/* Upload button */}
            <button
              onClick={() => void handleUpload()}
              disabled={!hasValid || uploading}
              className="btn-gold w-full mt-2"
            >
              {uploading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Загружаем…
                </span>
              ) : (
                `Загрузить и распознать${files.filter((f) => !f.error).length > 1 ? ` (${files.filter((f) => !f.error).length})` : ''}`
              )}
            </button>
          </motion.div>
        </div>
      </div>
    </main>
  )
}
