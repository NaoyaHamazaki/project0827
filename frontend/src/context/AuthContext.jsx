import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { fetchMe, login as loginRequest } from '../api/auth'
import { getTokens, setTokens } from '../api/client'

const AuthContext = createContext(null)

// 最後にログインした画面（管理者用／会員用）。ログアウト後や期限切れ時に同じ画面へ戻すため
const PORTAL_KEY = 'reception_login_portal'

export function loginPathForLastPortal() {
  try {
    return localStorage.getItem(PORTAL_KEY) === 'staff' ? '/staff/login' : '/login'
  } catch {
    return '/login'
  }
}

export function AuthProvider({ children }) {
  const [staff, setStaff] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const tokens = getTokens()
    if (!tokens?.access) {
      setIsLoading(false)
      return
    }
    fetchMe()
      .then(setStaff)
      .catch(() => setTokens(null))
      .finally(() => setIsLoading(false))
  }, [])

  const login = async (email, password, portal) => {
    const data = await loginRequest(email, password, portal)
    try { localStorage.setItem(PORTAL_KEY, portal || 'member') } catch { /* 保存できなくてもログイン自体は続行 */ }
    setTokens({ access: data.access, refresh: data.refresh })
    setStaff(data.staff)
    return data.staff
  }

  const logout = () => {
    setTokens(null)
    setStaff(null)
  }

  const refreshStaff = async () => {
    const data = await fetchMe()
    setStaff(data)
    return data
  }

  const value = useMemo(
    () => ({
      staff,
      isLoading,
      isAuthenticated: Boolean(staff),
      // マスターは管理者画面を閲覧のみ可能（変更系はサーバー側で拒否される）
      isAdmin: staff?.role === 'admin' || staff?.role === 'master',
      isMaster: staff?.role === 'master',
      isRepresentative: staff?.role === 'representative',
      login,
      logout,
      refreshStaff,
    }),
    [staff, isLoading]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
