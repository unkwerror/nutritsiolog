'use client'

// Экран редактирования профиля — app/profile/page.tsx
// Реальные поля БД (см. api/src/db/schema.ts → users): имя, фамилия, отчество,
// пол, дата рождения, телефон. Email — логин-идентификатор, только для чтения.

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { apiRequest, getAccessToken } from '@/lib/api'
import { AppBackground, AppNav, Reveal, Icon } from '@/components/ds/AppCommon'
import { Button, Field, Input, RadioGroup, GlassCard } from '@/components/ds/primitives'

type Gender = 'male' | 'female'

type Me = {
  id: string
  firstName: string
  lastName: string
  middleName: string | null
  gender: Gender | null
  dateOfBirth: string | null
  email: string | null
  phone: string | null
}

type Form = {
  firstName: string
  lastName: string
  middleName: string
  gender: '' | Gender
  dateOfBirth: string
  phone: string
}

function toForm(me: Me): Form {
  return {
    firstName: me.firstName ?? '',
    lastName: me.lastName ?? '',
    middleName: me.middleName ?? '',
    gender: me.gender ?? '',
    dateOfBirth: me.dateOfBirth ?? '',
    phone: me.phone ?? '',
  }
}

export default function ProfilePage() {
  const router = useRouter()

  const [me, setMe] = useState<Me | null>(null)
  const [form, setForm] = useState<Form | null>(null)
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)

  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!getAccessToken()) {
      router.replace('/auth')
      return
    }
    apiRequest<Me>('/api/v1/users/me')
      .then((u) => {
        setMe(u)
        setForm(toForm(u))
      })
      .catch((e: unknown) =>
        setFetchError(e instanceof Error ? e.message : 'Не удалось загрузить профиль'),
      )
      .finally(() => setLoading(false))
  }, [router])

  function set<K extends keyof Form>(key: K, value: Form[K]) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev))
    setSaved(false)
    setSaveError(null)
  }

  async function save() {
    if (!form) return
    if (!form.firstName.trim() || !form.lastName.trim()) {
      setSaveError('Имя и фамилия обязательны')
      return
    }
    setSaving(true)
    setSaveError(null)
    try {
      const body = {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        middleName: form.middleName.trim() || null,
        gender: form.gender === '' ? null : form.gender,
        dateOfBirth: form.dateOfBirth || null,
        phone: form.phone.trim() || null,
      }
      const updated = await apiRequest<Me>('/api/v1/users/me', {
        method: 'PATCH',
        body: JSON.stringify(body),
      })
      setMe(updated)
      setForm(toForm(updated))
      setSaved(true)
      setTimeout(() => setSaved(false), 2800)
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : 'Ошибка сохранения')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <main style={{ position: 'relative', minHeight: '100vh' }}>
        <AppBackground glow="16%" />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <AppNav onBack={() => router.push('/dashboard')} backLabel="На главную" />
          <div className="flex items-center justify-center" style={{ minHeight: '60vh' }}>
            <p className="font-sans text-sm text-white/35">Загрузка…</p>
          </div>
        </div>
      </main>
    )
  }

  if (fetchError || !me || !form) {
    return (
      <main style={{ position: 'relative', minHeight: '100vh' }}>
        <AppBackground glow="16%" />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <AppNav onBack={() => router.push('/dashboard')} backLabel="На главную" />
          <div className="flex flex-col items-center justify-center gap-5 px-6" style={{ minHeight: '60vh' }}>
            <p className="font-sans text-sm text-white/55 text-center">
              {fetchError ?? 'Профиль не найден'}
            </p>
            <Link href="/dashboard" className="btn-outline-gold" style={{ fontSize: '0.875rem' }}>
              ← На главную
            </Link>
          </div>
        </div>
      </main>
    )
  }

  const initial = (form.firstName[0] ?? 'И').toUpperCase()

  return (
    <main style={{ position: 'relative', minHeight: '100vh' }}>
      <AppBackground glow="16%" />
      <div style={{ position: 'relative', zIndex: 1 }}>
        <AppNav onBack={() => router.push('/dashboard')} backLabel="На главную" />

        <div style={{ maxWidth: '42rem', margin: '0 auto', padding: 'clamp(2rem,5vw,3.5rem) clamp(1.25rem,5vw,2.5rem) 7rem' }}>
          {/* Header */}
          <Reveal style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap', marginBottom: 'clamp(1.75rem,4vw,2.5rem)' }}>
            <span
              style={{ display: 'grid', placeItems: 'center', width: 72, height: 72, borderRadius: '50%', border: '1px solid rgba(255,230,146,0.3)', background: 'rgba(255,230,146,0.1)', fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 30, color: 'var(--gold)' }}
            >
              {initial}
            </span>
            <div>
              <p className="eyebrow" style={{ marginBottom: 10 }}>
                Личные данные
              </p>
              <h1 className="font-display" style={{ fontWeight: 500, fontSize: 'clamp(2.2rem,6vw,3.2rem)', color: '#fff', lineHeight: 1, margin: 0 }}>
                Профиль
              </h1>
            </div>
          </Reveal>

          {/* Personal data card */}
          <Reveal delay={60}>
            <GlassCard variant="card" style={{ padding: 'clamp(1.25rem,4vw,1.75rem)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(13rem, 1fr))', gap: '1rem' }}>
                <Field label="Имя">
                  <Input value={form.firstName} onChange={(e) => set('firstName', e.target.value)} placeholder="Иван" />
                </Field>
                <Field label="Фамилия">
                  <Input value={form.lastName} onChange={(e) => set('lastName', e.target.value)} placeholder="Соколов" />
                </Field>
              </div>

              <div style={{ marginTop: '1rem' }}>
                <Field label="Отчество" hint="Необязательно">
                  <Input value={form.middleName} onChange={(e) => set('middleName', e.target.value)} placeholder="Петрович" />
                </Field>
              </div>

              <div style={{ marginTop: '1rem' }}>
                <Field label="Email" hint="Используется для входа — изменить нельзя">
                  <Input value={me.email ?? ''} disabled readOnly style={{ opacity: 0.55, cursor: 'not-allowed' }} />
                </Field>
              </div>

              <div style={{ marginTop: '1rem' }}>
                <Field label="Телефон">
                  <Input value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+7 900 000-00-00" inputMode="tel" />
                </Field>
              </div>

              <div style={{ marginTop: '1.25rem' }}>
                <p style={{ fontFamily: 'var(--font-sans)', fontSize: '0.875rem', color: 'rgba(255,255,255,0.7)', marginBottom: '0.625rem' }}>Пол</p>
                <RadioGroup
                  value={form.gender}
                  onChange={(v) => set('gender', v as Gender)}
                  options={[
                    { value: 'female', label: 'Женский' },
                    { value: 'male', label: 'Мужской' },
                  ]}
                />
              </div>

              <div style={{ marginTop: '1.25rem' }}>
                <Field label="Дата рождения">
                  <Input type="date" value={form.dateOfBirth} onChange={(e) => set('dateOfBirth', e.target.value)} />
                </Field>
              </div>
            </GlassCard>
          </Reveal>

          {/* Questionnaire link */}
          <Reveal delay={120}>
            <Link
              href="/questionnaire"
              className="analysis-row"
              style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 16, padding: '1.1rem 1.25rem', borderRadius: 16, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', textDecoration: 'none' }}
            >
              <span style={{ display: 'grid', placeItems: 'center', width: 44, height: 44, borderRadius: 12, background: 'rgba(255,230,146,0.1)', flexShrink: 0 }}>
                <Icon name="survey" size={22} />
              </span>
              <span style={{ flex: 1 }}>
                <span className="font-display" style={{ display: 'block', fontSize: 17, color: '#fff' }}>Ответы анкеты</span>
                <span style={{ display: 'block', fontSize: 13, color: 'rgba(255,255,255,0.45)' }}>Изменить ответы о здоровье и образе жизни</span>
              </span>
              <span style={{ color: 'var(--gold)', fontSize: 20 }}>→</span>
            </Link>
          </Reveal>

          {/* Actions */}
          <Reveal delay={160} style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginTop: 28 }}>
            <Button variant="gold" onClick={() => void save()} disabled={saving}>
              {saving ? 'Сохранение…' : 'Сохранить изменения'}
            </Button>
            <Button variant="ghost" href="/dashboard">
              Отмена
            </Button>
            <span
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: 'var(--font-sans)', fontSize: 14, color: 'rgba(255,230,146,0.9)', transition: 'opacity .3s', opacity: saved ? 1 : 0 }}
            >
              ✓ Изменения сохранены
            </span>
          </Reveal>

          {saveError && (
            <p className="font-sans" style={{ fontSize: 13, marginTop: 14, color: 'rgba(248,113,113,0.9)' }}>
              {saveError}
            </p>
          )}
        </div>
      </div>
    </main>
  )
}
