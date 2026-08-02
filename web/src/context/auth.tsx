import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { api } from '../lib/api'
import type { User } from '../lib/types'

interface AuthValue {
  user: User | null
  login: (identifier: string, password: string) => Promise<User>
  logout: () => void
  isStaff: boolean
  isAdmin: boolean
}

const AuthContext = createContext<AuthValue>(null as unknown as AuthValue)

const stored = (): User | null => {
  try {
    const raw = localStorage.getItem('sembung_user')
    return raw ? (JSON.parse(raw) as User) : null
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(stored)

  const login = useCallback(async (identifier: string, password: string) => {
    const { data } = await api.post('/auth/login', { identifier, password })
    const account = data.data.user as User
    if (account.role === 'VISITOR') {
      throw new Error('Akun pengunjung tidak memiliki akses back office')
    }
    localStorage.setItem('sembung_token', data.data.token)
    localStorage.setItem('sembung_user', JSON.stringify(account))
    setUser(account)
    return account
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('sembung_token')
    localStorage.removeItem('sembung_user')
    setUser(null)
  }, [])

  const value = useMemo(
    () => ({
      user,
      login,
      logout,
      isStaff: !!user && user.role !== 'VISITOR',
      isAdmin: user?.role === 'ADMIN',
    }),
    [user, login, logout]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext)
