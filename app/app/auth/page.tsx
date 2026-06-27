'use client'

import { useState, useEffect, type ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { apiRequest, setAccessToken } from '@/lib/api'
import { AppBackground } from '@/components/ds/AppCommon'
import { GlassCard, Button, Input, Field, ProgressSteps } from '@/components/ds/primitives'

type ApiResp<T> = T & { error?: { message?: string; code?: string } }
type Step = 'email' | 'otp' | 'register'
const STEP_INDEX: Record<Step, number> = { email: 0, otp: 1, register: 2 }
const BRAND = '/assets/brand/'

export default function AuthPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('email')
  const [isNewUser, setIsNewUser] = useState(false)
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [consentPd, setConsentPd] = useState(false)
  const [consentMedical, setConsentMedical] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const token = typeof window !== 'undefined' ? sessionStorage.getItem('accessToken') : null
    if (token) router.replace('/dashboard')
  }, [router])

  async function handleRequestOtp(e: React.FormEvent) {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    try {
      const data = await apiRequest<ApiResp<{ isNewUser: boolean }>>('/api/v1/auth/request-otp', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      })
      setIsNewUser(data.isNewUser)
      setStep('otp')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Что-то пошло не так')
    } finally {
      setIsLoading(false)
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault()
    if (isNewUser) {
      setStep('register')
      return
    }
    setIsLoading(true)
    setError(null)
    try {
      const data = await apiRequest<ApiResp<{ accessToken: string }>>('/api/v1/auth/verify-otp', {
        method: 'POST',
        body: JSON.stringify({ email, code: code.trim() }),
      })
      setAccessToken(data.accessToken)
      router.push('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Неверный код')
    } finally {
      setIsLoading(false)
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    try {
      const data = await apiRequest<ApiResp<{ accessToken: string }>>('/api/v1/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          email,
          code: code.trim(),
          firstName: firstName.trim(),
          lastName: lastName.trim() || undefined,
          consentPd,
          consentMedicalData: consentMedical,
        }),
      })
      setAccessToken(data.accessToken)
      router.push('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка регистрации')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main style={{ position: 'relative', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2.5rem 1.25rem' }}>
      <AppBackground glow="42%" />
      <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 440 }}>
        <div style={{ textAlign: 'center', marginBottom: 26 }}>
          <img src={`${BRAND}monogram.svg`} alt="" width={64} style={{ marginBottom: 14 }} />
          <p className="font-display" style={{ fontStyle: 'italic', fontWeight: 500, fontSize: 22, color: '#fff', margin: 0 }}>
            Нутрициолог
          </p>
        </div>

        <GlassCard variant="modal" style={{ padding: 'clamp(1.75rem, 5vw, 3rem)', borderRadius: 24 }}>
          <ProgressSteps total={3} current={STEP_INDEX[step]} style={{ marginBottom: 34 }} />

          <div key={step} className="step-fade">
            {step === 'email' && (
              <form onSubmit={(e) => void handleRequestOtp(e)} style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
                <Head title="Войти или создать профиль" sub="Введите email — пришлём одноразовый код" />
                <Field label="Email">
                  <Input type="email" autoComplete="email" required placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
                </Field>
                {error && <ErrorMsg>{error}</ErrorMsg>}
                <Button type="submit" variant="gold" disabled={isLoading || !email.includes('@')} style={{ width: '100%' }}>
                  {isLoading ? 'Отправляем…' : 'Получить код'}
                </Button>
                <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: 12, margin: 0 }}>Аккаунт создаётся автоматически при первом входе</p>
              </form>
            )}

            {step === 'otp' && (
              <form onSubmit={(e) => void handleVerifyOtp(e)} style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
                <Head
                  title={isNewUser ? 'Подтверждение' : 'Введите код'}
                  sub={
                    <>
                      Код отправлен на <span style={{ color: '#fff' }}>{email}</span>
                    </>
                  }
                />
                <Field label="Код из письма">
                  <Input
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="000000"
                    maxLength={6}
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                    style={{ fontSize: 26, letterSpacing: '0.35em', textAlign: 'center', fontFamily: 'var(--font-display)' }}
                  />
                </Field>
                {error && <ErrorMsg>{error}</ErrorMsg>}
                <Button type="submit" variant="gold" disabled={isLoading || code.length < 4} style={{ width: '100%' }}>
                  {isLoading ? 'Проверяем…' : isNewUser ? 'Продолжить' : 'Войти'}
                </Button>
                <button type="button" onClick={() => { setStep('email'); setError(null) }} className="link-btn">
                  ← Изменить email
                </button>
              </form>
            )}

            {step === 'register' && (
              <form onSubmit={(e) => void handleRegister(e)} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                <Head title="Знакомство" sub={email} />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <Field label="Имя *">
                    <Input autoComplete="given-name" required placeholder="Иван" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                  </Field>
                  <Field label="Фамилия">
                    <Input autoComplete="family-name" placeholder="Иванов" value={lastName} onChange={(e) => setLastName(e.target.value)} />
                  </Field>
                </div>
                <Consent checked={consentPd} onChange={setConsentPd}>
                  Согласие на обработку персональных данных <i style={{ color: '#ff9a9a', fontStyle: 'normal' }}>*</i>
                </Consent>
                <Consent checked={consentMedical} onChange={setConsentMedical}>
                  Согласие на обработку медицинских данных <i style={{ color: '#ff9a9a', fontStyle: 'normal' }}>*</i>
                </Consent>
                {error && <ErrorMsg>{error}</ErrorMsg>}
                <Button type="submit" variant="gold" disabled={isLoading || !firstName.trim() || !consentPd || !consentMedical} style={{ width: '100%' }}>
                  {isLoading ? 'Создаём профиль…' : 'Создать профиль'}
                </Button>
                <button type="button" onClick={() => { setStep('otp'); setError(null) }} className="link-btn">
                  ← Назад
                </button>
              </form>
            )}
          </div>
        </GlassCard>

        <p style={{ textAlign: 'center', marginTop: 22 }}>
          <Link href="/" style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, fontFamily: 'var(--font-sans)' }}>
            ← На главную
          </Link>
        </p>
      </div>
    </main>
  )
}

function Head({ title, sub }: { title: string; sub: ReactNode }) {
  return (
    <div>
      <h1 className="font-display" style={{ fontWeight: 500, fontSize: 'clamp(1.9rem,4vw,2.4rem)', color: '#fff', margin: '0 0 8px', lineHeight: 1.08 }}>
        {title}
      </h1>
      <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 14, margin: 0, lineHeight: 1.5 }}>{sub}</p>
    </div>
  )
}

function ErrorMsg({ children }: { children: ReactNode }) {
  return (
    <p style={{ fontSize: 14, padding: '10px 12px', borderRadius: 10, margin: 0, background: 'rgba(255,80,80,0.12)', color: '#ff9a9a', border: '1px solid rgba(255,80,80,0.18)' }}>
      {children}
    </p>
  )
}

function Consent({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  return (
    <label style={{ display: 'flex', alignItems: 'flex-start', gap: 11, cursor: 'pointer' }}>
      <span
        onClick={() => onChange(!checked)}
        style={{ marginTop: 1, width: 18, height: 18, borderRadius: 6, flexShrink: 0, display: 'grid', placeItems: 'center', transition: 'all .15s', border: `1.5px solid ${checked ? 'var(--gold)' : 'rgba(255,255,255,0.3)'}`, background: checked ? 'var(--gold)' : 'transparent' }}
      >
        {checked && (
          <svg width="11" height="11" viewBox="0 0 12 12">
            <path d="M2.5 6.2 5 8.5l4.5-5" stroke="#35462f" strokeWidth="1.9" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
      <span style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12.5, lineHeight: 1.55 }}>{children}</span>
    </label>
  )
}
