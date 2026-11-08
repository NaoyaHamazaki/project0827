import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ClipboardEdit, Copy, QrCode, Wand2 } from 'lucide-react'
import { fetchPlans, registerMemberByAdmin } from '../api/members'
import Modal from '../components/Modal'
import InviteLinkModal from '../components/InviteLinkModal'
import { useLanguage } from '../context/LanguageContext'
import { useToast } from '../context/ToastContext'
import './MemberCreatePage.css'

const EMPTY_FORM = {
  name: '', company_name: '', email: '', plan: '', card_identifier: '', password: '',
}

function generateCardId() {
  return `C-${Math.random().toString(36).slice(2, 10).toUpperCase()}`
}

function generatePassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
  let out = ''
  for (let i = 0; i < 10; i += 1) out += chars[Math.floor(Math.random() * chars.length)]
  return out
}

function AdminFormModal({ plans, onClose, onCreated }) {
  const { t } = useLanguage()
  const { showToast } = useToast()
  const [form, setForm] = useState(EMPTY_FORM)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')

  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }))

  const handleSubmit = async (event) => {
    event.preventDefault()
    const message = t('以下の内容で会員を登録します。よろしいですか？')
      + `\n\n${t('氏名')}: ${form.name}\n${t('所属企業名')}: ${form.company_name}\n${t('メールアドレス')}: ${form.email}`
    if (!window.confirm(message)) return

    setError('')
    setIsSaving(true)
    try {
      await registerMemberByAdmin({
        name: form.name,
        company_name: form.company_name,
        email: form.email,
        plan: form.plan || null,
        card_identifier: form.card_identifier,
        password: form.password,
      })
      showToast(t('会員を登録しました'))
      onCreated()
    } catch (err) {
      const data = err?.response?.data || {}
      setError(data.email?.[0] || data.card_identifier?.[0] || data.password?.[0] || t('登録に失敗しました'))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Modal title={t('フォームに入力')} onClose={onClose}>
      <form className="settings-form" onSubmit={handleSubmit}>
        {error && <p className="settings-page__form-error">{error}</p>}
        <div className="field">
          <label htmlFor="mc-name">{t('氏名')}</label>
          <input id="mc-name" value={form.name} onChange={set('name')} required autoFocus />
        </div>
        <div className="field">
          <label htmlFor="mc-company">{t('所属企業名')}</label>
          <input id="mc-company" value={form.company_name} onChange={set('company_name')} />
        </div>
        <div className="field">
          <label htmlFor="mc-email">{t('メールアドレス')}</label>
          <input id="mc-email" type="email" value={form.email} onChange={set('email')} required />
        </div>
        <div className="field">
          <label htmlFor="mc-plan">{t('プラン')}</label>
          <select id="mc-plan" value={form.plan} onChange={set('plan')}>
            <option value="">{t('未設定')}</option>
            {plans.map((plan) => (
              <option key={plan.id} value={plan.id}>{plan.name}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="mc-card">{t('カードID')}</label>
          <div className="member-create-page__input-with-btn">
            <input id="mc-card" value={form.card_identifier} onChange={set('card_identifier')} />
            <button
              type="button" className="btn btn-secondary"
              onClick={() => setForm((c) => ({ ...c, card_identifier: generateCardId() }))}
            >
              <Wand2 size={14} />
              {t('自動設定')}
            </button>
          </div>
        </div>
        <div className="field">
          <label htmlFor="mc-password">{t('パスワード')}</label>
          <div className="member-create-page__input-with-btn">
            <input id="mc-password" value={form.password} onChange={set('password')} required />
            <button
              type="button" className="btn btn-secondary"
              onClick={() => setForm((c) => ({ ...c, password: generatePassword() }))}
            >
              <Wand2 size={14} />
              {t('初期パスワード設定')}
            </button>
          </div>
        </div>

        <div className="members-form__actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>{t('キャンセル')}</button>
          <button type="submit" className="btn btn-primary" disabled={isSaving}>
            {isSaving ? t('登録中…') : t('登録')}
          </button>
        </div>
      </form>
    </Modal>
  )
}

export default function MemberCreatePage() {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const [plans, setPlans] = useState([])
  const [activeModal, setActiveModal] = useState(null)

  useEffect(() => {
    fetchPlans().then(setPlans).catch(() => setPlans([]))
  }, [])

  return (
    <div className="member-create-page">
      <h1>{t('新規会員作成')}</h1>
      <p className="member-create-page__desc">{t('登録方法を選んでください')}</p>

      <div className="member-create-page__grid">
        <button type="button" className="member-create-page__card" onClick={() => setActiveModal('form')}>
          <ClipboardEdit size={32} strokeWidth={1.5} />
          <span>{t('フォームに入力')}</span>
          <small>{t('管理者が会員情報を入力して登録します')}</small>
        </button>
        <button type="button" className="member-create-page__card" onClick={() => setActiveModal('qr')}>
          <QrCode size={32} strokeWidth={1.5} />
          <span>{t('QR表示')}</span>
          <small>{t('代表者のスマホで読み取ってもらい、所属と本人情報を入力してもらいます')}</small>
        </button>
        <button type="button" className="member-create-page__card" onClick={() => setActiveModal('url')}>
          <Copy size={32} strokeWidth={1.5} />
          <span>{t('URLをコピー')}</span>
          <small>{t('メールなどで代表者に送って入力してもらいます')}</small>
        </button>
      </div>

      {activeModal === 'form' && (
        <AdminFormModal
          plans={plans}
          onClose={() => setActiveModal(null)}
          onCreated={() => { setActiveModal(null); navigate('/members') }}
        />
      )}
      {(activeModal === 'qr' || activeModal === 'url') && (
        <InviteLinkModal mode={activeModal} targetLabel="ユーザー（代表）" onClose={() => setActiveModal(null)} />
      )}
    </div>
  )
}
