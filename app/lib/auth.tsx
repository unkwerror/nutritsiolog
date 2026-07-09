'use client'

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react'
import { apiRequest, setAccessToken, clearAccessToken } from './api'

type User = {
  id: string
  // null у пользователей, зарегистрированных по телефону без email
  email: string | null
  firstName: string | null
  lastName: string | null
}

type AuthContextValue = {
  user: User | null
  isLoading: boolean
  setUserAfterLogin: (user: User, token: string) => void
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    apiRequest<User>('/api/v1/users/me')
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setIsLoading(false))
  }, [])

  const setUserAfterLogin = useCallback((u: User, token: string) => {
    setAccessToken(token)
    setUser(u)
  }, [])

  const logout = useCallback(async () => {
    await apiRequest('/api/v1/auth/logout', { method: 'POST' }).catch(() => {})
    clearAccessToken()
    setUser(null)
    window.location.href = '/'
  }, [])

  return (
    <AuthContext.Provider value={{ user, isLoading, setUserAfterLogin, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
