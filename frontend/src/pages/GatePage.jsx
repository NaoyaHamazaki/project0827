import { useState } from 'react'
import { KeyRound } from 'lucide-react'
import { verifyGatePassword } from '../api/auth'
import './LoginPage.css'

const GATE_PASSED_KEY = 'demo_gate_passed'

export function isGatePassed() {
  return localStorage.getItem(GATE_PASSED_KEY) === '1'
}

export default function GatePage({ onPassed }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setIsSubmitting(true)
    try {
      const { success } = await verifyGatePassword(password)
      if (success) {
        localStorage.setItem(GATE_PASSED_KEY, '1')
        onPassed()
      } else {
        setError('パスワードが正しくありません。')
      }
    } catch {
      setError('パスワードが正しくありません。')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="login">
      <form className="login__card" onSubmit={handleSubmit}>
        <h1 className="login__title">受付・入退室管理システム</h1>
        <p className="login__subtitle">デモ公開中のため、パスワードを入力してください</p>

        <div className="field">
          <label htmlFor="gate-password">パスワード</label>
          <input
            id="gate-password"
            type="password"
            autoComplete="off"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            autoFocus
          />
        </div>

        {error && <p className="login__error">{error}</p>}

        <button type="submit" className="btn btn-primary login__submit" disabled={isSubmitting}>
          <KeyRound size={16} />
          {isSubmitting ? '確認中…' : '進む'}
        </button>
      </form>
    </div>
  )
}
