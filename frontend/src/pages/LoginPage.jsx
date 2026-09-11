import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { LogIn } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { LANGUAGE_TOGGLE_ENABLED, useLanguage } from '../context/LanguageContext'
import './LoginPage.css'

const QUICK_LOGIN_ACCOUNTS = [
  { label: '管理者', email: 'admin@example.com', password: 'adminpass123' },
  { label: 'ユーザー', email: 'operator@example.com', password: 'operatorpass123' },
]

export default function LoginPage() {
  const { login, isAuthenticated } = useAuth()
  const { language, setLanguage, t } = useLanguage()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (isAuthenticated) {
    const from = location.state?.from?.pathname || '/'
    return <Navigate to={from} replace />
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setIsSubmitting(true)
    try {
      await login(email, password)
      navigate('/', { replace: true })
    } catch {
      setError(t('メールアドレスまたはパスワードが正しくありません。'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="login">
      <form className="login__card" onSubmit={handleSubmit}>
        {LANGUAGE_TOGGLE_ENABLED && (
          <div className="login__lang-toggle" role="group" aria-label="Language">
            <button
              type="button"
              className={`login__lang-btn ${language === 'ja' ? 'is-active' : ''}`}
              onClick={() => setLanguage('ja')}
            >
              JA
            </button>
            <button
              type="button"
              className={`login__lang-btn ${language === 'en' ? 'is-active' : ''}`}
              onClick={() => setLanguage('en')}
            >
              EN
            </button>
          </div>
        )}

        <h1 className="login__title">{t('受付・入退室管理システム')}</h1>

        <div className="field">
          <label htmlFor="email">{t('メールアドレス')}</label>
          <input
            id="email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            autoFocus
          />
        </div>

        <div className="field">
          <label htmlFor="password">{t('パスワード')}</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </div>

        {error && <p className="login__error">{error}</p>}

        <button type="submit" className="btn btn-primary login__submit" disabled={isSubmitting}>
          <LogIn size={16} />
          {isSubmitting ? t('ログイン中…') : t('ログイン')}
        </button>

        <div className="login__quick">
          <span className="login__quick-label">{t('クイックログイン（開発用・一時的）')}</span>
          <div className="login__quick-buttons">
            {QUICK_LOGIN_ACCOUNTS.map((account) => (
              <button
                key={account.email}
                type="button"
                className="btn btn-secondary login__quick-btn"
                onClick={() => {
                  setEmail(account.email)
                  setPassword(account.password)
                }}
              >
                {t(account.label)}
              </button>
            ))}
          </div>
        </div>
      </form>
    </div>
  )
}
