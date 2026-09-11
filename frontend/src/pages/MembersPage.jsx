import { useEffect, useMemo, useState } from 'react'
import { Plus, Search, Pencil, Trash2, BarChart2, Wand2 } from 'lucide-react'
import DataTable from '../components/DataTable'
import Modal from '../components/Modal'
import StatusBadge from '../components/StatusBadge'
import { useLanguage } from '../context/LanguageContext'
import { useToast } from '../context/ToastContext'
import {
  createMember,
  deleteMember,
  fetchMemberUsage,
  fetchPlans,
  listMembers,
  updateMember,
} from '../api/members'
import './MembersPage.css'

const EMPTY_FORM = { name: '', company_name: '', card_identifier: '', status: 'active', plan: '' }

function formatDateTime(isoString, language) {
  return new Date(isoString).toLocaleString(language === 'en' ? 'en-US' : 'ja-JP', {
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  })
}

function currentYearMonth() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function MemberUsageModal({ member, onClose }) {
  const { t, language } = useLanguage()
  const { showToast } = useToast()
  const [yearMonth, setYearMonth] = useState(currentYearMonth())
  const [usage, setUsage] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const [year, month] = yearMonth.split('-').map(Number)
    setIsLoading(true)
    fetchMemberUsage(member.id, { year, month })
      .then(setUsage)
      .catch(() => showToast(t('利用状況の取得に失敗しました'), 'error'))
      .finally(() => setIsLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [yearMonth, member.id])

  const sessionColumns = [
    { key: 'check_in', header: t('入室'), render: (row) => formatDateTime(row.check_in, language) },
    {
      key: 'check_out',
      header: t('退室'),
      render: (row) => (row.is_ongoing ? <span className="members-usage__ongoing">{t('在室中')}</span> : formatDateTime(row.check_out, language)),
    },
    { key: 'duration_hours', header: t('滞在時間'), render: (row) => `${row.duration_hours}h` },
  ]

  return (
    <Modal title={language === 'en' ? `${member.name}'s Usage` : `${member.name} さんの利用状況`} onClose={onClose}>
      <div className="members-usage">
        <div className="field members-usage__month">
          <label htmlFor="usage-month">{t('対象年月')}</label>
          <input
            id="usage-month"
            type="month"
            value={yearMonth}
            onChange={(event) => setYearMonth(event.target.value)}
          />
        </div>

        {isLoading || !usage ? (
          <p className="members-page__loading">{t('読み込み中…')}</p>
        ) : (
          <>
            <div className="members-usage__summary">
              <div className="members-usage__stat">
                <span className="members-usage__stat-label">{t('来場回数')}</span>
                <span className="members-usage__stat-value">
                  {language === 'en' ? `${usage.visit_count}` : `${usage.visit_count}回`}
                </span>
              </div>
              <div className="members-usage__stat">
                <span className="members-usage__stat-label">{t('滞在時間合計')}</span>
                <span className="members-usage__stat-value">{usage.used_hours}h</span>
              </div>
              <div className="members-usage__stat">
                <span className="members-usage__stat-label">{t('プラン')}</span>
                <span className="members-usage__stat-value">{usage.plan_name || t('未設定')}</span>
              </div>
              <div className="members-usage__stat">
                <span className="members-usage__stat-label">{t('上限 / 残り')}</span>
                <span className="members-usage__stat-value">
                  {usage.limit_hours == null
                    ? t('無制限')
                    : language === 'en'
                      ? `${usage.limit_hours}h / ${usage.remaining_hours}h remaining`
                      : `${usage.limit_hours}h / 残り${usage.remaining_hours}h`}
                </span>
              </div>
            </div>

            <DataTable
              columns={sessionColumns}
              rows={usage.sessions}
              rowKey={(row) => row.check_in}
              emptyMessage={t('この月の来場記録はありません')}
            />
          </>
        )}
      </div>
    </Modal>
  )
}

export default function MembersPage() {
  const { t, language } = useLanguage()
  const { showToast } = useToast()
  const [members, setMembers] = useState([])
  const [plans, setPlans] = useState([])
  const [query, setQuery] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [editingMember, setEditingMember] = useState(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [formError, setFormError] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [usageMember, setUsageMember] = useState(null)

  const loadMembers = async (searchQuery = '') => {
    setIsLoading(true)
    try {
      const data = await listMembers(searchQuery)
      setMembers(data)
    } catch {
      showToast(t('会員一覧の取得に失敗しました'), 'error')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadMembers()
    fetchPlans().then(setPlans).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => loadMembers(query), 300)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])

  const openCreateModal = () => {
    setEditingMember(null)
    setForm(EMPTY_FORM)
    setFormError('')
    setIsModalOpen(true)
  }

  const openEditModal = (member) => {
    setEditingMember(member)
    setForm({
      name: member.name,
      company_name: member.company_name,
      card_identifier: member.card_identifier,
      status: member.status,
      plan: member.plan ?? '',
    })
    setFormError('')
    setIsModalOpen(true)
  }

  const closeModal = () => setIsModalOpen(false)

  const handleAutoAssignCardId = async () => {
    try {
      const allMembers = await listMembers()
      const numericIds = allMembers.map((m) => m.card_identifier).filter((id) => /^\d+$/.test(id))
      if (numericIds.length === 0) {
        setForm((current) => ({ ...current, card_identifier: '0001' }))
        return
      }
      const maxId = numericIds.reduce((max, id) => (Number(id) > Number(max) ? id : max))
      const nextId = String(Number(maxId) + 1).padStart(maxId.length, '0')
      setForm((current) => ({ ...current, card_identifier: nextId }))
    } catch {
      showToast(t('カードIDの自動採番に失敗しました'), 'error')
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setFormError('')
    setIsSaving(true)
    const payload = { ...form, plan: form.plan === '' ? null : form.plan }
    try {
      if (editingMember) {
        await updateMember(editingMember.id, payload)
        showToast(t('会員情報を更新しました'))
      } else {
        await createMember(payload)
        showToast(t('会員を登録しました'))
      }
      setIsModalOpen(false)
      loadMembers(query)
    } catch (error) {
      const detail = error.response?.data?.card_identifier?.[0]
      setFormError(detail || t('保存に失敗しました。入力内容をご確認ください。'))
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (member) => {
    const confirmMessage = language === 'en' ? `Delete ${member.name}?` : `${member.name} さんを削除しますか？`
    if (!window.confirm(confirmMessage)) return
    try {
      await deleteMember(member.id)
      showToast(t('会員を削除しました'))
      loadMembers(query)
    } catch {
      showToast(t('削除に失敗しました'), 'error')
    }
  }

  const columns = useMemo(
    () => [
      { key: 'name', header: t('氏名') },
      { key: 'company_name', header: t('所属企業'), render: (row) => row.company_name || '—' },
      { key: 'card_identifier', header: t('カードID') },
      {
        key: 'plan',
        header: t('プラン'),
        render: (row) => row.plan_detail?.name || t('未設定'),
      },
      { key: 'status', header: t('ステータス'), render: (row) => <StatusBadge status={row.status} /> },
      {
        key: 'actions',
        header: '',
        width: 120,
        render: (row) => (
          <div className="members-page__row-actions">
            <button
              type="button"
              className="icon-btn"
              onClick={() => setUsageMember(row)}
              aria-label={t('利用状況')}
            >
              <BarChart2 size={16} />
            </button>
            <button type="button" className="icon-btn" onClick={() => openEditModal(row)} aria-label={t('編集')}>
              <Pencil size={16} />
            </button>
            <button type="button" className="icon-btn icon-btn--danger" onClick={() => handleDelete(row)} aria-label={t('削除')}>
              <Trash2 size={16} />
            </button>
          </div>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [query, language]
  )

  return (
    <div className="members-page">
      <div className="members-page__header">
        <div>
          <h1>{t('会員管理')}</h1>
          <p>{t('会員情報の登録・編集とカードIDの紐付けを行います')}</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={openCreateModal}>
          <Plus size={16} />
          {t('新規登録')}
        </button>
      </div>

      <div className="members-page__search">
        <Search size={16} />
        <input
          type="text"
          placeholder={t('氏名・企業名で検索')}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      {isLoading ? (
        <p className="members-page__loading">{t('読み込み中…')}</p>
      ) : (
        <DataTable
          columns={columns}
          rows={members}
          rowKey={(row) => row.id}
          emptyMessage={t('該当する会員がいません')}
          mobileCompact
        />
      )}

      {isModalOpen && (
        <Modal title={editingMember ? t('会員情報を編集') : t('会員を新規登録')} onClose={closeModal}>
          <form className="members-form" onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="member-name">{t('氏名')}</label>
              <input
                id="member-name"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="member-company">{t('所属企業・テナント名')}</label>
              <input
                id="member-company"
                value={form.company_name}
                onChange={(event) => setForm({ ...form, company_name: event.target.value })}
              />
            </div>
            <div className="field">
              <div className="members-form__label-row">
                <label htmlFor="member-card">{t('バーコード / ICカードID')}</label>
                <button type="button" className="members-form__autofill" onClick={handleAutoAssignCardId}>
                  <Wand2 size={13} />
                  {t('最大値+1を入力')}
                </button>
              </div>
              <input
                id="member-card"
                value={form.card_identifier}
                onChange={(event) => setForm({ ...form, card_identifier: event.target.value })}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="member-plan">{t('プラン')}</label>
              <select
                id="member-plan"
                value={form.plan}
                onChange={(event) => setForm({ ...form, plan: event.target.value })}
              >
                <option value="">{t('未設定（上限なし）')}</option>
                {plans.map((plan) => {
                  const suffix = plan.monthly_hour_limit != null
                    ? (language === 'en' ? ` (${plan.monthly_hour_limit}h/month)` : `（月${plan.monthly_hour_limit}h）`)
                    : (language === 'en' ? ' (unlimited)' : '（無制限）')
                  return (
                    <option key={plan.id} value={plan.id}>
                      {plan.name}{suffix}
                    </option>
                  )
                })}
              </select>
            </div>
            <div className="field">
              <label htmlFor="member-status">{t('ステータス')}</label>
              <select
                id="member-status"
                value={form.status}
                onChange={(event) => setForm({ ...form, status: event.target.value })}
              >
                <option value="active">{t('有効')}</option>
                <option value="inactive">{t('無効')}</option>
              </select>
            </div>

            {formError && <p className="members-form__error">{formError}</p>}

            <div className="members-form__actions">
              <button type="button" className="btn btn-secondary" onClick={closeModal}>
                {t('キャンセル')}
              </button>
              <button type="submit" className="btn btn-primary" disabled={isSaving}>
                {isSaving ? t('保存中…') : t('保存する')}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {usageMember && <MemberUsageModal member={usageMember} onClose={() => setUsageMember(null)} />}
    </div>
  )
}
