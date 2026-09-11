import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { en } from '../i18n/en'
import { updateLanguage as updateLanguageRequest } from '../api/auth'
import { useAuth } from './AuthContext'

const LanguageContext = createContext(null)
const STORAGE_KEY = 'reception_language'

// 英語表示切替はいったんオフ。無効な間は、過去に保存された'en'（localStorageやアカウント設定）が
// 残っていても常に日本語表示に固定する（Layout.jsx / LoginPage.jsxのトグルボタン非表示と対にする設定）
export const LANGUAGE_TOGGLE_ENABLED = false

export function LanguageProvider({ children }) {
  const { staff, isAuthenticated } = useAuth()
  const [language, setLanguageState] = useState(() => {
    if (!LANGUAGE_TOGGLE_ENABLED) return 'ja'
    return localStorage.getItem(STORAGE_KEY) || 'ja'
  })

  useEffect(() => {
    if (!LANGUAGE_TOGGLE_ENABLED) return
    if (staff?.language && staff.language !== language) {
      setLanguageState(staff.language)
      localStorage.setItem(STORAGE_KEY, staff.language)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staff])

  const setLanguage = useCallback(
    async (lang) => {
      if (!LANGUAGE_TOGGLE_ENABLED) return
      setLanguageState(lang)
      localStorage.setItem(STORAGE_KEY, lang)
      if (isAuthenticated) {
        try {
          await updateLanguageRequest(lang)
        } catch {
          // サーバー保存に失敗しても、ローカルの表示は継続させる
        }
      }
    },
    [isAuthenticated]
  )

  const t = useCallback(
    (text) => {
      if (language === 'en') return en[text] ?? text
      return text
    },
    [language]
  )

  const value = useMemo(() => ({ language, setLanguage, t }), [language, setLanguage, t])

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider')
  }
  return context
}
