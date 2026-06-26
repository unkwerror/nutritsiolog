'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence, type Variants } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { apiRequest, setAccessToken } from '@/lib/api'

type ApiResp<T> = T & { error?: { message?: string; code?: string } }
type Step = 'email' | 'otp' | 'register'

const STEP_ORDER: Step[] = ['email', 'otp', 'register']

const slide: Variants = {
  initial: { opacity: 0, x: 24 },
  animate: { opacity: 1, x: 0, transition: { duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] } },
  exit: { opacity: 0, x: -24, transition: { duration: 0.2 } },
}

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
    setIsLoading(true); setError(null)
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
    if (isNewUser) { setStep('register'); return }
    setIsLoading(true); setError(null)
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
    setIsLoading(true); setError(null)
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

  const currentIndex = STEP_ORDER.indexOf(step)

  return (
    <main
      className="min-h-screen flex items-center justify-center px-4 py-10"
      style={{ background: 'linear-gradient(160deg, #2a3824 0%, #35462f 50%, #3d5435 100%)' }}
    >
      <div className="w-full sm:max-w-[440px]">
        {/* Logo */}
        <div className="mb-6 text-center">
          <Link href="/" className="font-sans italic text-white/75 text-lg tracking-wide hover:text-white transition-colors">
            Нутрициолог
          </Link>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            variants={slide}
            initial="initial"
            animate="animate"
            exit="exit"
            className="glass-modal p-10 sm:p-12"
            style={{ borderRadius: 20 }}
          >
            {/* Step bar */}
            <div className="flex gap-2 mb-9">
              {STEP_ORDER.map((s, i) => (
                <div
                  key={s}
                  className="h-0.5 flex-1 rounded-full transition-colors duration-300"
                  style={{
                    background: currentIndex >= i ? 'rgba(255,230,146,0.8)' : 'rgba(255,255,255,0.14)',
                  }}
                />
              ))}
            </div>

            {step === 'email' && (
              <form onSubmit={(e) => void handleRequestOtp(e)} className="flex flex-col gap-6">
                <div>
                  <h1 className="font-display font-light text-white text-4xl mb-2 leading-tight">Войти</h1>
                  <p className="text-white/55 text-sm">Введите email — пришлём одноразовый код</p>
                </div>
                <Field label="Email">
                  <input
                    type="email" autoComplete="email" required
                    placeholder="you@example.com"
                    value={email} onChange={(e) => setEmail(e.target.value)}
                    className="glass-input w-full px-4 py-3.5 text-base rounded-[10px]"
                  />
                </Field>
                {error && <ErrorMsg>{error}</ErrorMsg>}
                <button
                  type="submit"
                  disabled={isLoading || !email.trim()}
                  className="btn-gold w-full text-base"
                >
                  {isLoading ? 'Отправляем…' : 'Получить код'}
                </button>
                <p className="text-center text-white/40 text-xs">
                  Нет аккаунта? Он создастся автоматически
                </p>
              </form>
            )}

            {step === 'otp' && (
              <form onSubmit={(e) => void handleVerifyOtp(e)} className="flex flex-col gap-6">
                <div>
                  <h1 className="font-display font-light text-white text-4xl mb-2 leading-tight">
                    {isNewUser ? 'Подтверждение' : 'Введите код'}
                  </h1>
                  <p className="text-white/55 text-sm">
                    Мы отправили код на{' '}
                    <span className="text-white">{email}</span>
                  </p>
                </div>
                <Field label="Код из письма">
                  <input
                    type="text" inputMode="numeric" autoComplete="one-time-code"
                    placeholder="000000" maxLength={6} required
                    value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                    className="glass-input w-full px-4 py-3.5 text-2xl tracking-[0.3em] text-center rounded-[10px]"
                  />
                </Field>
                {error && <ErrorMsg>{error}</ErrorMsg>}
                <button
                  type="submit"
                  disabled={isLoading || code.length < 4}
                  className="btn-gold w-full text-base"
                >
                  {isLoading ? 'Проверяем…' : isNewUser ? 'Продолжить' : 'Войти'}
                </button>
                <button
                  type="button"
                  onClick={() => { setStep('email'); setError(null) }}
                  className="text-white/45 text-sm hover:text-white/80 transition-colors"
                >
                  ← Изменить email
                </button>
              </form>
            )}

            {step === 'register' && (
              <form onSubmit={(e) => void handleRegister(e)} className="flex flex-col gap-5">
                <div>
                  <h1 className="font-display font-light text-white text-4xl mb-2 leading-tight">Регистрация</h1>
                  <p className="text-white/40 text-xs">{email}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Имя *">
                    <input
                      type="text" autoComplete="given-name" required placeholder="Иван"
                      value={firstName} onChange={(e) => setFirstName(e.target.value)}
                      className="glass-input w-full px-4 py-3 text-base rounded-[10px]"
                    />
                  </Field>
                  <Field label="Фамилия">
                    <input
                      type="text" autoComplete="family-name" placeholder="Иванов"
                      value={lastName} onChange={(e) => setLastName(e.target.value)}
                      className="glass-input w-full px-4 py-3 text-base rounded-[10px]"
                    />
                  </Field>
                </div>
                <div className="flex flex-col gap-3 mt-1">
                  <ConsentBox checked={consentPd} onChange={setConsentPd}>
                    Согласен(на) на обработку персональных данных{' '}
                    <span style={{ color: '#ff9a9a' }}>*</span>
                  </ConsentBox>
                  <ConsentBox checked={consentMedical} onChange={setConsentMedical}>
                    Согласен(на) на обработку медицинских данных{' '}
                    <span style={{ color: '#ff9a9a' }}>*</span>
                  </ConsentBox>
                </div>
                {error && <ErrorMsg>{error}</ErrorMsg>}
                <button
                  type="submit"
                  disabled={isLoading || !firstName.trim() || !consentPd || !consentMedical}
                  className="btn-gold w-full text-base"
                >
                  {isLoading ? 'Создаём профиль…' : 'Создать профиль'}
                </button>
                <button
                  type="button"
                  onClick={() => { setStep('otp'); setError(null) }}
                  className="text-white/45 text-sm hover:text-white/80 transition-colors"
                >
                  ← Назад
                </button>
              </form>
            )}

            <div className="mt-8 pt-6 border-t border-white/8 text-center">
              <Link href="/" className="text-white/35 text-xs hover:text-white/65 transition-colors">
                ← На главную
              </Link>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </main>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-white/70 text-sm font-medium">{label}</label>
      {children}
    </div>
  )
}

function ErrorMsg({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="text-sm px-3 py-2.5 rounded-[10px]"
      style={{ background: 'rgba(255,80,80,0.12)', color: '#ff9a9a', border: '1px solid rgba(255,80,80,0.18)' }}
    >
      {children}
    </p>
  )
}

function ConsentBox({
  checked, onChange, children,
}: {
  checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode
}) {
  return (
    <label className="flex items-start gap-2.5 cursor-pointer group">
      <input
        type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 w-4 h-4 shrink-0 rounded"
        style={{ accentColor: '#ffe692' }}
      />
      <span className="text-white/50 text-xs leading-relaxed group-hover:text-white/75 transition-colors">
        {children}
      </span>
    </label>
  )
}
