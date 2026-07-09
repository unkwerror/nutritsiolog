'use client'

import { useState, useEffect, type ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { apiRequest, setAccessToken, ApiRequestError } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { AppBackground } from '@/components/ds/AppCommon'
import { GlassCard, Button, Input, Field, ProgressSteps } from '@/components/ds/primitives'
import { formatPhoneInput, isPhoneComplete } from '@/lib/format'

type ApiResp<T> = T & { error?: { message?: string; code?: string } }
type Me = { id: string; email: string | null; firstName: string | null; lastName: string | null }
type Step = 'contact' | 'otp' | 'register'
type Channel = 'phone' | 'email'
const STEP_INDEX: Record<Step, number> = { contact: 0, otp: 1, register: 2 }
const BRAND = '/assets/brand/'

export default function AuthPage() {
  const router = useRouter()
  const { user, isLoading: authLoading, setUserAfterLogin } = useAuth()
  const [step, setStep] = useState<Step>('contact')
  // Телефон — основной канал; email оставлен для существующих аккаунтов
  const [channel, setChannel] = useState<Channel>('phone')
  const [isNewUser, setIsNewUser] = useState(false)
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  // Второй контакт на шаге регистрации (телефон при email-канале и наоборот)
  const [regEmail, setRegEmail] = useState('')
  const [regPhone, setRegPhone] = useState('')
  const [consentPd, setConsentPd] = useState(false)
  const [consentMedical, setConsentMedical] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Редирект по подтверждённой сессии из контекста, а не по «сырому» токену
  // в sessionStorage: просроченный токен раньше давал цикл /auth → /dashboard → /auth
  useEffect(() => {
    if (!authLoading && user) router.replace('/dashboard')
  }, [authLoading, user, router])

  // Идентификатор текущего канала для тела запроса
  function identity(): { channel: Channel; email?: string; phone?: string } {
    return channel === 'phone'
      ? { channel, phone: phone.trim() }
      : { channel, email: email.trim().toLowerCase() }
  }

  const contactLabel = channel === 'phone' ? phone : email

  // После входа кладём юзера в AuthProvider — иначе до полной перезагрузки
  // страницы шапка показывает «Профиль» вместо имени
  async function completeLogin(token: string) {
    setAccessToken(token)
    const me = await apiRequest<Me>('/api/v1/users/me')
    setUserAfterLogin(me, token)
    router.push('/dashboard')
  }

  function switchChannel(next: Channel) {
    setChannel(next)
    setError(null)
  }

  async function handleRequestOtp(e: React.FormEvent) {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    try {
      const data = await apiRequest<ApiResp<{ isNewUser: boolean }>>('/api/v1/auth/request-otp', {
        method: 'POST',
        body: JSON.stringify(identity()),
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
    setIsLoading(true)
    setError(null)
    try {
      // Код проверяется и для новых пользователей: бэкенд отвечает
      // USER_NEEDS_REGISTRATION на валидный код (не сжигая его). Раньше опечатка
      // в коде обнаруживалась только после заполнения всей анкеты регистрации.
      const data = await apiRequest<ApiResp<{ accessToken: string }>>('/api/v1/auth/verify-otp', {
        method: 'POST',
        body: JSON.stringify({ ...identity(), code: code.trim() }),
      })
      await completeLogin(data.accessToken)
    } catch (err) {
      if (err instanceof ApiRequestError && err.code === 'USER_NEEDS_REGISTRATION') {
        setStep('register')
      } else {
        setError(err instanceof Error ? err.message : 'Неверный код')
      }
    } finally {
      setIsLoading(false)
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    try {
      const secondary =
        channel === 'phone'
          ? regEmail.trim()
            ? { email: regEmail.trim().toLowerCase() }
            : {}
          : { phone: regPhone.trim() }
      const data = await apiRequest<ApiResp<{ accessToken: string }>>('/api/v1/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          ...identity(),
          ...secondary,
          code: code.trim(),
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          consentPd,
          consentMedicalData: consentMedical,
        }),
      })
      await completeLogin(data.accessToken)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка регистрации')
    } finally {
      setIsLoading(false)
    }
  }

  const contactValid = channel === 'phone' ? isPhoneComplete(phone) : email.includes('@')
  const registerValid =
    !isLoading &&
    firstName.trim() !== '' &&
    lastName.trim() !== '' &&
    consentPd &&
    consentMedical &&
    (channel === 'phone' || isPhoneComplete(regPhone))

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

          <div key={`${step}-${channel}`} className="step-fade">
            {step === 'contact' && (
              <form onSubmit={(e) => void handleRequestOtp(e)} style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
                <Head
                  title="Войти или создать профиль"
                  sub={channel === 'phone' ? 'Введите номер телефона — пришлём код в SMS' : 'Введите email — пришлём одноразовый код'}
                />
                {channel === 'phone' ? (
                  <Field label="Телефон">
                    <Input
                      type="tel"
                      autoComplete="tel"
                      inputMode="tel"
                      required
                      placeholder="+7 (900) 000-00-00"
                      value={phone}
                      onChange={(e) => setPhone(formatPhoneInput(e.target.value))}
                    />
                  </Field>
                ) : (
                  <Field label="Email">
                    <Input type="email" autoComplete="email" required placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
                  </Field>
                )}
                {error && <ErrorMsg>{error}</ErrorMsg>}
                <Button type="submit" variant="gold" disabled={isLoading || !contactValid} style={{ width: '100%' }}>
                  {isLoading ? 'Отправляем…' : 'Получить код'}
                </Button>
                <button type="button" onClick={() => switchChannel(channel === 'phone' ? 'email' : 'phone')} className="link-btn">
                  {channel === 'phone' ? 'Войти по email' : '← Войти по номеру телефона'}
                </button>
                <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: 12, margin: 0 }}>Аккаунт создаётся автоматически при первом входе</p>
              </form>
            )}

            {step === 'otp' && (
              <form onSubmit={(e) => void handleVerifyOtp(e)} style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
                <Head
                  title={isNewUser ? 'Подтверждение' : 'Введите код'}
                  sub={
                    <>
                      Код отправлен на <span style={{ color: '#fff' }}>{contactLabel}</span>
                    </>
                  }
                />
                <Field label={channel === 'phone' ? 'Код из SMS' : 'Код из письма'}>
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
                <button type="button" onClick={() => { setStep('contact'); setError(null) }} className="link-btn">
                  {channel === 'phone' ? '← Изменить номер' : '← Изменить email'}
                </button>
              </form>
            )}

            {step === 'register' && (
              <form onSubmit={(e) => void handleRegister(e)} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                <Head title="Знакомство" sub={contactLabel} />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <Field label="Имя *">
                    <Input autoComplete="given-name" required placeholder="Иван" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                  </Field>
                  <Field label="Фамилия *">
                    <Input autoComplete="family-name" required placeholder="Иванов" value={lastName} onChange={(e) => setLastName(e.target.value)} />
                  </Field>
                </div>
                {channel === 'phone' ? (
                  <Field label="Email" hint="Необязательно — для связи и уведомлений">
                    <Input type="email" autoComplete="email" placeholder="you@example.com" value={regEmail} onChange={(e) => setRegEmail(e.target.value)} />
                  </Field>
                ) : (
                  <Field label="Телефон *">
                    <Input
                      type="tel"
                      autoComplete="tel"
                      inputMode="tel"
                      required
                      placeholder="+7 (900) 000-00-00"
                      value={regPhone}
                      onChange={(e) => setRegPhone(formatPhoneInput(e.target.value))}
                    />
                  </Field>
                )}
                <Consent checked={consentPd} onChange={setConsentPd}>
                  Согласие на обработку персональных данных <i style={{ color: '#ff9a9a', fontStyle: 'normal' }}>*</i>
                </Consent>
                <Consent checked={consentMedical} onChange={setConsentMedical}>
                  Согласие на обработку медицинских данных <i style={{ color: '#ff9a9a', fontStyle: 'normal' }}>*</i>
                </Consent>
                {error && <ErrorMsg>{error}</ErrorMsg>}
                <Button type="submit" variant="gold" disabled={!registerValid} style={{ width: '100%' }}>
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

// Настоящий <input> внутри <label>: тап по тексту тоже переключает согласие,
// работает с клавиатуры; строка целиком ≥44px — досягаемо для ЦА 45+
function Consent({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', minHeight: 44, padding: '4px 0' }}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ position: 'absolute', opacity: 0, width: 1, height: 1 }}
      />
      <span
        aria-hidden
        style={{ width: 22, height: 22, borderRadius: 7, flexShrink: 0, display: 'grid', placeItems: 'center', transition: 'all .15s', border: `1.5px solid ${checked ? 'var(--gold)' : 'rgba(255,255,255,0.3)'}`, background: checked ? 'var(--gold)' : 'transparent' }}
      >
        {checked && (
          <svg width="13" height="13" viewBox="0 0 12 12">
            <path d="M2.5 6.2 5 8.5l4.5-5" stroke="#35462f" strokeWidth="1.9" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
      <span style={{ color: 'rgba(255,255,255,0.75)', fontSize: 14, lineHeight: 1.55 }}>{children}</span>
    </label>
  )
}
