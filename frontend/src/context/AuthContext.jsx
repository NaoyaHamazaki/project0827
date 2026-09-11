import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { fetchMe, login as loginRequest } from '../api/auth'
import { getTokens, setTokens } from '../api/client'

const AuthContext = createContext(null)

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

  const login = async (email, password) => {
    const data = await loginRequest(email, password)
    setTokens({ access: data.access, refresh: data.refresh })
    setStaff(data.staff)
    return data.staff
  }

  const logout = () => {
    setTokens(null)
    setStaff(null)
  }

  const value = useMemo(
    () => ({
      staff,
      isLoading,
      isAuthenticated: Boolean(staff),
      isAdmin: staff?.role === 'admin',
      login,
      logout,
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
