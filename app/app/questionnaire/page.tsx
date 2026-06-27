'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { apiRequest, getAccessToken } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { AppBackground, AppNav, Burst } from '@/components/ds/AppCommon'
import { RadioGroup, CheckboxRow, Input, Field, Button } from '@/components/ds/primitives'

type Form = {
  gender: string
  dateOfBirth: string
  heightCm: string
  weightKg: string
  waistCm: string
  goal: string
  activityLevel: string
  sleepDuration: string
  sleepQuality: string
  bedtime: string
  mealsPerDay: string
  dinnerToSleep: string
  waterLiters: string
  caffeine: string
  smoking: string
  emotionalEating: string
  symptoms: string[]
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

const STEPS_META = [
  { label: 'Базовые', title: 'Расскажите о себе', sub: 'Базовые параметры нужны для расчёта норм' },
  { label: 'Образ жизни', title: 'Ваш образ жизни', sub: 'Активность и сон сильно влияют на биохимию' },
  { label: 'Питание', title: 'Питание', sub: 'Как устроен ваш рацион сейчас' },
  { label: 'Симптомы', title: 'Что вас беспокоит', sub: 'Отметьте всё, что актуально прямо сейчас' },
  { label: 'Здоровье', title: 'Здоровье', sub: 'Лекарства, добавки и гормональный статус' },
]

const SYMPTOM_OPTS = [
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

const STEP_REQUIRED: (keyof Form)[][] = [
  ['gender', 'dateOfBirth', 'heightCm', 'weightKg', 'goal'],
  ['activityLevel', 'sleepDuration', 'sleepQuality', 'bedtime'],
  ['mealsPerDay', 'dinnerToSleep', 'waterLiters', 'caffeine', 'smoking', 'emotionalEating'],
  [],
  ['medications', 'supplements'],
]
function isStepComplete(form: Form, stepIdx: number): boolean {
  return (STEP_REQUIRED[stepIdx] ?? []).every((k) => {
    const v = form[k]
    return typeof v === 'string' ? v.trim() !== '' : true
  })
}

function Q({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.65)', margin: '0 0 10px' }}>{label}</p>
      {children}
    </div>
  )
}

export default function QuestionnairePage() {
  const router = useRouter()
  const { user, isLoading: authLoading } = useAuth()
  const [step, setStep] = useState(0)
  const [dir, setDir] = useState(1)
  const [form, setForm] = useState<Form>(INIT)
  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const last = STEPS_META.length - 1

  useEffect(() => {
    if (!authLoading && !user && !getAccessToken()) router.replace('/auth')
  }, [authLoading, user, router])

  useEffect(() => {
    if (!getAccessToken()) return
    apiRequest<{ answers: Record<string, unknown> } | null>('/api/v1/questionnaire/my')
      .then((r) => {
        if (!r?.answers) return
        const a = r.answers
        const stringFields: Exclude<keyof Form, 'symptoms'>[] = [
          'gender', 'dateOfBirth', 'heightCm', 'weightKg', 'waistCm', 'goal',
          'activityLevel', 'sleepDuration', 'sleepQuality', 'bedtime',
          'mealsPerDay', 'dinnerToSleep', 'waterLiters', 'caffeine', 'smoking', 'emotionalEating',
          'medications', 'supplements', 'cycleStatus', 'pms',
        ]
        setForm((prev) => {
          const next: Form = { ...prev }
          for (const k of stringFields) {
            const v = a[k]
            if (v != null) next[k] = String(v)
          }
          if (Array.isArray(a['symptoms'])) next.symptoms = a['symptoms'].filter((s): s is string => typeof s === 'string')
          return next
        })
      })
      .catch(() => {})
  }, [])

  function set<K extends keyof Form>(k: K, v: Form[K]) {
    setForm((p) => ({ ...p, [k]: v }))
  }
  function toggleSymptom(v: string) {
    setForm((p) => ({ ...p, symptoms: p.symptoms.includes(v) ? p.symptoms.filter((s) => s !== v) : [...p.symptoms, v] }))
  }
  function move(d: number) {
    setDir(d)
    setStep((s) => Math.min(last, Math.max(0, s + d)))
    window.scrollTo(0, 0)
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

  if (submitted) {
    return (
      <main style={{ position: 'relative', minHeight: '100vh' }}>
        <AppBackground glow="40%" />
        <div style={{ position: 'relative', zIndex: 1, minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '0 1.5rem' }}>
          <div className="pop-check" style={{ position: 'relative', marginBottom: 30 }}>
            <Burst n={22} />
            <svg width="84" height="84" viewBox="0 0 84 84" fill="none">
              <circle cx="42" cy="42" r="40" stroke="rgba(255,230,146,0.5)" strokeWidth="1.3" />
              <circle className="draw-ring" cx="42" cy="42" r="40" stroke="#ffe692" strokeWidth="1.6" fill="none" strokeLinecap="round" />
              <path className="draw-check" d="M26 43.5 37 54 59 31" stroke="#ffe692" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </svg>
          </div>
          <h1 className="font-display" style={{ fontWeight: 500, fontSize: 'clamp(2rem,5vw,3.4rem)', color: '#fff', lineHeight: 1.1, margin: '0 0 1rem' }}>
            Анкета сохранена
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.55)', margin: '0 0 2.5rem', maxWidth: 360 }}>Мы учтём ваши ответы при формировании персональных рекомендаций.</p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
            <Button variant="gold" onClick={() => router.push('/analyses/upload')}>
              Загрузить анализы
            </Button>
            <Button variant="outline-gold" onClick={() => router.push('/dashboard')}>
              В кабинет
            </Button>
          </div>
        </div>
      </main>
    )
  }

  const meta = STEPS_META[step]!

  return (
    <main style={{ position: 'relative', minHeight: '100vh' }}>
      <AppBackground glow="14%" />
      <div style={{ position: 'relative', zIndex: 1 }}>
        <AppNav onBack={() => (step === 0 ? router.push('/dashboard') : move(-1))} backLabel={step === 0 ? 'В кабинет' : 'Назад'} />
        <div style={{ maxWidth: '38rem', margin: '0 auto', padding: 'clamp(2rem,5vw,3.5rem) clamp(1.25rem,5vw,2rem) 6rem' }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 'clamp(2rem,5vw,3rem)' }}>
            {STEPS_META.map((m, i) => (
              <button key={m.label} onClick={() => i < step && (setDir(-1), setStep(i))} style={{ flex: 1, textAlign: 'left', background: 'none', border: 'none', cursor: i < step ? 'pointer' : 'default', padding: 0 }}>
                <div style={{ height: 3, borderRadius: 3, marginBottom: 8, transition: 'background .4s', background: i <= step ? 'linear-gradient(90deg,#d4a020,#ffe692)' : 'rgba(255,255,255,0.12)' }} />
                <span className="q-step-label" style={{ fontSize: 10.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: i <= step ? 'rgba(255,230,146,0.75)' : 'rgba(255,255,255,0.3)' }}>
                  {m.label}
                </span>
              </button>
            ))}
          </div>

          <div key={step} className={dir > 0 ? 'slide-r' : 'slide-l'}>
            <p className="eyebrow" style={{ marginBottom: 12 }}>
              Шаг {step + 1} из {STEPS_META.length}
            </p>
            <h1 className="font-display" style={{ fontWeight: 500, fontSize: 'clamp(2rem,5vw,3rem)', color: '#fff', lineHeight: 1.08, margin: '0 0 8px' }}>
              {meta.title}
            </h1>
            <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 15, margin: '0 0 2rem', lineHeight: 1.5 }}>{meta.sub}</p>

            {step === 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                <Q label="Пол *">
                  <RadioGroup value={form.gender} onChange={(v) => set('gender', v)} options={[{ value: 'female', label: 'Женский' }, { value: 'male', label: 'Мужской' }]} />
                </Q>
                <Field label="Дата рождения *">
                  <Input type="date" value={form.dateOfBirth} onChange={(e) => set('dateOfBirth', e.target.value)} />
                </Field>
                <div className="q-base3" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                  <Field label="Рост, см *">
                    <Input type="number" placeholder="175" value={form.heightCm} onChange={(e) => set('heightCm', e.target.value)} />
                  </Field>
                  <Field label="Вес, кг *">
                    <Input type="number" placeholder="70" value={form.weightKg} onChange={(e) => set('weightKg', e.target.value)} />
                  </Field>
                  <Field label="Талия, см">
                    <Input type="number" placeholder="80" value={form.waistCm} onChange={(e) => set('waistCm', e.target.value)} />
                  </Field>
                </div>
                <Q label="Главная цель *">
                  <RadioGroup
                    value={form.goal}
                    onChange={(v) => set('goal', v)}
                    options={[
                      { value: 'lose_weight', label: 'Снизить вес' },
                      { value: 'maintain', label: 'Поддержать вес' },
                      { value: 'gain', label: 'Набрать вес' },
                      { value: 'energy_sleep', label: 'Улучшить энергию и сон' },
                      { value: 'gut_health', label: 'Нормализовать ЖКТ' },
                    ]}
                  />
                </Q>
              </div>
            )}

            {step === 1 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                <Q label="Физическая активность">
                  <RadioGroup
                    value={form.activityLevel}
                    onChange={(v) => set('activityLevel', v)}
                    options={[
                      { value: 'sedentary', label: 'Сидячий — офис без спорта' },
                      { value: 'light', label: 'Лёгкий — 1–2 тренировки в неделю' },
                      { value: 'moderate', label: 'Умеренный — 3–4 тренировки' },
                      { value: 'high', label: 'Высокий — 5+ тренировок' },
                    ]}
                  />
                </Q>
                <Q label="Длительность сна">
                  <RadioGroup
                    value={form.sleepDuration}
                    onChange={(v) => set('sleepDuration', v)}
                    options={[
                      { value: 'lt6', label: 'Менее 6 часов' },
                      { value: '6-7', label: '6–7 часов' },
                      { value: '7-8', label: '7–8 часов' },
                      { value: 'gt8', label: 'Более 8 часов' },
                    ]}
                  />
                </Q>
                <Q label="Качество сна">
                  <RadioGroup
                    value={form.sleepQuality}
                    onChange={(v) => set('sleepQuality', v)}
                    options={[
                      { value: 'excellent', label: 'Отличное — сплю без пробуждений' },
                      { value: 'normal', label: 'Нормальное' },
                      { value: 'interrupted', label: 'Прерывистое — просыпаюсь ночью' },
                      { value: 'poor', label: 'Плохое — чувствую усталость с утра' },
                    ]}
                  />
                </Q>
                <Q label="Время отхода ко сну">
                  <RadioGroup
                    value={form.bedtime}
                    onChange={(v) => set('bedtime', v)}
                    options={[
                      { value: 'before_23', label: 'До 23:00' },
                      { value: '23-00', label: '23:00 – 00:00' },
                      { value: 'after_00', label: 'После 00:00' },
                    ]}
                  />
                </Q>
              </div>
            )}

            {step === 2 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                <Q label="Приёмов пищи в день">
                  <RadioGroup
                    value={form.mealsPerDay}
                    onChange={(v) => set('mealsPerDay', v)}
                    options={[
                      { value: '1-2', label: '1–2 раза' },
                      { value: '3', label: '3 раза' },
                      { value: '4-5', label: '4–5 раз' },
                      { value: 'gt5', label: 'Более 5 раз, постоянные перекусы' },
                    ]}
                  />
                </Q>
                <Q label="Интервал между ужином и сном">
                  <RadioGroup
                    value={form.dinnerToSleep}
                    onChange={(v) => set('dinnerToSleep', v)}
                    options={[
                      { value: 'lt2h', label: 'Менее 2 часов' },
                      { value: '2-3h', label: '2–3 часа' },
                      { value: 'gt3h', label: 'Более 3 часов' },
                    ]}
                  />
                </Q>
                <Q label="Вода в день">
                  <RadioGroup
                    value={form.waterLiters}
                    onChange={(v) => set('waterLiters', v)}
                    options={[
                      { value: 'lt1.5', label: 'Менее 1,5 л' },
                      { value: '1.5-2', label: '1,5–2 л' },
                      { value: 'gt2', label: 'Более 2 л' },
                    ]}
                  />
                </Q>
                <Q label="Кофе/чай в день">
                  <RadioGroup
                    value={form.caffeine}
                    onChange={(v) => set('caffeine', v)}
                    options={[
                      { value: '0', label: 'Не пью' },
                      { value: '1-2', label: '1–2 чашки' },
                      { value: '3-4', label: '3–4 чашки' },
                      { value: 'gt5', label: '5+ чашек' },
                    ]}
                  />
                </Q>
                <Q label="Курение">
                  <RadioGroup value={form.smoking} onChange={(v) => set('smoking', v)} options={[{ value: 'no', label: 'Нет' }, { value: 'quit', label: 'Бросил(а)' }, { value: 'yes', label: 'Да' }]} />
                </Q>
                <Q label="Эмоциональное переедание">
                  <RadioGroup
                    value={form.emotionalEating}
                    onChange={(v) => set('emotionalEating', v)}
                    options={[
                      { value: 'never', label: 'Никогда' },
                      { value: 'rarely', label: 'Редко' },
                      { value: 'often', label: 'Часто' },
                      { value: 'always', label: 'Постоянно' },
                    ]}
                  />
                </Q>
              </div>
            )}

            {step === 3 && <CheckboxRow values={form.symptoms} onToggle={toggleSymptom} options={SYMPTOM_OPTS} />}

            {step === 4 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                <Q label="Постоянные лекарства">
                  <RadioGroup
                    value={form.medications}
                    onChange={(v) => set('medications', v)}
                    options={[
                      { value: 'no', label: 'Не принимаю' },
                      { value: 'hormones', label: 'Гормоны' },
                      { value: 'blood_pressure', label: 'От давления' },
                      { value: 'sugar', label: 'От сахара' },
                      { value: 'other', label: 'Другие' },
                    ]}
                  />
                </Q>
                <Q label="Принимаете витамины / БАДы">
                  <RadioGroup value={form.supplements} onChange={(v) => set('supplements', v)} options={[{ value: 'no', label: 'Нет' }, { value: 'sometimes', label: 'Иногда' }, { value: 'regular', label: 'Да, регулярно' }]} />
                </Q>
                {form.gender === 'female' && (
                  <>
                    <Q label="Статус цикла">
                      <RadioGroup
                        value={form.cycleStatus}
                        onChange={(v) => set('cycleStatus', v)}
                        options={[
                          { value: 'regular', label: 'Регулярный' },
                          { value: 'irregular', label: 'Нерегулярный' },
                          { value: 'menopause', label: 'Менопауза' },
                          { value: 'pregnancy', label: 'Беременность' },
                        ]}
                      />
                    </Q>
                    <Q label="Выраженность ПМС">
                      <RadioGroup value={form.pms} onChange={(v) => set('pms', v)} options={[{ value: 'none', label: 'Нет ПМС' }, { value: 'moderate', label: 'Умеренный' }, { value: 'severe', label: 'Сильный' }]} />
                    </Q>
                  </>
                )}
              </div>
            )}
          </div>

          {error && (
            <p style={{ marginTop: 16, fontSize: 13, padding: '10px 12px', borderRadius: 10, background: 'rgba(255,80,80,0.1)', color: '#ff9a9a', border: '1px solid rgba(255,80,80,0.18)' }}>{error}</p>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginTop: 36 }}>
            <Button variant="outline-gold" size="sm" onClick={() => (step === 0 ? router.push('/dashboard') : move(-1))}>
              {step === 0 ? 'Отмена' : 'Назад'}
            </Button>
            {step < last ? (
              <Button variant="gold" size="sm" disabled={!isStepComplete(form, step)} onClick={() => move(1)}>
                Далее
              </Button>
            ) : (
              <Button variant="gold" size="sm" disabled={saving || !isStepComplete(form, step)} onClick={() => void handleSubmit()}>
                {saving ? 'Сохранение…' : 'Сохранить анкету'}
              </Button>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
