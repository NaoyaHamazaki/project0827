import { useEffect, useMemo, useState } from 'react'
import { Plus, Pencil } from 'lucide-react'
import DataTable from '../components/DataTable'
import Modal from '../components/Modal'
import StatusBadge from '../components/StatusBadge'
import { useLanguage } from '../context/LanguageContext'
import { useToast } from '../context/ToastContext'
import { createSecurityCard, listSecurityCards, updateSecurityCard } from '../api/cards'
import './SecurityCardsPage.css'

const EMPTY_FORM = { card_number: '', status: 'available' }

function formatDateTime(isoString, language) {
  return new Date(isoString).toLocaleString(language === 'en' ? 'en-US' : 'ja-JP', {
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  })
}

function CardFormModal({ card, onClose, onSaved }) {
  const { t } = useLanguage()
  const { showToast } = useToast()
  const isEditing = Boolean(card)
  const [form, setForm] = useState(card ? { card_number: card.card_number, status: card.status } : EMPTY_FORM)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setIsSaving(true)
    try {
      if (isEditing) {
        await updateSecurityCard(card.id, form)
        showToast(t('カード情報を更新しました'))
      } else {
        await createSecurityCard(form)
        showToast(t('セキュリティカードを登録しました'))
      }
      onSaved()
    } catch (err) {
      const detail = err.response?.data?.card_number?.[0]
      setError(detail || t('保存に失敗しました。入力内容をご確認ください。'))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Modal title={isEditing ? t('カード情報を編集') : t('セキュリティカードを新規登録')} onClose={onClose}>
      <form className="members-form" onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="card-number">{t('カード番号')}</label>
          <input
            id="card-number"
            value={form.card_number}
            onChange={(event) => setForm({ ...form, card_number: event.target.value })}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="card-status">{t('ステータス')}</label>
          <select
            id="card-status"
            value={form.status}
            onChange={(event) => setForm({ ...form, status: event.target.value })}
          >
            <option value="available">{t('在庫')}</option>
            <option value="loaned">{t('貸出中')}</option>
            <option value="lost">{t('紛失')}</option>
            <option value="retired">{t('廃止')}</option>
          </select>
        </div>

        {error && <p className="members-form__error">{error}</p>}

        <div className="members-form__actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            {t('キャンセル')}
          </button>
          <button type="submit" className="btn btn-primary" disabled={isSaving}>
            {isSaving ? t('保存中…') : isEditing ? t('更新する') : t('登録する')}
          </button>
        </div>
      </form>
    </Modal>
  )
}

export default function SecurityCardsPage() {
  const { t, language } = useLanguage()
  const { showToast } = useToast()
  const [cards, setCards] = useState([])
  const [statusFilter, setStatusFilter] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingCard, setEditingCard] = useState(null)

  const load = async (status = statusFilter) => {
    setIsLoading(true)
    try {
      const data = await listSecurityCards(status ? { status } : {})
      setCards(data)
    } catch {
      showToast(t('カード一覧の取得に失敗しました'), 'error')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleFilterChange = (value) => {
    setStatusFilter(value)
    load(value)
  }

  const openCreateModal = () => {
    setEditingCard(null)
    setIsModalOpen(true)
  }

  const openEditModal = (card) => {
    setEditingCard(card)
    setIsModalOpen(true)
  }

  const handleSaved = () => {
    setIsModalOpen(false)
    setEditingCard(null)
    load()
  }

  const loanedCount = useMemo(() => cards.filter((card) => card.status === 'loaned').length, [cards])

  const columns = [
    { key: 'card_number', header: t('カード番号') },
    { key: 'status', header: t('ステータス'), render: (row) => <StatusBadge status={row.status} /> },
    {
      key: 'holder',
      header: t('現在の保持者'),
      render: (row) => {
        if (!row.current_holder) return '—'
        return (
          <span>
            {row.current_holder.member_name}
            <span className="cards-page__holder-time">
              {' '}
              ({formatDateTime(row.current_holder.issued_at, language)}〜)
            </span>
          </span>
        )
      },
    },
    {
      key: 'actions',
      header: '',
      width: 60,
      render: (row) => (
        <button type="button" className="icon-btn" onClick={() => openEditModal(row)} aria-label={t('編集')}>
          <Pencil size={16} />
        </button>
      ),
    },
  ]

  return (
    <div className="cards-page">
      <div className="cards-page__header">
        <div>
          <h1>{t('セキュリティカード管理')}</h1>
          <p>{t('貸出用セキュリティカードの台帳です。現在の貸出状況を確認できます。')}</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={openCreateModal}>
          <Plus size={16} />
          {t('新規登録')}
        </button>
      </div>

      <div className="cards-page__toolbar">
        <span className="cards-page__count">
          {language === 'en' ? `${loanedCount} card(s) currently loaned out` : `現在 ${loanedCount} 枚が貸出中`}
        </span>
        <div className="cards-page__filter">
          <label htmlFor="card-status-filter">{t('ステータスで絞り込み')}</label>
          <select
            id="card-status-filter"
            value={statusFilter}
            onChange={(event) => handleFilterChange(event.target.value)}
          >
            <option value="">{t('すべて')}</option>
            <option value="available">{t('在庫')}</option>
            <option value="loaned">{t('貸出中')}</option>
            <option value="lost">{t('紛失')}</option>
            <option value="retired">{t('廃止')}</option>
          </select>
        </div>
      </div>

      {isLoading ? (
        <p className="members-page__loading">{t('読み込み中…')}</p>
      ) : (
        <DataTable
          columns={columns}
          rows={cards}
          rowKey={(row) => row.id}
          emptyMessage={t('該当するカードがありません')}
          mobileCompact
        />
      )}

      {isModalOpen && (
        <CardFormModal card={editingCard} onClose={() => setIsModalOpen(false)} onSaved={handleSaved} />
      )}
    </div>
  )
}
