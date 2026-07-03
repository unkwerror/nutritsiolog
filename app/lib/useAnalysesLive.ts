'use client'

// Живой статус анализов: подписка на SSE `/analysis/:id/events` для всех
// анализов «в работе» (pending/processing). Даёт процент выполнения (0–100) и
// зовёт onComplete при завершении — чтобы список авто-обновился без перезагрузки.

import { useEffect, useRef, useState } from 'react'
import { apiRequest, getAccessToken, API_BASE } from './api'

export type LiveStatus = 'pending' | 'processing' | 'done' | 'failed'
export type LiveState = { status: LiveStatus; progress: number }

type MinimalAnalysis = { id: number; status: LiveStatus }

function isInFlight(s: LiveStatus): boolean {
  return s === 'pending' || s === 'processing'
}

// Один SSE-стрим по анализу; при обрыве — поллинг GET /analysis/:id.
async function streamAnalysis(
  id: number,
  signal: AbortSignal,
  onUpdate: (status: LiveStatus, progress?: number) => void
): Promise<void> {
  try {
    const token = getAccessToken()
    const res = await fetch(`${API_BASE}/api/v1/analysis/${id}/events`, {
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
          const evt = JSON.parse(line.slice(6)) as { status: LiveStatus; progress?: number }
          onUpdate(evt.status, evt.progress)
          if (evt.status === 'done' || evt.status === 'failed') return
        } catch {
          /* ignore malformed line */
        }
      }
    }
  } catch {
    if (signal.aborted) return
  }

  // Fallback-поллинг (~6 минут по 4 с), если стрим недоступен
  for (let i = 0; i < 90 && !signal.aborted; i++) {
    await new Promise((r) => setTimeout(r, 4000))
    if (signal.aborted) return
    try {
      const a = await apiRequest<{ status: LiveStatus }>(`/api/v1/analysis/${id}`)
      onUpdate(a.status)
      if (a.status === 'done' || a.status === 'failed') return
    } catch {
      /* временный сбой — продолжаем */
    }
  }
}

/**
 * Подписывается на анализы «в работе» и возвращает карту id → {status, progress}.
 * onComplete(id, status) вызывается один раз при завершении каждого анализа —
 * там родитель перезагружает список (авторефреш) и показывает уведомление.
 */
export function useAnalysesLive(
  analyses: MinimalAnalysis[],
  onComplete: (id: number, status: 'done' | 'failed') => void
): Record<number, LiveState> {
  const [live, setLive] = useState<Record<number, LiveState>>({})
  const controllers = useRef<Map<number, AbortController>>(new Map())
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete

  // Стабильный ключ множества «в работе» — чтобы не перезапускать эффект без нужды
  const inflightKey = analyses
    .filter((a) => isInFlight(a.status))
    .map((a) => a.id)
    .sort((x, y) => x - y)
    .join(',')

  useEffect(() => {
    const inflightIds = analyses.filter((a) => isInFlight(a.status)).map((a) => a.id)
    const inflight = new Set(inflightIds)

    // Стартуем новые подписки
    inflightIds.forEach((id) => {
      if (controllers.current.has(id)) return
      const ac = new AbortController()
      controllers.current.set(id, ac)
      setLive((p) => ({ ...p, [id]: { status: p[id]?.status ?? 'pending', progress: p[id]?.progress ?? 0 } }))
      void streamAnalysis(id, ac.signal, (status, progress) => {
        setLive((p) => {
          const prev = p[id]?.progress ?? 0
          const nextProgress =
            status === 'done'
              ? 100
              : typeof progress === 'number'
                ? Math.max(prev, Math.min(100, progress))
                : prev
          return { ...p, [id]: { status, progress: nextProgress } }
        })
        if (status === 'done' || status === 'failed') {
          controllers.current.get(id)?.abort()
          controllers.current.delete(id)
          onCompleteRef.current(id, status)
        }
      })
    })

    // Останавливаем подписки, которых больше нет среди «в работе»
    controllers.current.forEach((ac, id) => {
      if (!inflight.has(id)) {
        ac.abort()
        controllers.current.delete(id)
      }
    })
    // inflightKey отражает набор id «в работе»; analyses читаем внутри
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inflightKey])

  useEffect(() => {
    const active = controllers.current
    return () => {
      active.forEach((ac) => ac.abort())
      active.clear()
    }
  }, [])

  return live
}
