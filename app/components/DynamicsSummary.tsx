'use client'

import { useEffect, useState, type CSSProperties } from 'react'
import Link from 'next/link'
import { apiRequest, getAccessToken } from '@/lib/api'
import { Icon } from '@/components/ds/AppCommon'

type Summary = {
  improved: number
  worsened: number
  stable: number
  currentDate: string
  previousDate: string
}

function fmtDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
}

// Сводка прогресса на дашборде: «N маркеров улучшились с прошлого замера».
// Скрыта, пока нет двух замеров хотя бы одного маркера — внешний отступ
// поэтому передаётся через style, а не ставится обёрткой (иначе пустой зазор).
export default function DynamicsSummary({ style }: { style?: CSSProperties }) {
  const [summary, setSummary] = useState<Summary | null>(null)

  useEffect(() => {
    if (!getAccessToken()) return
    apiRequest<{ summary: Summary | null }>('/api/v1/profile/dynamics')
      .then((d) => setSummary(d.summary))
      .catch(() => {})
  }, [])

  if (!summary) return null

  const rows: Array<{ n: number; label: string; color: string; sign: string }> = [
    { n: summary.improved, label: 'улучшилось', color: '#a8e0a0', sign: '↗' },
    { n: summary.worsened, label: 'требует внимания', color: '#ff9a8a', sign: '↘' },
    { n: summary.stable, label: 'без изменений', color: 'rgba(255,255,255,0.55)', sign: '→' },
  ]

  return (
    <Link
      href="/dynamics"
      style={{
        display: 'block',
        textDecoration: 'none',
        borderRadius: 18,
        padding: '1.25rem 1.35rem',
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.09)',
        ...style,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <Icon name="activity" size={20} />
          <p className="font-display" style={{ color: '#fff', fontSize: 16.5, margin: 0 }}>Ваша динамика</p>
        </div>
        <span style={{ color: 'var(--gold)', fontSize: 13, whiteSpace: 'nowrap' }}>Подробнее →</span>
      </div>
      <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
        {rows
          .filter((r) => r.n > 0)
          .map((r) => (
            <span key={r.label} style={{ display: 'inline-flex', alignItems: 'baseline', gap: 7 }}>
              <span className="font-display" style={{ color: r.color, fontSize: 22, lineHeight: 1 }}>
                {r.sign} {r.n}
              </span>
              <span style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12.5 }}>{r.label}</span>
            </span>
          ))}
      </div>
      <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, margin: '10px 0 0' }}>
        {fmtDate(summary.previousDate)} → {fmtDate(summary.currentDate)}
      </p>
    </Link>
  )
}
