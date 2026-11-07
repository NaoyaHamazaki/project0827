import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { CheckCircle2, UserPlus } from 'lucide-react'
import { fetchInviteStatus, fetchPublicPlans, submitInviteRegistration } from '../api/members'
import { useLanguage } from '../context/LanguageContext'
import './RegisterPage.css'

const EMPTY_FORM = {
  name: '', company_name: '', email: '', plan: '', card_identifier: '', password: '', confirm: '',
}

export default function RegisterPage() {
  const { token } = useParams()
  const navigate = useNavigate()
  const { t } = useLanguage()
  const [status, setStatus] = useState('checking') // checking | ready | invalid | done
  const [plans, setPlans] = useState([])
  const [form, setForm] = useState(EMPTY_FORM)
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    Promise.all([fetchInviteStatus(token), fetchPublicPlans()])
      .then(([invite, planList]) => {
        setPlans(planList)
        setStatus(invite.valid ? 'ready' : 'invalid')
      })
      .catch(() => setStatus('invalid'))
  }, [token])

  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }))

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    if (form.password !== form.confirm) {
      setError(t('パスワードが一致しません'))
      return
    }
    setIsSubmitting(true)
    try {
      await submitInviteRegistration(token, {
        name: form.name,
        company_name: form.company_name,
        email: form.email,
        plan: form.plan || null,
        card_identifier: form.card_identifier,
        password: form.password,
      })
      setStatus('done')
    } catch (err) {
      const data = err?.response?.data
      if (err?.response?.status === 410) {
        setStatus('invalid')
      } else {
        setError(data?.email?.[0] || data?.card_identifier?.[0] || data?.password?.[0] || t('登録に失敗しました'))
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  if (status === 'checking') {
    return <div className="register-page"><p className="register-page__status">{t('確認中…')}</p></div>
  }

  if (status === 'invalid') {
    return (
      <div className="register-page">
        <div className="register-page__card register-page__card--center">
          <h1>{t('このリンクはご利用いただけません')}</h1>
          <p>{t('有効期限切れ、または既にご登録済みの可能性があります。担当者に新しいリンクの発行をご依頼ください。')}</p>
        </div>
      </div>
    )
  }

  if (status === 'done') {
    return (
      <div className="register-page">
        <div className="register-page__card register-page__card--center">
          <CheckCircle2 size={40} strokeWidth={1.5} className="register-page__done-icon" />
          <h1>{t('登録が完了しました')}</h1>
          <p>{t('登録したメールアドレスとパスワードでログインしてください。')}</p>
          <button type="button" className="btn btn-primary" onClick={() => navigate('/login')}>
            {t('ログイン画面へ')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="register-page">
      <form className="register-page__card" onSubmit={handleSubmit}>
        <div className="register-page__header">
          <UserPlus size={28} strokeWidth={1.5} />
          <h1>{t('会員登録')}</h1>
          <p>{t('ご自身の情報を入力してください')}</p>
        </div>

        {error && <p className="register-page__error">{error}</p>}

        <div className="field">
          <label htmlFor="rg-name">{t('氏名')}</label>
          <input id="rg-name" value={form.name} onChange={set('name')} required autoFocus />
        </div>
        <div className="field">
          <label htmlFor="rg-company">{t('所属企業名')}</label>
          <input id="rg-company" value={form.company_name} onChange={set('company_name')} />
        </div>
        <div className="field">
          <label htmlFor="rg-email">{t('メールアドレス')}</label>
          <input id="rg-email" type="email" value={form.email} onChange={set('email')} required />
        </div>
        <div className="field">
          <label htmlFor="rg-plan">{t('プラン')}</label>
          <select id="rg-plan" value={form.plan} onChange={set('plan')}>
            <option value="">{t('未設定')}</option>
            {plans.map((plan) => (
              <option key={plan.id} value={plan.id}>{plan.name}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="rg-card">{t('カードID（お持ちの場合のみ）')}</label>
          <input id="rg-card" value={form.card_identifier} onChange={set('card_identifier')} />
        </div>
        <div className="field">
          <label htmlFor="rg-password">{t('パスワード')}</label>
          <input id="rg-password" type="password" value={form.password} onChange={set('password')} required />
        </div>
        <div className="field">
          <label htmlFor="rg-confirm">{t('パスワード（確認）')}</label>
          <input id="rg-confirm" type="password" value={form.confirm} onChange={set('confirm')} required />
        </div>

        <button type="submit" className="btn btn-primary register-page__submit" disabled={isSubmitting}>
          {isSubmitting ? t('登録中…') : t('登録する')}
        </button>
      </form>
    </div>
  )
}
