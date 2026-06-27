const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001'

type ApiError = { error?: { message?: string; code?: string } }

let _accessToken: string | null = null

export function setAccessToken(token: string) {
  _accessToken = token
  if (typeof window !== 'undefined') sessionStorage.setItem('accessToken', token)
}

export function clearAccessToken() {
  _accessToken = null
  if (typeof window !== 'undefined') sessionStorage.removeItem('accessToken')
}

export function getAccessToken(): string | null {
  if (_accessToken) return _accessToken
  if (typeof window !== 'undefined') {
    const stored = sessionStorage.getItem('accessToken')
    if (stored) { _accessToken = stored; return stored }
  }
  return null
}

async function doRefresh(): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/api/v1/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    })
    if (!res.ok) return false
    const data = (await res.json()) as { accessToken?: string }
    if (data.accessToken) { setAccessToken(data.accessToken); return true }
    return false
  } catch { return false }
}

// Single-flight refresh: the backend rotates the refresh token (deletes the old
// jti) on every call, so concurrent refreshes would burn each other's token and
// 401. Share one in-flight refresh between all callers that race on a 401.
let refreshInFlight: Promise<boolean> | null = null

function tryRefresh(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = doRefresh().finally(() => { refreshInFlight = null })
  }
  return refreshInFlight
}

export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
  _retried = false,
): Promise<T> {
  const token = getAccessToken()
  const headers: Record<string, string> = {}

  const isFormData = init.body instanceof FormData
  if (!isFormData) headers['Content-Type'] = 'application/json'
  if (token) headers['Authorization'] = `Bearer ${token}`
  if (init.headers) {
    Object.assign(headers, init.headers as Record<string, string>)
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers,
  })

  if (res.status === 401 && !_retried) {
    const ok = await tryRefresh()
    if (ok) return apiRequest<T>(path, init, true)
    clearAccessToken()
    if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/auth')) {
      window.location.href = '/auth'
    }
    throw new Error('Сессия истекла')
  }

  if (res.status === 204) return {} as T

  const data = await res.json()
  if (!res.ok) {
    const err = (data as ApiError).error
    throw new Error(err?.message ?? `HTTP ${res.status}`)
  }
  return data as T
}

/**
 * Like apiRequest but returns the raw Response — for binary downloads (PDF, etc.)
 * where we need the blob/headers, not JSON. Same refresh-on-401 behaviour.
 */
export async function apiFetch(path: string, init: RequestInit = {}, _retried = false): Promise<Response> {
  const token = getAccessToken()
  const headers: Record<string, string> = {}
  if (token) headers['Authorization'] = `Bearer ${token}`
  if (init.headers) Object.assign(headers, init.headers as Record<string, string>)

  const res = await fetch(`${API_URL}${path}`, { ...init, credentials: 'include', headers })

  if (res.status === 401 && !_retried) {
    const ok = await tryRefresh()
    if (ok) return apiFetch(path, init, true)
    clearAccessToken()
    throw new Error('Сессия истекла')
  }
  return res
}

export function buildSseUrl(path: string): string {
  return `${API_URL}${path}`
}

export const API_BASE = API_URL
