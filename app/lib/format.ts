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

/**
 * Подпись типа анализа: массив типов → «cbc, liver», строка → как есть (trim),
 * пусто → '' — фолбэк («Анализ #N», «тип не определён») задаёт вызывающий код.
 */
export function analysisTypeLabel(types: string | string[] | null | undefined): string {
  if (Array.isArray(types)) return types.join(', ')
  if (typeof types === 'string') return types.trim()
  return ''
}
