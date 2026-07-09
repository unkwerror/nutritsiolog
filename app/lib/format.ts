// Общие чистые хелперы форматирования — единый источник для дашборда, админки и др.
// Примечание: страницы app/analyses/* и app/recommendations/* ведёт другой поток —
// их локальные копии переезжают сюда отдельно.

/** «5 июля 2026 г.» из ISO-строки; при кривом входе возвращает исходную строку. */
export function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(iso))
  } catch {
    return iso
  }
}

/** Русская плюрализация: plural(3, ['год', 'года', 'лет']) → 'года'. */
export function plural(n: number, forms: [string, string, string]): string {
  const m10 = n % 10
  const m100 = n % 100
  if (m10 === 1 && m100 !== 11) return forms[0]
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return forms[1]
  return forms[2]
}

// Коды типов анализа (analysisTypeEnum) → человеко-читаемые русские названия
export const ANALYSIS_TYPE_RU: Record<string, string> = {
  cbc: 'Общий анализ крови',
  biochemistry: 'Биохимия крови',
  thyroid: 'Щитовидная железа',
  hormones: 'Гормоны',
  vitamins: 'Витамины и микроэлементы',
  coagulation: 'Коагулограмма',
  urinalysis: 'Общий анализ мочи',
  lipid: 'Липидный профиль',
  immunology: 'Иммунология',
  other: 'Другое исследование',
}

function ruType(code: string): string {
  return ANALYSIS_TYPE_RU[code.trim()] ?? code.trim()
}

/**
 * Подпись типа анализа по-русски: массив кодов → «Общий анализ крови, Биохимия»,
 * строка-код → русское название; пусто → '' (фолбэк задаёт вызывающий код).
 */
export function analysisTypeLabel(types: string | string[] | null | undefined): string {
  if (Array.isArray(types)) {
    const names = Array.from(new Set(types.filter(Boolean).map(ruType)))
    return names.join(', ')
  }
  if (typeof types === 'string' && types.trim()) return ruType(types)
  return ''
}

/**
 * Осмысленное имя анализа для списков и заголовков: «что за анализ», а не номер.
 * Приоритет: распознанные типы → выбранный вручную тип → название лаборатории →
 * «Анализ #N» (когда тип ещё не определён — на этапе обработки/ошибки).
 */
export function analysisName(a: {
  id: number
  detectedTypes?: string[] | null
  analysisType?: string | null
  labName?: string | null
}): string {
  const types = (a.detectedTypes ?? []).filter(Boolean)
  if (types.length > 0) {
    const names = Array.from(new Set(types.map(ruType)))
    return names.length <= 2 ? names.join(', ') : `${names.slice(0, 2).join(', ')} +${names.length - 2}`
  }
  if (a.analysisType) return ruType(a.analysisType)
  if (a.labName && a.labName.trim()) return a.labName.trim()
  return `Анализ #${a.id}`
}

/**
 * Прогрессивная маска РФ-телефона для инпута: «9161234567» → «+7 (916) 123-45-67».
 * Ведущие 7/8 отбрасываются, максимум 10 значащих цифр. Бэкенд нормализует сам —
 * маска только для удобства ввода.
 */
export function formatPhoneInput(raw: string): string {
  let d = raw.replace(/\D/g, '')
  if (d.startsWith('7') || d.startsWith('8')) d = d.slice(1)
  d = d.slice(0, 10)
  if (d.length === 0) return ''
  let out = `+7 (${d.slice(0, 3)}`
  if (d.length >= 4) out += `) ${d.slice(3, 6)}`
  if (d.length >= 7) out += `-${d.slice(6, 8)}`
  if (d.length >= 9) out += `-${d.slice(8, 10)}`
  return out
}

/** 10 значащих цифр РФ-номера введены полностью */
export function isPhoneComplete(masked: string): boolean {
  let d = masked.replace(/\D/g, '')
  if (d.startsWith('7') || d.startsWith('8')) d = d.slice(1)
  return d.length === 10
}
