'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence, type Variants } from 'framer-motion'
import { getAccessToken } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { Navbar } from '@/components/Navbar'

const ease: [number, number, number, number] = [0.25, 0.46, 0.45, 0.94]

const stepVariants: Variants = {
  initial: { opacity: 0, x: 28 },
  animate: { opacity: 1, x: 0, transition: { duration: 0.45, ease } },
  exit: { opacity: 0, x: -28, transition: { duration: 0.25, ease } },
}

const fieldStagger: Variants = {
  initial: {},
  animate: { transition: { staggerChildren: 0.07 } },
}

const field: Variants = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.45, ease } },
}

type Form = {
  age: string
  gender: string
  height: string
  weight: string
  activity: string
  sleep: string
  stress: string
  redMeat: string
  alcohol: string
  supplements: string[]
  goal: string
}

const EMPTY_FORM: Form = {
  age: '',
  gender: '',
  height: '',
  weight: '',
  activity: '',
  sleep: '',
  stress: '',
  redMeat: '',
  alcohol: '',
  supplements: [],
  goal: '',
}

const STEP_TITLES = ['О вас', 'Образ жизни', 'Питание']

const ACTIVITY_OPTS = [
  'Низкий — сидячая работа',
  'Умеренный — 1-2 раза в неделю',
  'Высокий — 3+ раз в неделю',
]
const SLEEP_OPTS = ['Хороший — 7-9 ч', 'Удовлетворительный — 5-7 ч', 'Плохой — менее 5 ч']
const STRESS_OPTS = ['Низкий', 'Умеренный', 'Высокий']
const RED_MEAT_OPTS = ['Редко', '1-2 раза в неделю', 'Каждый день']
const ALCOHOL_OPTS = ['Нет', 'Редко', 'Умеренно', 'Часто']
const SUPPLEMENT_OPTS = ['Витамин D', 'Омега-3', 'Магний', 'Не принимаю']

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="block font-sans text-[14px] text-[#181818] mb-3">{children}</span>
  )
}

function RadioGroup({
  name,
  options,
  value,
  onChange,
}: {
  name: string
  options: string[]
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="grid gap-2.5">
      {options.map((opt) => {
        const active = value === opt
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className="flex items-center gap-3 rounded-[10px] border px-4 py-3 text-left transition-colors"
            style={{
              borderColor: active ? 'rgba(24,24,24,0.55)' : 'rgba(24,24,24,0.15)',
              background: active ? 'rgba(24,24,24,0.03)' : '#ffffff',
            }}
            aria-pressed={active}
            aria-label={`${name}: ${opt}`}
          >
            <span
              className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border"
              style={{ borderColor: active ? '#4a7c59' : 'rgba(24,24,24,0.3)' }}
            >
              {active && <span className="h-2 w-2 rounded-full" style={{ background: '#4a7c59' }} />}
            </span>
            <span className="font-sans text-[15px] text-[#181818]">{opt}</span>
          </button>
        )
      })}
    </div>
  )
}

function CheckboxGroup({
  options,
  values,
  onToggle,
}: {
  options: string[]
  values: string[]
  onToggle: (v: string) => void
}) {
  return (
    <div className="grid gap-2.5">
      {options.map((opt) => {
        const active = values.includes(opt)
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onToggle(opt)}
            className="flex items-center gap-3 rounded-[10px] border px-4 py-3 text-left transition-colors"
            style={{
              borderColor: active ? 'rgba(24,24,24,0.55)' : 'rgba(24,24,24,0.15)',
              background: active ? 'rgba(24,24,24,0.03)' : '#ffffff',
            }}
            aria-pressed={active}
          >
            <span
              className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-[5px] border"
              style={{
                borderColor: active ? '#4a7c59' : 'rgba(24,24,24,0.3)',
                background: active ? '#4a7c59' : 'transparent',
              }}
            >
              {active && (
                <svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden>
                  <path
                    d="M2.5 6.2 5 8.5l4.5-5"
                    stroke="#ffffff"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </span>
            <span className="font-sans text-[15px] text-[#181818]">{opt}</span>
          </button>
        )
      })}
    </div>
  )
}

export default function QuestionnairePage() {
  const router = useRouter()
  const { user, isLoading: authLoading } = useAuth()

  const [step, setStep] = useState(0)
  const [form, setForm] = useState<Form>(EMPTY_FORM)
  const [submitted, setSubmitted] = useState(false)

  // Auth guard
  useEffect(() => {
    if (!authLoading && !user && !getAccessToken()) router.replace('/auth')
  }, [authLoading, user, router])

  function set<K extends keyof Form>(key: K, value: Form[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function toggleSupplement(opt: string) {
    setForm((prev) => {
      // "Не принимаю" is exclusive
      if (opt === 'Не принимаю') return { ...prev, supplements: prev.supplements.includes(opt) ? [] : [opt] }
      const without = prev.supplements.filter((s) => s !== 'Не принимаю')
      const next = without.includes(opt) ? without.filter((s) => s !== opt) : [...without, opt]
      return { ...prev, supplements: next }
    })
  }

  function handleNext() {
    if (step < STEP_TITLES.length - 1) {
      setStep((s) => s + 1)
    } else {
      // Backend questionnaire module not built yet — UI-only confirmation.
      setSubmitted(true)
    }
  }

  function handleBack() {
    if (step > 0) setStep((s) => s - 1)
  }

  if (submitted) {
    return (
      <main className="min-h-screen bg-white text-[#181818]">
        <Navbar transparent={false} />
        <div className="mx-auto max-w-4xl px-6 sm:px-10 lg:px-16 pt-32 pb-28">
          <motion.div
            initial={{ opacity: 0, y: 32 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease }}
            className="flex min-h-[55vh] flex-col items-center justify-center text-center"
          >
            <motion.svg
              width="72"
              height="72"
              viewBox="0 0 72 72"
              fill="none"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.6, ease, delay: 0.1 }}
              className="mb-8"
              aria-hidden
            >
              <circle cx="36" cy="36" r="34.5" stroke="#4a7c59" strokeWidth="1.2" />
              <motion.path
                d="M23 37.5 32 46.5 50 27"
                stroke="#4a7c59"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.6, ease, delay: 0.4 }}
              />
            </motion.svg>
            <h1
              className="font-display font-light leading-[1.04] text-[#181818] mb-4"
              style={{ fontSize: 'clamp(2.4rem, 5vw, 4.5rem)' }}
            >
              Анкета сохранена
            </h1>
            <p className="font-sans text-[15px] text-[#6d6d6d] max-w-md mb-10">
              Спасибо. Мы учтём ваши ответы при формировании персональных рекомендаций.
            </p>
            <Link href="/dashboard" className="btn-primary-dark text-sm">
              В личный кабинет
            </Link>
          </motion.div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-white text-[#181818]">
      <Navbar transparent={false} />

      <div className="mx-auto max-w-4xl px-6 sm:px-10 lg:px-16 pt-32 pb-28">
        <motion.div
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease }}
        >
          <p className="font-sans text-[11px] tracking-[0.28em] uppercase text-[#6d6d6d] mb-5">
            Шаг {step + 1} из {STEP_TITLES.length} · {STEP_TITLES[step]}
          </p>
          <h1
            className="font-display font-light leading-[1.04] text-[#181818] mb-8"
            style={{ fontSize: 'clamp(2.4rem, 5vw, 4.5rem)' }}
          >
            Анкета
          </h1>

          {/* Step indicator */}
          <div className="flex gap-2 mb-12 max-w-xs">
            {STEP_TITLES.map((t, i) => (
              <span
                key={t}
                className="h-[2px] flex-1 rounded-full transition-colors"
                style={{ background: i <= step ? '#181818' : 'rgba(24,24,24,0.12)' }}
              />
            ))}
          </div>

          {/* Steps */}
          <div className="max-w-xl">
            <AnimatePresence mode="wait">
              {step === 0 && (
                <motion.div
                  key="step-0"
                  variants={stepVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                >
                  <motion.div variants={fieldStagger} initial="initial" animate="animate" className="space-y-8">
                    <motion.div variants={field}>
                      <Label>Возраст</Label>
                      <input
                        type="number"
                        min={25}
                        max={90}
                        value={form.age}
                        onChange={(e) => set('age', e.target.value)}
                        placeholder="Например, 52"
                        className="input-clean w-full px-4 py-3 text-[15px]"
                      />
                    </motion.div>
                    <motion.div variants={field}>
                      <Label>Пол</Label>
                      <RadioGroup
                        name="Пол"
                        options={['Мужской', 'Женский']}
                        value={form.gender}
                        onChange={(v) => set('gender', v)}
                      />
                    </motion.div>
                    <motion.div variants={field}>
                      <Label>Рост (см)</Label>
                      <input
                        type="number"
                        min={120}
                        max={230}
                        value={form.height}
                        onChange={(e) => set('height', e.target.value)}
                        placeholder="Например, 178"
                        className="input-clean w-full px-4 py-3 text-[15px]"
                      />
                    </motion.div>
                    <motion.div variants={field}>
                      <Label>Вес (кг)</Label>
                      <input
                        type="number"
                        min={35}
                        max={250}
                        value={form.weight}
                        onChange={(e) => set('weight', e.target.value)}
                        placeholder="Например, 74"
                        className="input-clean w-full px-4 py-3 text-[15px]"
                      />
                    </motion.div>
                  </motion.div>
                </motion.div>
              )}

              {step === 1 && (
                <motion.div
                  key="step-1"
                  variants={stepVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                >
                  <motion.div variants={fieldStagger} initial="initial" animate="animate" className="space-y-8">
                    <motion.div variants={field}>
                      <Label>Уровень физической активности</Label>
                      <RadioGroup
                        name="Активность"
                        options={ACTIVITY_OPTS}
                        value={form.activity}
                        onChange={(v) => set('activity', v)}
                      />
                    </motion.div>
                    <motion.div variants={field}>
                      <Label>Качество сна</Label>
                      <RadioGroup
                        name="Сон"
                        options={SLEEP_OPTS}
                        value={form.sleep}
                        onChange={(v) => set('sleep', v)}
                      />
                    </motion.div>
                    <motion.div variants={field}>
                      <Label>Уровень стресса</Label>
                      <RadioGroup
                        name="Стресс"
                        options={STRESS_OPTS}
                        value={form.stress}
                        onChange={(v) => set('stress', v)}
                      />
                    </motion.div>
                  </motion.div>
                </motion.div>
              )}

              {step === 2 && (
                <motion.div
                  key="step-2"
                  variants={stepVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                >
                  <motion.div variants={fieldStagger} initial="initial" animate="animate" className="space-y-8">
                    <motion.div variants={field}>
                      <Label>Как часто едите красное мясо</Label>
                      <RadioGroup
                        name="Красное мясо"
                        options={RED_MEAT_OPTS}
                        value={form.redMeat}
                        onChange={(v) => set('redMeat', v)}
                      />
                    </motion.div>
                    <motion.div variants={field}>
                      <Label>Употребляете алкоголь</Label>
                      <RadioGroup
                        name="Алкоголь"
                        options={ALCOHOL_OPTS}
                        value={form.alcohol}
                        onChange={(v) => set('alcohol', v)}
                      />
                    </motion.div>
                    <motion.div variants={field}>
                      <Label>Принимаете витамины / добавки</Label>
                      <CheckboxGroup
                        options={SUPPLEMENT_OPTS}
                        values={form.supplements}
                        onToggle={toggleSupplement}
                      />
                    </motion.div>
                    <motion.div variants={field}>
                      <Label>Цель</Label>
                      <textarea
                        value={form.goal}
                        onChange={(e) => set('goal', e.target.value)}
                        rows={4}
                        placeholder="Например, улучшить энергичность, нормализовать вес..."
                        className="input-clean w-full px-4 py-3 text-[15px] resize-none"
                      />
                    </motion.div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Navigation */}
            <div className="flex items-center justify-between gap-4 mt-12">
              {step > 0 ? (
                <button onClick={handleBack} className="btn-outline-dark text-sm px-7">
                  Назад
                </button>
              ) : (
                <Link href="/dashboard" className="btn-outline-dark text-sm px-7">
                  Отмена
                </Link>
              )}
              <button onClick={handleNext} className="btn-primary-dark text-sm px-8">
                {step < STEP_TITLES.length - 1 ? 'Далее' : 'Сохранить анкету'}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </main>
  )
}
