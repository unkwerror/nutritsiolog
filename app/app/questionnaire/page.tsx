'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence, type Variants } from 'framer-motion'
import { apiRequest, getAccessToken } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { Navbar } from '@/components/Navbar'

const ease: [number, number, number, number] = [0.25, 0.46, 0.45, 0.94]

const slide: Variants = {
  initial: { opacity: 0, x: 32 },
  animate: { opacity: 1, x: 0, transition: { duration: 0.4, ease } },
  exit: { opacity: 0, x: -32, transition: { duration: 0.22, ease } },
}
const stagger: Variants = {
  initial: {},
  animate: { transition: { staggerChildren: 0.07 } },
}
const row: Variants = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4, ease } },
}

// ─── Form state ──────────────────────────────────────────────────────────────

type Form = {
  // Step 1
  gender: string
  dateOfBirth: string
  heightCm: string
  weightKg: string
  waistCm: string
  goal: string
  // Step 2
  activityLevel: string
  sleepDuration: string
  sleepQuality: string
  bedtime: string
  // Step 3
  mealsPerDay: string
  dinnerToSleep: string
  waterLiters: string
  caffeine: string
  smoking: string
  emotionalEating: string
  // Step 4
  symptoms: string[]
  // Step 5
  medications: string
  supplements: string
  cycleStatus: string
  pms: string
}

const INIT: Form = {
  gender: '', dateOfBirth: '', heightCm: '', weightKg: '', waistCm: '', goal: '',
  activityLevel: '', sleepDuration: '', sleepQuality: '', bedtime: '',
  mealsPerDay: '', dinnerToSleep: '', waterLiters: '', caffeine: '', smoking: '', emotionalEating: '',
  symptoms: [],
  medications: '', supplements: '', cycleStatus: '', pms: '',
}

const STEPS = ['Базовые данные', 'Образ жизни', 'Питание', 'Симптомы', 'Здоровье']

const SYMPTOM_OPTS: { value: string; label: string }[] = [
  { value: 'fatigue', label: 'Постоянная усталость, нет сил' },
  { value: 'bloating', label: 'Вздутие или тяжесть после еды' },
  { value: 'gut_issues', label: 'Нестабильный стул (запор/диарея)' },
  { value: 'hair_skin_nails', label: 'Выпадение волос, сухость кожи, ломкость ногтей' },
  { value: 'edema', label: 'Отёки (лицо/ноги/пальцы)' },
  { value: 'mood_anxiety', label: 'Тревожность, раздражительность, перепады настроения' },
  { value: 'headaches_brainfog', label: 'Головные боли, туман в голове' },
  { value: 'low_immunity', label: 'Частые простуды, аллергии' },
  { value: 'joint_muscle_pain', label: 'Боли в суставах или мышцах, судороги' },
  { value: 'cold_extremities', label: 'Холодные конечности, зябкость' },
]

// ─── UI atoms ────────────────────────────────────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
  return <p className="text-[14px] text-white/65 mb-2.5">{children}</p>
}

function Radio({ name, options, value, onChange }: {
  name: string; options: { v: string; l: string }[]
  value: string; onChange: (v: string) => void
}) {
  return (
    <div className="grid gap-2">
      {options.map((o) => {
        const on = value === o.v
        return (
          <button
            key={o.v} type="button" onClick={() => onChange(o.v)}
            className="flex items-center gap-3 rounded-[10px] px-4 py-3 text-left transition-all"
            style={{
              border: on ? '1.5px solid rgba(255,230,146,0.65)' : '1.5px solid rgba(255,255,255,0.1)',
              background: on ? 'rgba(255,230,146,0.05)' : 'rgba(255,255,255,0.025)',
            }}
            aria-pressed={on}
          >
            <span
              className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors"
              style={{ borderColor: on ? '#ffe692' : 'rgba(255,255,255,0.28)' }}
            >
              {on && <span className="h-2 w-2 rounded-full bg-[#ffe692]" />}
            </span>
            <span className="font-sans text-[14px] text-white/90">{o.l}</span>
          </button>
        )
      })}
    </div>
  )
}

function SymptomCheck({ opts, values, toggle }: {
  opts: { value: string; label: string }[]
  values: string[]
  toggle: (v: string) => void
}) {
  return (
    <div className="grid gap-2">
      {opts.map((o) => {
        const on = values.includes(o.value)
        return (
          <button
            key={o.value} type="button" onClick={() => toggle(o.value)}
            className="flex items-center gap-3 rounded-[10px] px-4 py-3 text-left transition-all"
            style={{
              border: on ? '1.5px solid rgba(255,230,146,0.65)' : '1.5px solid rgba(255,255,255,0.1)',
              background: on ? 'rgba(255,230,146,0.05)' : 'rgba(255,255,255,0.025)',
            }}
            aria-pressed={on}
          >
            <span
              className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-[5px] border transition-all"
              style={{
                borderColor: on ? '#ffe692' : 'rgba(255,255,255,0.28)',
                background: on ? '#ffe692' : 'transparent',
              }}
            >
              {on && (
                <svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden>
                  <path d="M2.5 6.2 5 8.5l4.5-5" stroke="#35462f" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </span>
            <span className="font-sans text-[14px] text-white/90">{o.label}</span>
          </button>
        )
      })}
    </div>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

// Required fields per step — used to gate the "Next" button
const STEP_REQUIRED: (keyof Form)[][] = [
  ['gender', 'dateOfBirth', 'heightCm', 'weightKg', 'goal'],
  ['activityLevel', 'sleepDuration', 'sleepQuality', 'bedtime'],
  ['mealsPerDay', 'dinnerToSleep', 'waterLiters', 'caffeine', 'smoking', 'emotionalEating'],
  [], // symptoms are optional
  ['medications', 'supplements'],
]

function isStepComplete(form: Form, stepIdx: number): boolean {
  return STEP_REQUIRED[stepIdx]!.every((k) => {
    const v = form[k]
    return typeof v === 'string' ? v.trim() !== '' : true
  })
}

export default function QuestionnairePage() {
  const router = useRouter()
  const { user, isLoading: authLoading } = useAuth()
  const [step, setStep] = useState(0)
  const [form, setForm] = useState<Form>(INIT)
  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!authLoading && !user && !getAccessToken()) router.replace('/auth')
  }, [authLoading, user, router])

  // Preload existing answers
  useEffect(() => {
    if (!getAccessToken()) return
    apiRequest<{ answers: Partial<Form> } | null>('/api/v1/questionnaire/my')
      .then((r) => {
        if (r?.answers) {
          setForm((prev) => ({ ...prev, ...(r.answers as Form) }))
        }
      })
      .catch(() => {})
  }, [])

  function set<K extends keyof Form>(k: K, v: Form[K]) {
    setForm((p) => ({ ...p, [k]: v }))
  }
  function toggleSymptom(v: string) {
    setForm((p) => ({
      ...p,
      symptoms: p.symptoms.includes(v) ? p.symptoms.filter((s) => s !== v) : [...p.symptoms, v],
    }))
  }

  async function handleSubmit() {
    setSaving(true)
    setError(null)
    try {
      const body = {
        gender: form.gender || undefined,
        dateOfBirth: form.dateOfBirth || undefined,
        heightCm: form.heightCm ? Number(form.heightCm) : undefined,
        weightKg: form.weightKg ? Number(form.weightKg) : undefined,
        waistCm: form.waistCm ? Number(form.waistCm) : undefined,
        goal: form.goal || undefined,
        activityLevel: form.activityLevel || undefined,
        sleepDuration: form.sleepDuration || undefined,
        sleepQuality: form.sleepQuality || undefined,
        bedtime: form.bedtime || undefined,
        mealsPerDay: form.mealsPerDay || undefined,
        dinnerToSleep: form.dinnerToSleep || undefined,
        waterLiters: form.waterLiters || undefined,
        caffeine: form.caffeine || undefined,
        smoking: form.smoking || undefined,
        emotionalEating: form.emotionalEating || undefined,
        symptoms: form.symptoms,
        medications: form.medications || undefined,
        supplements: form.supplements || undefined,
        cycleStatus: form.cycleStatus || undefined,
        pms: form.pms || undefined,
      }
      await apiRequest('/api/v1/questionnaire', { method: 'POST', body: JSON.stringify(body) })
      setSubmitted(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка сохранения')
    } finally {
      setSaving(false)
    }
  }

  const bg = 'linear-gradient(160deg, #35462f 0%, #4a6040 60%, #3d5435 100%)'

  if (submitted) {
    return (
      <main className="min-h-screen" style={{ background: bg }}>
        <Navbar transparent={false} variant="dark" />
        <div className="mx-auto max-w-xl px-6 pt-32 pb-24 flex flex-col items-center justify-center min-h-screen text-center">
          <motion.div initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.55, ease }}>
            <svg width="72" height="72" viewBox="0 0 72 72" fill="none" className="mx-auto mb-8" aria-hidden>
              <circle cx="36" cy="36" r="34.5" stroke="rgba(255,230,146,0.55)" strokeWidth="1.2" />
              <motion.path d="M23 37.5 32 46.5 50 27" stroke="#ffe692" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
                initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.6, delay: 0.3, ease }} />
            </svg>
            <h1 className="font-display font-light text-white leading-tight mb-4" style={{ fontSize: 'clamp(2rem,5vw,3.5rem)' }}>
              Анкета сохранена
            </h1>
            <p className="font-sans text-white/55 mb-10">Мы учтём ваши ответы при формировании рекомендаций.</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="/recommendations" className="btn-gold text-sm">Посмотреть рекомендации</Link>
              <Link href="/dashboard" className="btn-outline-gold text-sm">В кабинет</Link>
            </div>
          </motion.div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen" style={{ background: bg }}>
      <Navbar transparent={false} variant="dark" />

      <div className="mx-auto max-w-xl px-5 sm:px-8 pt-28 pb-24">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease }}>
          <p className="font-sans text-[11px] tracking-[0.28em] uppercase text-white/40 mb-4">
            Шаг {step + 1} из {STEPS.length} · {STEPS[step]}
          </p>
          <h1 className="font-display font-light text-white mb-6 leading-tight" style={{ fontSize: 'clamp(2rem, 5vw, 3.6rem)' }}>
            Анкета
          </h1>
          {/* Progress */}
          <div className="flex gap-1.5 mb-10 max-w-xs">
            {STEPS.map((_, i) => (
              <span key={i} className="h-[2px] flex-1 rounded-full transition-all duration-300"
                style={{ background: i <= step ? 'rgba(255,230,146,0.75)' : 'rgba(255,255,255,0.1)' }} />
            ))}
          </div>
        </motion.div>

        {/* Steps */}
        <AnimatePresence mode="wait">
          {step === 0 && (
            <motion.div key="s0" variants={slide} initial="initial" animate="animate" exit="exit">
              <motion.div variants={stagger} initial="initial" animate="animate" className="space-y-7">
                <motion.div variants={row}>
                  <Label>Пол *</Label>
                  <Radio name="gender"
                    options={[{ v: 'female', l: 'Женский' }, { v: 'male', l: 'Мужской' }]}
                    value={form.gender} onChange={(v) => set('gender', v)} />
                </motion.div>
                <motion.div variants={row}>
                  <Label>Дата рождения *</Label>
                  <input type="date" value={form.dateOfBirth} onChange={(e) => set('dateOfBirth', e.target.value)}
                    className="glass-input w-full px-4 py-3 text-[15px] rounded-[10px]" />
                </motion.div>
                <motion.div variants={row} className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Рост (см) *</Label>
                    <input type="number" min={100} max={250} placeholder="175"
                      value={form.heightCm} onChange={(e) => set('heightCm', e.target.value)}
                      className="glass-input w-full px-4 py-3 text-[15px] rounded-[10px]" />
                  </div>
                  <div>
                    <Label>Вес (кг) *</Label>
                    <input type="number" min={30} max={300} placeholder="70"
                      value={form.weightKg} onChange={(e) => set('weightKg', e.target.value)}
                      className="glass-input w-full px-4 py-3 text-[15px] rounded-[10px]" />
                  </div>
                </motion.div>
                <motion.div variants={row}>
                  <Label>Обхват талии (см, необязательно)</Label>
                  <input type="number" min={40} max={200} placeholder="80"
                    value={form.waistCm} onChange={(e) => set('waistCm', e.target.value)}
                    className="glass-input w-full px-4 py-3 text-[15px] rounded-[10px]" />
                </motion.div>
                <motion.div variants={row}>
                  <Label>Главная цель *</Label>
                  <Radio name="goal" value={form.goal} onChange={(v) => set('goal', v)}
                    options={[
                      { v: 'lose_weight', l: 'Снизить вес' },
                      { v: 'maintain', l: 'Поддержать вес' },
                      { v: 'gain', l: 'Набрать вес' },
                      { v: 'energy_sleep', l: 'Улучшить энергию и сон' },
                      { v: 'gut_health', l: 'Нормализовать ЖКТ' },
                    ]} />
                </motion.div>
              </motion.div>
            </motion.div>
          )}

          {step === 1 && (
            <motion.div key="s1" variants={slide} initial="initial" animate="animate" exit="exit">
              <motion.div variants={stagger} initial="initial" animate="animate" className="space-y-7">
                <motion.div variants={row}>
                  <Label>Уровень физической активности</Label>
                  <Radio name="activity" value={form.activityLevel} onChange={(v) => set('activityLevel', v)}
                    options={[
                      { v: 'sedentary', l: 'Сидячий — офис без спорта' },
                      { v: 'light', l: 'Лёгкий — 1-2 тренировки в неделю' },
                      { v: 'moderate', l: 'Умеренный — 3-4 тренировки' },
                      { v: 'high', l: 'Высокий — 5+ тренировок' },
                    ]} />
                </motion.div>
                <motion.div variants={row}>
                  <Label>Длительность сна</Label>
                  <Radio name="sleep_d" value={form.sleepDuration} onChange={(v) => set('sleepDuration', v)}
                    options={[
                      { v: 'lt6', l: 'Менее 6 часов' },
                      { v: '6-7', l: '6–7 часов' },
                      { v: '7-8', l: '7–8 часов' },
                      { v: 'gt8', l: 'Более 8 часов' },
                    ]} />
                </motion.div>
                <motion.div variants={row}>
                  <Label>Качество сна</Label>
                  <Radio name="sleep_q" value={form.sleepQuality} onChange={(v) => set('sleepQuality', v)}
                    options={[
                      { v: 'excellent', l: 'Отличное — сплю без пробуждений' },
                      { v: 'normal', l: 'Нормальное' },
                      { v: 'interrupted', l: 'Прерывистое — просыпаюсь ночью' },
                      { v: 'poor', l: 'Плохое — чувствую усталость с утра' },
                    ]} />
                </motion.div>
                <motion.div variants={row}>
                  <Label>Время отхода ко сну</Label>
                  <Radio name="bedtime" value={form.bedtime} onChange={(v) => set('bedtime', v)}
                    options={[
                      { v: 'before_23', l: 'До 23:00' },
                      { v: '23-00', l: '23:00 – 00:00' },
                      { v: 'after_00', l: 'После 00:00' },
                    ]} />
                </motion.div>
              </motion.div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div key="s2" variants={slide} initial="initial" animate="animate" exit="exit">
              <motion.div variants={stagger} initial="initial" animate="animate" className="space-y-7">
                <motion.div variants={row}>
                  <Label>Приёмов пищи в день</Label>
                  <Radio name="meals" value={form.mealsPerDay} onChange={(v) => set('mealsPerDay', v)}
                    options={[
                      { v: '1-2', l: '1–2 раза' },
                      { v: '3', l: '3 раза' },
                      { v: '4-5', l: '4–5 раз' },
                      { v: 'gt5', l: 'Более 5 раз, постоянные перекусы' },
                    ]} />
                </motion.div>
                <motion.div variants={row}>
                  <Label>Интервал между ужином и сном</Label>
                  <Radio name="dinner" value={form.dinnerToSleep} onChange={(v) => set('dinnerToSleep', v)}
                    options={[
                      { v: 'lt2h', l: 'Менее 2 часов' },
                      { v: '2-3h', l: '2–3 часа' },
                      { v: 'gt3h', l: 'Более 3 часов' },
                    ]} />
                </motion.div>
                <motion.div variants={row}>
                  <Label>Вода в день</Label>
                  <Radio name="water" value={form.waterLiters} onChange={(v) => set('waterLiters', v)}
                    options={[
                      { v: 'lt1.5', l: 'Менее 1,5 л' },
                      { v: '1.5-2', l: '1,5–2 л' },
                      { v: 'gt2', l: 'Более 2 л' },
                    ]} />
                </motion.div>
                <motion.div variants={row}>
                  <Label>Кофе/чай в день</Label>
                  <Radio name="caffeine" value={form.caffeine} onChange={(v) => set('caffeine', v)}
                    options={[
                      { v: '0', l: 'Не пью' },
                      { v: '1-2', l: '1–2 чашки' },
                      { v: '3-4', l: '3–4 чашки' },
                      { v: 'gt5', l: '5+ чашек' },
                    ]} />
                </motion.div>
                <motion.div variants={row} className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Курение</Label>
                    <Radio name="smoking" value={form.smoking} onChange={(v) => set('smoking', v)}
                      options={[
                        { v: 'no', l: 'Нет' },
                        { v: 'quit', l: 'Бросил(а)' },
                        { v: 'yes', l: 'Да' },
                      ]} />
                  </div>
                  <div>
                    <Label>Эмоциональное переедание</Label>
                    <Radio name="eating" value={form.emotionalEating} onChange={(v) => set('emotionalEating', v)}
                      options={[
                        { v: 'never', l: 'Никогда' },
                        { v: 'rarely', l: 'Редко' },
                        { v: 'often', l: 'Часто' },
                        { v: 'always', l: 'Постоянно' },
                      ]} />
                  </div>
                </motion.div>
              </motion.div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div key="s3" variants={slide} initial="initial" animate="animate" exit="exit">
              <motion.div variants={stagger} initial="initial" animate="animate">
                <motion.p variants={row} className="font-sans text-[14px] text-white/55 mb-5">
                  Отметьте всё, что актуально для вас прямо сейчас
                </motion.p>
                <motion.div variants={row}>
                  <SymptomCheck opts={SYMPTOM_OPTS} values={form.symptoms} toggle={toggleSymptom} />
                </motion.div>
              </motion.div>
            </motion.div>
          )}

          {step === 4 && (
            <motion.div key="s4" variants={slide} initial="initial" animate="animate" exit="exit">
              <motion.div variants={stagger} initial="initial" animate="animate" className="space-y-7">
                <motion.div variants={row}>
                  <Label>Постоянные лекарства</Label>
                  <Radio name="meds" value={form.medications} onChange={(v) => set('medications', v)}
                    options={[
                      { v: 'no', l: 'Не принимаю' },
                      { v: 'hormones', l: 'Гормоны' },
                      { v: 'blood_pressure', l: 'От давления' },
                      { v: 'sugar', l: 'От сахара' },
                      { v: 'other', l: 'Другие' },
                    ]} />
                </motion.div>
                <motion.div variants={row}>
                  <Label>Принимаете витамины / БАДы</Label>
                  <Radio name="supps" value={form.supplements} onChange={(v) => set('supplements', v)}
                    options={[
                      { v: 'no', l: 'Нет' },
                      { v: 'sometimes', l: 'Иногда' },
                      { v: 'regular', l: 'Да, регулярно' },
                    ]} />
                </motion.div>
                {form.gender === 'female' && (
                  <>
                    <motion.div variants={row}>
                      <Label>Статус цикла</Label>
                      <Radio name="cycle" value={form.cycleStatus} onChange={(v) => set('cycleStatus', v)}
                        options={[
                          { v: 'regular', l: 'Регулярный' },
                          { v: 'irregular', l: 'Нерегулярный' },
                          { v: 'menopause', l: 'Менопауза' },
                          { v: 'pregnancy', l: 'Беременность' },
                        ]} />
                    </motion.div>
                    <motion.div variants={row}>
                      <Label>Выраженность ПМС</Label>
                      <Radio name="pms" value={form.pms} onChange={(v) => set('pms', v)}
                        options={[
                          { v: 'none', l: 'Нет ПМС' },
                          { v: 'moderate', l: 'Умеренный' },
                          { v: 'severe', l: 'Сильный' },
                        ]} />
                    </motion.div>
                  </>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {error && (
          <p className="mt-4 text-[13px] px-3 py-2.5 rounded-[10px]"
            style={{ background: 'rgba(255,80,80,0.1)', color: '#ff9a9a', border: '1px solid rgba(255,80,80,0.18)' }}>
            {error}
          </p>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between gap-4 mt-10">
          {step > 0 ? (
            <button onClick={() => setStep((s) => s - 1)} className="btn-outline-gold text-sm px-7">Назад</button>
          ) : (
            <Link href="/dashboard" className="btn-outline-gold text-sm px-7">Отмена</Link>
          )}
          {step < STEPS.length - 1 ? (
            <button
              onClick={() => setStep((s) => s + 1)}
              disabled={!isStepComplete(form, step)}
              className="btn-gold text-sm px-8 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Далее
            </button>
          ) : (
            <button
              onClick={() => void handleSubmit()}
              disabled={saving || !isStepComplete(form, step)}
              className="btn-gold text-sm px-8 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {saving ? 'Сохранение…' : 'Сохранить анкету'}
            </button>
          )}
        </div>
      </div>
    </main>
  )
}
