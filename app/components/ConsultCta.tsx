'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { apiRequest, ApiRequestError } from '@/lib/api'
import { Button, EASE_OUT } from '@/components/ds/primitives'
import { Icon } from '@/components/ds/AppCommon'

type SendState = 'idle' | 'sending' | 'sent'

// CTA «Записаться на индивидуальную консультацию»: создаёт лид,
// нутрициолог видит его в админке и получает письмо.
export default function ConsultCta({ style = {} }: { style?: React.CSSProperties }) {
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [state, setState] = useState<SendState>('idle')
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    if (state === 'sending') return
    setState('sending')
    setError(null)
    try {
      await apiRequest('/api/v1/lead/consultation', {
        method: 'POST',
        body: JSON.stringify(message.trim() ? { message: message.trim() } : {}),
      })
      setState('sent')
    } catch (err) {
      setState('idle')
      if (err instanceof ApiRequestError && err.code === 'LEAD_RATE_LIMITED') {
        // Лимит = заявка уже есть — для клиента это успех, не ошибка
        setState('sent')
      } else {
        setError(err instanceof Error ? err.message : 'Не удалось отправить заявку')
      }
    }
  }

  return (
    <div
      style={{
        borderRadius: 18,
        padding: '1.35rem 1.35rem 1.45rem',
        background: 'linear-gradient(115deg, rgba(255,230,146,0.09), rgba(255,255,255,0.03) 55%)',
        border: '1px solid rgba(255,230,146,0.22)',
        ...style,
      }}
    >
      <AnimatePresence mode="wait" initial={false}>
        {state === 'sent' ? (
          <motion.div
            key="sent"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: EASE_OUT }}
            style={{ display: 'flex', alignItems: 'center', gap: 14 }}
          >
            <span style={{ display: 'grid', placeItems: 'center', width: 40, height: 40, borderRadius: 12, background: 'rgba(255,230,146,0.14)', color: 'var(--gold)', fontSize: 19, flexShrink: 0 }}>
              ✓
            </span>
            <div>
              <p style={{ color: '#fff', fontSize: 14.5, fontWeight: 500, margin: 0 }}>Заявка отправлена</p>
              <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, margin: '3px 0 0', lineHeight: 1.45 }}>
                Нутрициолог свяжется с вами в ближайшее время.
              </p>
            </div>
          </motion.div>
        ) : (
          <motion.div key="form" initial={false}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
              <span style={{ display: 'grid', placeItems: 'center', width: 40, height: 40, borderRadius: 12, background: 'rgba(255,230,146,0.12)', flexShrink: 0 }}>
                <Icon name="heart" size={21} />
              </span>
              <div style={{ minWidth: 0 }}>
                <p className="font-display" style={{ color: '#fff', fontSize: 16.5, margin: 0 }}>
                  Индивидуальная консультация
                </p>
                <p style={{ color: 'rgba(255,255,255,0.62)', fontSize: 13.5, margin: '4px 0 0', lineHeight: 1.5 }}>
                  Разбор ваших анализов и персональный план — лично с нутрициологом.
                </p>
              </div>
            </div>

            <AnimatePresence initial={false}>
              {open && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: EASE_OUT }}
                  style={{ overflow: 'hidden' }}
                >
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value.slice(0, 1000))}
                    placeholder="Что хотите обсудить? (необязательно)"
                    rows={3}
                    style={{
                      width: '100%',
                      marginTop: 14,
                      padding: '10px 12px',
                      borderRadius: 12,
                      border: '1px solid rgba(255,255,255,0.14)',
                      background: 'rgba(0,0,0,0.18)',
                      color: '#fff',
                      fontFamily: 'var(--font-sans)',
                      fontSize: 14,
                      lineHeight: 1.5,
                      resize: 'vertical',
                      outline: 'none',
                    }}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {error && (
              <p style={{ color: '#ff9a8a', fontSize: 13, margin: '10px 0 0' }}>{error}</p>
            )}

            <div style={{ marginTop: 16 }}>
              <Button variant="gold" size="sm" onClick={open ? submit : () => setOpen(true)} disabled={state === 'sending'}>
                {state === 'sending' ? 'Отправляем…' : open ? 'Отправить заявку' : 'Записаться на консультацию'}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
