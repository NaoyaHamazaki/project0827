import { useEffect, useState } from 'react'
import {
  AlertOctagon, AlertTriangle, ChevronLeft, ChevronRight, Download, Eye, LogOut, Pencil, Plus, Trash2,
} from 'lucide-react'
import DataTable from '../components/DataTable'
import Modal from '../components/Modal'
import { useLanguage } from '../context/LanguageContext'
import { useToast } from '../context/ToastContext'
import {
  createManualLog,
  deleteLog,
  downloadLogsCsv,
  fetchCurrentOccupants,
  fetchLogSessions,
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

// 在室の経過時間による注意表示：12時間以上＝注意、24時間以上＝要確認（退室し忘れの可能性が高い）
const WARNING_HOURS = 12
const DANGER_HOURS = 24

function formatDateTime(isoString, language) {
  return new Date(isoString).toLocaleString(language === 'en' ? 'en-US' : 'ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatTime(isoString) {
  return new Date(isoString).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
}

function sameDay(a, b) {
  return new Date(a).toDateString() === new Date(b).toDateString()
}

function hoursSince(isoString) {
  return (Date.now() - new Date(isoString).getTime()) / 3600000
}

function formatDuration(minutes) {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}分`
  return m === 0 ? `${h}時間` : `${h}時間${m}分`
}

function elapsedLevel(isoString) {
  const hours = hoursSince(isoString)
  if (hours >= DANGER_HOURS) return 'danger'
  if (hours >= WARNING_HOURS) return 'warning'
  return 'normal'
}

function toDatetimeLocalValue(date) {
  const pad = (value) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function ElapsedBadge({ level }) {
  const { t } = useLanguage()
  if (level === 'danger') {
    return (
      <span className="logs-page__level logs-page__level--danger">
        <AlertOctagon size={13} aria-hidden="true" />
        {t('要確認')}
      </span>
    )
  }
  if (level === 'warning') {
    return (
      <span className="logs-page__level logs-page__level--warning">
        <AlertTriangle size={13} aria-hidden="true" />
        {t('長時間')}
      </span>
    )
  }
  return null
}

// 在室者を管理者が退室扱いにする
function ForceCheckoutModal({ occupant, onClose, onSaved }) {
  const { t, language } = useLanguage()
  const { showToast } = useToast()
  const [timestamp, setTimestamp] = useState(toDatetimeLocalValue(new Date()))
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const checkedIn = new Date(occupant.checked_in_at)

  const handleSubmit = async (event) => {
    event.preventDefault()
    const at = new Date(timestamp)
    if (at <= checkedIn) {
      setError(t('退室日時は入室日時より後にしてください'))
      return
    }
    if (at > new Date()) {
      setError(t('未来の日時は指定できません'))
      return
    }
    setError('')
    setIsSaving(true)
    try {
      await createManualLog({ member: occupant.id, type: 'check_out', timestamp: at.toISOString() })
      showToast(`${occupant.name} ${t('さんを退室扱いにしました')}`)
      onSaved()
    } catch {
      setError(t('保存に失敗しました。入力内容をご確認ください。'))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Modal title={t('退室扱いにする')} onClose={onClose}>
      <form className="members-form" onSubmit={handleSubmit}>
        <dl className="logs-page__summary">
          <dt>{t('氏名')}</dt>
          <dd>{occupant.name}{occupant.company_name ? `（${occupant.company_name}）` : ''}</dd>
          <dt>{t('入室時刻')}</dt>
          <dd>{formatDateTime(occupant.checked_in_at, language)}</dd>
          <dt>{t('経過時間')}</dt>
          <dd>{formatDuration(Math.floor(hoursSince(occupant.checked_in_at) * 60))}</dd>
        </dl>
        <div className="field">
          <label htmlFor="force-checkout-at">{t('退室日時')}</label>
          <input
            id="force-checkout-at"
            type="datetime-local"
            value={timestamp}
            min={toDatetimeLocalValue(checkedIn)}
            max={toDatetimeLocalValue(new Date())}
            onChange={(event) => setTimestamp(event.target.value)}
            required
          />
          <span className="logs-page__hint">{t('実際に退室したと思われる時刻がわかる場合は、その時刻にしてください')}</span>
        </div>
        {occupant.security_card_number && (
          <p className="logs-page__notice">
            {t('貸出中のセキュリティカード')}「{occupant.security_card_number}」{t('も返却済みになります')}
          </p>
        )}

        {error && <p className="members-form__error">{error}</p>}

        <div className="members-form__actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>{t('キャンセル')}</button>
          <button type="submit" className="btn btn-primary" disabled={isSaving}>
            {isSaving ? t('保存中…') : t('退室扱いにする')}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function CurrentOccupantsTab() {
  const { t, language } = useLanguage()
  const { showToast } = useToast()
  const [occupants, setOccupants] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [checkingOut, setCheckingOut] = useState(null)

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

  // 注意が必要な人（経過時間が長い順）を上に、それ以外は新しく入室した順
  const rows = occupants
    .map((row) => ({ ...row, level: elapsedLevel(row.checked_in_at) }))
    .sort((a, b) => {
      const flaggedA = a.level !== 'normal'
      const flaggedB = b.level !== 'normal'
      if (flaggedA !== flaggedB) return flaggedA ? -1 : 1
      const diff = new Date(a.checked_in_at) - new Date(b.checked_in_at)
      return flaggedA ? diff : -diff
    })
  const dangerCount = rows.filter((row) => row.level === 'danger').length
  const warningCount = rows.filter((row) => row.level === 'warning').length

  const columns = [
    { key: 'name', header: t('氏名'), render: (row) => <strong>{row.name}</strong> },
    { key: 'company_name', header: t('所属企業'), render: (row) => row.company_name || '—' },
    { key: 'checked_in_at', header: t('入室時刻'), render: (row) => formatDateTime(row.checked_in_at, language) },
    {
      key: 'elapsed',
      header: t('経過時間'),
      render: (row) => (
        <span className="logs-page__elapsed">
          <span className={`logs-page__elapsed-value is-${row.level}`}>
            {formatDuration(Math.floor(hoursSince(row.checked_in_at) * 60))}
          </span>
          <ElapsedBadge level={row.level} />
        </span>
      ),
    },
    { key: 'security_card_number', header: t('貸出カード'), render: (row) => row.security_card_number || '—' },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <button
          type="button"
          className={`btn ${row.level === 'normal' ? 'btn-secondary' : 'btn-primary'} logs-page__checkout-btn`}
          onClick={() => setCheckingOut(row)}
        >
          <LogOut size={15} />
          {t('退室にする')}
        </button>
      ),
    },
  ]

  return (
    <div className="logs-page__panel">
      <div className="logs-page__panel-header">
        <span className="logs-page__count">
          {language === 'en' ? `${occupants.length} currently checked in` : `現在 ${occupants.length} 名が在室中`}
        </span>
        <div className="logs-page__alerts">
          {dangerCount > 0 && (
            <span className="logs-page__alert logs-page__alert--danger">
              <AlertOctagon size={14} aria-hidden="true" />
              {`${t('要確認')} ${dangerCount}${t('名')}（${DANGER_HOURS}${t('時間以上。退室し忘れの可能性')}）`}
            </span>
          )}
          {warningCount > 0 && (
            <span className="logs-page__alert logs-page__alert--warning">
              <AlertTriangle size={14} aria-hidden="true" />
              {`${t('長時間')} ${warningCount}${t('名')}（${WARNING_HOURS}${t('時間以上')}）`}
            </span>
          )}
        </div>
      </div>
      {isLoading ? (
        <p className="logs-page__loading">{t('読み込み中…')}</p>
      ) : (
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(row) => row.id}
          emptyMessage={t('現在、在室中の会員はいません')}
          rowClassName={(row) => (row.level === 'normal' ? '' : `logs-page__row--${row.level}`)}
          mobileCompact
        />
      )}
      {checkingOut && (
        <ForceCheckoutModal
          occupant={checkingOut}
          onClose={() => setCheckingOut(null)}
          onSaved={() => {
            setCheckingOut(null)
            load()
          }}
        />
      )}
    </div>
  )
}

// 入室・退室の1件を手動で追加する（打刻漏れの補正用）
function ManualLogModal({ onClose, onSaved }) {
  const { t } = useLanguage()
  const { showToast } = useToast()
  const [members, setMembers] = useState([])
  const [form, setForm] = useState({ member: '', type: 'check_in', timestamp: toDatetimeLocalValue(new Date()) })
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
    try {
      await createManualLog({ member: form.member, type: form.type, timestamp: new Date(form.timestamp).toISOString() })
      showToast(t('打刻ログを追加しました'))
      onSaved()
    } catch {
      setError(t('保存に失敗しました。入力内容をご確認ください。'))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Modal title={t('打刻ログを手動追加')} onClose={onClose}>
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
          <select id="manual-log-type" value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}>
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
          <button type="button" className="btn btn-secondary" onClick={onClose}>{t('キャンセル')}</button>
          <button type="submit" className="btn btn-primary" disabled={isSaving}>
            {isSaving ? t('保存中…') : t('追加する')}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// 1回の来館（入室と退室の組）の入室・退室日時を直す。記録がない側は新しく追加する
function SessionEditModal({ session, onClose, onSaved }) {
  const { t } = useLanguage()
  const { showToast } = useToast()
  const [checkIn, setCheckIn] = useState(session.check_in ? toDatetimeLocalValue(new Date(session.check_in.at)) : '')
  const [checkOut, setCheckOut] = useState(session.check_out ? toDatetimeLocalValue(new Date(session.check_out.at)) : '')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')

  const save = async (part, type, value) => {
    const timestamp = new Date(value).toISOString()
    if (part) {
      if (new Date(part.at).getTime() === new Date(value).getTime()) return
      await updateLog(part.id, { member: session.member.id, type, timestamp })
    } else if (value) {
      await createManualLog({ member: session.member.id, type, timestamp })
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (checkIn && checkOut && new Date(checkOut) <= new Date(checkIn)) {
      setError(t('退室日時は入室日時より後にしてください'))
      return
    }
    setError('')
    setIsSaving(true)
    try {
      if (checkIn) await save(session.check_in, 'check_in', checkIn)
      if (checkOut) await save(session.check_out, 'check_out', checkOut)
      showToast(t('入退室の記録を更新しました'))
      onSaved()
    } catch {
      setError(t('保存に失敗しました。入力内容をご確認ください。'))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Modal title={t('入退室の記録を編集')} onClose={onClose}>
      <form className="members-form" onSubmit={handleSubmit}>
        <dl className="logs-page__summary">
          <dt>{t('氏名')}</dt>
          <dd>{session.member.name}{session.member.company_name ? `（${session.member.company_name}）` : ''}</dd>
        </dl>
        <div className="field">
          <label htmlFor="session-check-in">{t('入室日時')}</label>
          <input
            id="session-check-in"
            type="datetime-local"
            value={checkIn}
            onChange={(event) => setCheckIn(event.target.value)}
            required={Boolean(session.check_in)}
          />
          {!session.check_in && <span className="logs-page__hint">{t('入室の記録がありません。入力すると追加されます')}</span>}
        </div>
        <div className="field">
          <label htmlFor="session-check-out">{t('退室日時')}</label>
          <input
            id="session-check-out"
            type="datetime-local"
            value={checkOut}
            onChange={(event) => setCheckOut(event.target.value)}
            required={Boolean(session.check_out)}
          />
          {!session.check_out && <span className="logs-page__hint">{t('退室の記録がありません。入力すると追加されます')}</span>}
        </div>

        {error && <p className="members-form__error">{error}</p>}

        <div className="members-form__actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>{t('キャンセル')}</button>
          <button type="submit" className="btn btn-primary" disabled={isSaving}>
            {isSaving ? t('保存中…') : t('更新する')}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function SessionDetailModal({ session, onClose }) {
  const { t, language } = useLanguage()
  const part = (label, log) => (
    <>
      <dt>{label}</dt>
      <dd>
        {log ? (
          <>
            {formatDateTime(log.at, language)}
            <span className="logs-page__sub">{t(METHOD_LABELS[log.method] || log.method)}・{log.staff || t('スタッフ記録なし')}</span>
          </>
        ) : (
          t(log === session.check_out && session.status === 'ongoing' ? '在室中' : '記録なし')
        )}
      </dd>
    </>
  )
  return (
    <Modal title={t('入退室の詳細')} onClose={onClose}>
      <dl className="logs-page__summary logs-page__summary--detail">
        <dt>{t('氏名')}</dt>
        <dd>{session.member.name}</dd>
        <dt>{t('所属企業')}</dt>
        <dd>{session.member.company_name || '—'}</dd>
        {part(t('入室'), session.check_in)}
        {part(t('退室'), session.check_out)}
        <dt>{t('利用時間')}</dt>
        <dd>{session.duration_minutes !== null ? formatDuration(session.duration_minutes) : '—'}</dd>
        <dt>{t('貸出カード')}</dt>
        <dd>
          {session.security_card_number
            ? `${session.security_card_number}（${session.security_card_returned ? t('返却済み') : t('未返却')}）`
            : '—'}
        </dd>
      </dl>
      <div className="members-form__actions">
        <button type="button" className="btn btn-secondary" onClick={onClose}>{t('閉じる')}</button>
      </div>
    </Modal>
  )
}

function staffLabel(session, t) {
  const inStaff = session.check_in?.staff
  const outStaff = session.check_out?.staff
  if (inStaff && outStaff && inStaff !== outStaff) return `${t('入')} ${inStaff} / ${t('退')} ${outStaff}`
  return inStaff || outStaff || '—'
}

function HistoryTab() {
  const { t, language } = useLanguage()
  const { showToast } = useToast()
  const [filters, setFilters] = useState({ date_from: '', date_to: '', member: '', unreturned_card: false })
  const [page, setPage] = useState(1)
  const [sessions, setSessions] = useState([])
  const [pageInfo, setPageInfo] = useState({ next: null, previous: null, count: 0 })
  const [isLoading, setIsLoading] = useState(true)
  const [isExporting, setIsExporting] = useState(false)
  const [isManualModalOpen, setIsManualModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [viewing, setViewing] = useState(null)

  const activeFilters = Object.fromEntries(Object.entries(filters).filter(([, value]) => value))

  const load = async () => {
    setIsLoading(true)
    try {
      const data = await fetchLogSessions(activeFilters, page)
      setSessions(data.results)
      setPageInfo({ next: data.next, previous: data.previous, count: data.count })
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

  const handleDelete = async (session) => {
    const when = formatDateTime((session.check_in || session.check_out).at, language)
    if (!window.confirm(`${session.member.name} さんの入退室記録（${when}〜）を削除しますか？`)) return
    try {
      await Promise.all([session.check_in, session.check_out].filter(Boolean).map((part) => deleteLog(part.id)))
      showToast(t('入退室の記録を削除しました'))
      load()
    } catch {
      showToast(t('削除に失敗しました'), 'error')
    }
  }

  const handleSaved = () => {
    setIsManualModalOpen(false)
    setEditing(null)
    load()
  }

  const columns = [
    {
      key: 'check_in',
      header: t('入室時刻'),
      render: (row) => (row.check_in ? formatDateTime(row.check_in.at, language) : (
        <span className="logs-page__level logs-page__level--warning">
          <AlertTriangle size={13} aria-hidden="true" />
          {t('入室なし')}
        </span>
      )),
    },
    {
      key: 'check_out',
      header: t('退室時刻'),
      render: (row) => {
        if (row.status === 'ongoing') return <span className="logs-page__level logs-page__level--info">{t('在室中')}</span>
        if (!row.check_out) {
          return (
            <span className="logs-page__level logs-page__level--warning">
              <AlertTriangle size={13} aria-hidden="true" />
              {t('退室なし')}
            </span>
          )
        }
        return row.check_in && sameDay(row.check_in.at, row.check_out.at)
          ? formatTime(row.check_out.at)
          : formatDateTime(row.check_out.at, language)
      },
    },
    {
      key: 'duration',
      header: t('利用時間'),
      cellClassName: 'logs-page__num',
      render: (row) => (row.duration_minutes !== null ? formatDuration(row.duration_minutes) : '—'),
    },
    { key: 'name', header: t('氏名'), render: (row) => <strong>{row.member.name}</strong> },
    { key: 'company_name', header: t('所属企業'), render: (row) => row.member.company_name || '—' },
    { key: 'staff', header: t('対応スタッフ'), render: (row) => staffLabel(row, t) },
    {
      key: 'actions',
      header: '',
      width: 120,
      render: (row) => (
        <div className="logs-page__row-actions">
          <button type="button" className="icon-btn" onClick={() => setViewing(row)} aria-label={t('詳細')} title={t('詳細')}>
            <Eye size={16} />
          </button>
          <button type="button" className="icon-btn" onClick={() => setEditing(row)} aria-label={t('編集')} title={t('編集')}>
            <Pencil size={16} />
          </button>
          <button
            type="button"
            className="icon-btn icon-btn--danger"
            onClick={() => handleDelete(row)}
            aria-label={t('削除')}
            title={t('削除')}
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
          {t('カード未返却のみ')}
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
            rows={sessions}
            rowKey={(row) => row.id}
            emptyMessage={t('該当する履歴がありません')}
            rowClassName={(row) => (row.status.startsWith('missing') ? 'logs-page__row--warning' : '')}
            mobileCompact
          />
          <div className="logs-page__pagination">
            <span>{language === 'en' ? `${pageInfo.count} visits` : `${pageInfo.count} 件`}</span>
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

      {isManualModalOpen && <ManualLogModal onClose={() => setIsManualModalOpen(false)} onSaved={handleSaved} />}
      {editing && <SessionEditModal session={editing} onClose={() => setEditing(null)} onSaved={handleSaved} />}
      {viewing && <SessionDetailModal session={viewing} onClose={() => setViewing(null)} />}
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
