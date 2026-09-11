import { useEffect, useState } from 'react'
import { Download, ChevronLeft, ChevronRight, Plus, Trash2, Pencil, AlertTriangle } from 'lucide-react'
import DataTable from '../components/DataTable'
import Modal from '../components/Modal'
import StatusBadge from '../components/StatusBadge'
import { useLanguage } from '../context/LanguageContext'
import { useToast } from '../context/ToastContext'
import {
  createManualLog,
  deleteLog,
  downloadLogsCsv,
  fetchCurrentOccupants,
  fetchLogHistory,
  updateLog,
} from '../api/access'
import { listMembers } from '../api/members'
import './LogsPage.css'

const METHOD_LABELS = {
  card: 'バーコード/ICカード',
  pin: '番号入力',
  qr: 'QRコード',
  fingerprint: '指紋認証',
  phone: 'スマホ認証',
  manual: '手動入力（管理者）',
}

function formatDateTime(isoString, language) {
  return new Date(isoString).toLocaleString(language === 'en' ? 'en-US' : 'ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const STALE_CHECKIN_HOURS = 24

function hoursSince(isoString) {
  return (Date.now() - new Date(isoString).getTime()) / 3600000
}

function toDatetimeLocalValue(date) {
  const pad = (value) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function CurrentOccupantsTab() {
  const { t, language } = useLanguage()
  const { showToast } = useToast()
  const [occupants, setOccupants] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  const load = async () => {
    try {
      const data = await fetchCurrentOccupants()
      setOccupants(data)
    } catch {
      showToast(t('在室者一覧の取得に失敗しました'), 'error')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    load()
    const interval = setInterval(load, 15000)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const staleCount = occupants.filter((row) => hoursSince(row.checked_in_at) >= STALE_CHECKIN_HOURS).length

  const columns = [
    { key: 'name', header: t('氏名') },
    { key: 'company_name', header: t('所属企業'), render: (row) => row.company_name || '—' },
    {
      key: 'checked_in_at',
      header: t('入室時刻'),
      render: (row) => {
        const isStale = hoursSince(row.checked_in_at) >= STALE_CHECKIN_HOURS
        return (
          <span className="logs-page__checkin-cell">
            {formatDateTime(row.checked_in_at, language)}
            {isStale && (
              <span className="logs-page__stale-badge" title={t('24時間以上入室中のため、退室打刻漏れの可能性があります')}>
                <AlertTriangle size={13} />
                {language === 'en' ? '24h+' : '24h以上'}
              </span>
            )}
          </span>
        )
      },
    },
  ]

  return (
    <div className="logs-page__panel">
      <div className="logs-page__panel-header">
        <span className="logs-page__count">
          {language === 'en' ? `${occupants.length} currently checked in` : `現在 ${occupants.length} 名が在室中`}
        </span>
        {staleCount > 0 && (
          <span className="logs-page__stale-warning">
            <AlertTriangle size={14} />
            {language === 'en'
              ? `${staleCount} check-in(s) over 24h — possible missed check-out`
              : `24時間以上在室中が${staleCount}件あります（退室打刻漏れの可能性）`}
          </span>
        )}
      </div>
      {isLoading ? (
        <p className="logs-page__loading">{t('読み込み中…')}</p>
      ) : (
        <DataTable
          columns={columns}
          rows={occupants}
          rowKey={(row) => row.id}
          emptyMessage={t('現在、在室中の会員はいません')}
          rowClassName={(row) => (hoursSince(row.checked_in_at) >= STALE_CHECKIN_HOURS ? 'logs-page__row--stale' : '')}
        />
      )}
    </div>
  )
}

function ManualLogModal({ initialLog, onClose, onSaved }) {
  const { t } = useLanguage()
  const { showToast } = useToast()
  const isEditing = Boolean(initialLog)
  const [members, setMembers] = useState([])
  const [form, setForm] = useState(
    initialLog
      ? {
          member: initialLog.member.id,
          type: initialLog.type,
          timestamp: toDatetimeLocalValue(new Date(initialLog.created_at)),
        }
      : { member: '', type: 'check_in', timestamp: toDatetimeLocalValue(new Date()) }
  )
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    listMembers().then(setMembers).catch(() => {})
  }, [])

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!form.member) {
      setError(t('会員を選択してください'))
      return
    }
    setError('')
    setIsSaving(true)
    const payload = {
      member: form.member,
      type: form.type,
      timestamp: new Date(form.timestamp).toISOString(),
    }
    try {
      if (isEditing) {
        await updateLog(initialLog.id, payload)
        showToast(t('打刻ログを更新しました'))
      } else {
        await createManualLog(payload)
        showToast(t('打刻ログを追加しました'))
      }
      onSaved()
    } catch {
      setError(t('保存に失敗しました。入力内容をご確認ください。'))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Modal title={isEditing ? t('打刻ログを編集') : t('打刻ログを手動追加')} onClose={onClose}>
      <form className="members-form" onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="manual-log-member">{t('会員')}</label>
          <select
            id="manual-log-member"
            value={form.member}
            onChange={(event) => setForm({ ...form, member: event.target.value })}
            required
          >
            <option value="">{t('選択してください')}</option>
            {members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name}
                {member.company_name ? `（${member.company_name}）` : ''}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="manual-log-type">{t('種別')}</label>
          <select
            id="manual-log-type"
            value={form.type}
            onChange={(event) => setForm({ ...form, type: event.target.value })}
          >
            <option value="check_in">{t('入室')}</option>
            <option value="check_out">{t('退室')}</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="manual-log-timestamp">{t('日時')}</label>
          <input
            id="manual-log-timestamp"
            type="datetime-local"
            value={form.timestamp}
            onChange={(event) => setForm({ ...form, timestamp: event.target.value })}
            required
          />
        </div>

        {error && <p className="members-form__error">{error}</p>}

        <div className="members-form__actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            {t('キャンセル')}
          </button>
          <button type="submit" className="btn btn-primary" disabled={isSaving}>
            {isSaving ? t('保存中…') : isEditing ? t('更新する') : t('追加する')}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function HistoryTab() {
  const { t, language } = useLanguage()
  const { showToast } = useToast()
  const [filters, setFilters] = useState({ date_from: '', date_to: '', member: '', unreturned_card: false })
  const [page, setPage] = useState(1)
  const [logs, setLogs] = useState([])
  const [pageInfo, setPageInfo] = useState({ next: null, previous: null, count: 0 })
  const [isLoading, setIsLoading] = useState(true)
  const [isExporting, setIsExporting] = useState(false)
  const [isManualModalOpen, setIsManualModalOpen] = useState(false)
  const [editingLog, setEditingLog] = useState(null)

  const activeFilters = Object.fromEntries(Object.entries(filters).filter(([, value]) => value))

  const load = async () => {
    setIsLoading(true)
    try {
      const data = await fetchLogHistory(activeFilters, page)
      setLogs(data.results ?? data)
      setPageInfo({ next: data.next, previous: data.previous, count: data.count ?? data.length })
    } catch {
      showToast(t('履歴の取得に失敗しました'), 'error')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page])

  const handleFilterSubmit = (event) => {
    event.preventDefault()
    setPage(1)
    load()
  }

  const handleExport = async () => {
    setIsExporting(true)
    try {
      await downloadLogsCsv(activeFilters)
    } catch {
      showToast(t('CSVの出力に失敗しました'), 'error')
    } finally {
      setIsExporting(false)
    }
  }

  const handleDelete = async (log) => {
    const typeLabel = t(log.type === 'check_in' ? '入室' : '退室')
    const when = formatDateTime(log.created_at, language)
    const confirmMessage = language === 'en'
      ? `Delete ${log.member.name}'s ${typeLabel.toLowerCase()} record (${when})?`
      : `${log.member.name} さんの${typeLabel}記録（${when}）を削除しますか？`
    if (!window.confirm(confirmMessage)) return
    try {
      await deleteLog(log.id)
      showToast(t('ログを削除しました'))
      load()
    } catch {
      showToast(t('削除に失敗しました'), 'error')
    }
  }

  const handleManualSaved = () => {
    setIsManualModalOpen(false)
    setEditingLog(null)
    setPage(1)
    load()
  }

  const columns = [
    { key: 'name', header: t('氏名'), render: (row) => row.member.name },
    { key: 'company_name', header: t('所属企業'), render: (row) => row.member.company_name || '—' },
    { key: 'type', header: t('種別'), render: (row) => <StatusBadge status={row.type} /> },
    { key: 'method', header: t('入力方式'), render: (row) => t(METHOD_LABELS[row.method] || row.method) },
    {
      key: 'security_card_number',
      header: t('貸出カード番号'),
      render: (row) => row.security_card_number || '—',
    },
    {
      key: 'security_card_returned',
      header: t('返却状況'),
      render: (row) => {
        if (row.security_card_returned === null || row.security_card_returned === undefined) return '—'
        return row.security_card_returned ? t('返却済み') : t('未返却')
      },
    },
    { key: 'scanned_by_name', header: t('対応スタッフ'), render: (row) => row.scanned_by_name || '—' },
    { key: 'created_at', header: t('打刻日時'), render: (row) => formatDateTime(row.created_at, language) },
    {
      key: 'actions',
      header: '',
      width: 88,
      render: (row) => (
        <div className="logs-page__row-actions">
          <button
            type="button"
            className="icon-btn"
            onClick={() => setEditingLog(row)}
            aria-label={t('編集')}
          >
            <Pencil size={16} />
          </button>
          <button
            type="button"
            className="icon-btn icon-btn--danger"
            onClick={() => handleDelete(row)}
            aria-label={t('削除')}
          >
            <Trash2 size={16} />
          </button>
        </div>
      ),
    },
  ]

  return (
    <div className="logs-page__panel">
      <form className="logs-page__filters" onSubmit={handleFilterSubmit}>
        <div className="field">
          <label htmlFor="date_from">{t('開始日')}</label>
          <input
            id="date_from"
            type="date"
            value={filters.date_from}
            onChange={(event) => setFilters({ ...filters, date_from: event.target.value })}
          />
        </div>
        <div className="field">
          <label htmlFor="date_to">{t('終了日')}</label>
          <input
            id="date_to"
            type="date"
            value={filters.date_to}
            onChange={(event) => setFilters({ ...filters, date_to: event.target.value })}
          />
        </div>
        <div className="field">
          <label htmlFor="member">{t('会員名')}</label>
          <input
            id="member"
            type="text"
            placeholder={t('氏名で絞り込み')}
            value={filters.member}
            onChange={(event) => setFilters({ ...filters, member: event.target.value })}
          />
        </div>
        <label className="logs-page__unreturned-filter">
          <input
            type="checkbox"
            checked={filters.unreturned_card}
            onChange={(event) => setFilters({ ...filters, unreturned_card: event.target.checked })}
          />
          {t('未返却のみ')}
        </label>
        <button type="submit" className="btn btn-secondary">{t('絞り込む')}</button>
        <button
          type="button"
          className="btn btn-secondary logs-page__manual-add"
          onClick={() => setIsManualModalOpen(true)}
        >
          <Plus size={16} />
          {t('手動追加')}
        </button>
        <button type="button" className="btn btn-primary logs-page__export" onClick={handleExport} disabled={isExporting}>
          <Download size={16} />
          {isExporting ? t('出力中…') : t('CSVダウンロード')}
        </button>
      </form>

      {isLoading ? (
        <p className="logs-page__loading">{t('読み込み中…')}</p>
      ) : (
        <>
          <DataTable
            columns={columns}
            rows={logs}
            rowKey={(row) => row.id}
            emptyMessage={t('該当する履歴がありません')}
            mobileCompact
          />
          <div className="logs-page__pagination">
            <span>{language === 'en' ? `${pageInfo.count} items` : `${pageInfo.count} 件`}</span>
            <div className="logs-page__pagination-buttons">
              <button
                type="button"
                className="btn btn-secondary"
                disabled={!pageInfo.previous}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                <ChevronLeft size={16} />
                {t('前へ')}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={!pageInfo.next}
                onClick={() => setPage((current) => current + 1)}
              >
                {t('次へ')}
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </>
      )}

      {isManualModalOpen && (
        <ManualLogModal onClose={() => setIsManualModalOpen(false)} onSaved={handleManualSaved} />
      )}
      {editingLog && (
        <ManualLogModal
          initialLog={editingLog}
          onClose={() => setEditingLog(null)}
          onSaved={handleManualSaved}
        />
      )}
    </div>
  )
}

export default function LogsPage() {
  const { t } = useLanguage()
  const [activeTab, setActiveTab] = useState('current')

  return (
    <div className="logs-page">
      <div className="logs-page__header">
        <h1>{t('在室・ログ管理')}</h1>
        <p>{t('現在の在室状況と過去の入退室履歴を確認できます')}</p>
      </div>

      <div className="logs-page__tabs">
        <button
          type="button"
          className={`logs-page__tab ${activeTab === 'current' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('current')}
        >
          {t('現在の在室者')}
        </button>
        <button
          type="button"
          className={`logs-page__tab ${activeTab === 'history' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          {t('過去の入退室履歴')}
        </button>
      </div>

      {activeTab === 'current' ? <CurrentOccupantsTab /> : <HistoryTab />}
    </div>
  )
}
