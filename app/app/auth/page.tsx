'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { apiRequest, setAccessToken } from '@/lib/api'

type ApiResp<T> = T & { error?: { message?: string; code?: string } }
type Step = 'email' | 'otp' | 'register'

const slide = {
  initial: { opacity: 0, x: 24 },
  animate: { opacity: 1, x: 0, transition: { duration: 0.3, ease: 'easeOut' } },
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

  // Redirect if already logged in
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

  const stepTitle: Record<Step, string> = {
    email: isNewUser ? '' : 'Войти',
    otp: isNewUser ? 'Подтверждение' : 'Введите код',
    register: 'Регистрация',
  }

  return (
    <main
      className="min-h-screen flex items-center justify-center relative overflow-hidden"
      style={{ background: 'linear-gradient(to bottom, #35472e 21%, #aabc99 100%)' }}
    >
      {/* Vines background */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden>
        <img src="/assets/auth-bg.png" alt="" className="w-full h-full object-cover opacity-50" />
      </div>

      {/* Card */}
      <div className="relative z-10 w-full mx-4 sm:mx-auto sm:max-w-[440px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            variants={slide}
            initial="initial"
            animate="animate"
            exit="exit"
            className="glass-modal rounded-3xl p-8 sm:p-10"
          >
            {/* Step indicator */}
            <div className="flex gap-2 mb-7">
              {(['email', 'otp', 'register'] as Step[]).map((s, i) => (
                <div
                  key={s}
                  className="h-1 flex-1 rounded-full transition-all duration-300"
                  style={{ background: (['email', 'otp', 'register'].indexOf(step) >= i) ? '#ffe692' : 'rgba(255,255,255,0.18)' }}
                />
              ))}
            </div>

            {step === 'email' && (
              <form onSubmit={(e) => void handleRequestOtp(e)} className="flex flex-col gap-6">
                <div>
                  <h1 className="text-white font-semibold text-3xl sm:text-4xl mb-2">Войти</h1>
                  <p className="text-white/55 text-sm">Введите email — пришлём одноразовый код</p>
                </div>
                <Field label="Email">
                  <input
                    type="email" autoComplete="email" required
                    placeholder="you@example.com"
                    value={email} onChange={(e) => setEmail(e.target.value)}
                    className="glass-input w-full rounded-xl px-4 py-3.5 text-white text-base"
                  />
                </Field>
                {error && <ErrorMsg>{error}</ErrorMsg>}
                <button type="submit" disabled={isLoading || !email.trim()} className="btn-gold w-full text-base font-semibold">
                  {isLoading ? 'Отправляем…' : 'Получить код'}
                </button>
                <p className="text-center text-white/35 text-xs">
                  Нет аккаунта? Он создастся автоматически
                </p>
              </form>
            )}

            {step === 'otp' && (
              <form onSubmit={(e) => void handleVerifyOtp(e)} className="flex flex-col gap-6">
                <div>
                  <h1 className="text-white font-semibold text-3xl sm:text-4xl mb-2">
                    {stepTitle.otp}
                  </h1>
                  <p className="text-white/55 text-sm">
                    Мы отправили код на <span className="text-white/80">{email}</span>
                  </p>
                </div>
                <Field label="Код из письма">
                  <input
                    type="text" inputMode="numeric" autoComplete="one-time-code"
                    placeholder="000000" maxLength={6} required
                    value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                    className="glass-input w-full rounded-xl px-4 py-3.5 text-white text-2xl tracking-[0.35em] text-center"
                  />
                </Field>
                {error && <ErrorMsg>{error}</ErrorMsg>}
                <button type="submit" disabled={isLoading || code.length < 4} className="btn-gold w-full text-base font-semibold">
                  {isLoading ? 'Проверяем…' : isNewUser ? 'Продолжить' : 'Войти'}
                </button>
                <button type="button" onClick={() => { setStep('email'); setError(null) }}
                  className="text-white/40 text-sm hover:text-white/70 transition-colors">
                  ← Изменить email
                </button>
              </form>
            )}

            {step === 'register' && (
              <form onSubmit={(e) => void handleRegister(e)} className="flex flex-col gap-5">
                <div>
                  <h1 className="text-white font-semibold text-3xl sm:text-4xl mb-2">Регистрация</h1>
                  <p className="text-white/45 text-xs">{email}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Имя *">
                    <input type="text" autoComplete="given-name" required placeholder="Иван"
                      value={firstName} onChange={(e) => setFirstName(e.target.value)}
                      className="glass-input w-full rounded-xl px-4 py-3 text-white text-base" />
                  </Field>
                  <Field label="Фамилия">
                    <input type="text" autoComplete="family-name" placeholder="Иванов"
                      value={lastName} onChange={(e) => setLastName(e.target.value)}
                      className="glass-input w-full rounded-xl px-4 py-3 text-white text-base" />
                  </Field>
                </div>
                <div className="flex flex-col gap-3">
                  <ConsentBox checked={consentPd} onChange={setConsentPd}>
                    Согласен(на) на обработку персональных данных <span className="text-red-300">*</span>
                  </ConsentBox>
                  <ConsentBox checked={consentMedical} onChange={setConsentMedical}>
                    Согласен(на) на обработку медицинских данных для формирования профиля <span className="text-red-300">*</span>
                  </ConsentBox>
                </div>
                {error && <ErrorMsg>{error}</ErrorMsg>}
                <button
                  type="submit"
                  disabled={isLoading || !firstName.trim() || !consentPd || !consentMedical}
                  className="btn-gold w-full text-base font-semibold"
                >
                  {isLoading ? 'Создаём профиль…' : 'Создать профиль'}
                </button>
                <button type="button" onClick={() => { setStep('otp'); setError(null) }}
                  className="text-white/40 text-sm hover:text-white/70 transition-colors">
                  ← Назад
                </button>
              </form>
            )}

            <div className="mt-8 pt-6 border-t border-white/10 text-center">
              <Link href="/" className="text-white/35 text-xs hover:text-white/60 transition-colors">
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
      <label className="text-white/70 text-sm">{label}</label>
      {children}
    </div>
  )
}

function ErrorMsg({ children }: { children: React.ReactNode }) {
  return <p className="text-red-300/90 text-sm bg-red-500/10 rounded-lg px-3 py-2">{children}</p>
}

function ConsentBox({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <label className="flex items-start gap-2.5 cursor-pointer group">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 w-4 h-4 shrink-0 rounded accent-[#ffe692]" />
      <span className="text-white/60 text-xs leading-relaxed group-hover:text-white/80 transition-colors">{children}</span>
    </label>
  )
}
