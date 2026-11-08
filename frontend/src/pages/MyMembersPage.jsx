import { useEffect, useState } from 'react'
import { Copy, QrCode, Trash2 } from 'lucide-react'
import { deleteMyCompanyMember, fetchMyCompanyMembers, updateMyCompanyMember } from '../api/members'
import DataTable from '../components/DataTable'
import InviteLinkModal from '../components/InviteLinkModal'
import { useLanguage } from '../context/LanguageContext'
import { useToast } from '../context/ToastContext'
import './MyMembersPage.css'

// 代表向け：自分の所属のメンバー一覧と、メンバーの招待・無効化・削除
export default function MyMembersPage() {
  const { t } = useLanguage()
  const { showToast } = useToast()
  const [data, setData] = useState(null)
  const [inviteMode, setInviteMode] = useState(null)

  const load = () => {
    fetchMyCompanyMembers().then(setData).catch(() => showToast(t('メンバー一覧の取得に失敗しました'), 'error'))
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const toggleStatus = async (member) => {
    const next = member.status === 'active' ? 'inactive' : 'active'
    const label = next === 'active' ? t('有効') : t('無効')
    if (!window.confirm(`「${member.name}」を${label}にしますか？`)) return
    try {
      await updateMyCompanyMember(member.id, { status: next })
      load()
    } catch {
      showToast(t('更新に失敗しました'), 'error')
    }
  }

  const handleDelete = async (member) => {
    if (!window.confirm(`「${member.name}」を削除しますか？ログインできなくなり、元に戻せません。`)) return
    try {
      await deleteMyCompanyMember(member.id)
      showToast(t('メンバーを削除しました'))
      load()
    } catch {
      showToast(t('削除に失敗しました'), 'error')
    }
  }

  const columns = [
    { key: 'member_code', header: t('メンバーコード'), render: (row) => <span className="my-members__code">{row.member_code}</span> },
    {
      key: 'name',
      header: t('氏名'),
      render: (row) => (
        <span>
          {row.name}
          {row.is_representative && <span className="my-members__rep-badge">{t('代表')}</span>}
        </span>
      ),
    },
    { key: 'email', header: t('メールアドレス'), render: (row) => row.email || '—' },
    {
      key: 'status',
      header: t('状態'),
      render: (row) => (
        row.is_representative ? (
          <span className="my-members__status is-active">{t('有効')}</span>
        ) : (
          <button
            type="button"
            className={`my-members__status ${row.status === 'active' ? 'is-active' : 'is-inactive'}`}
            onClick={() => toggleStatus(row)}
            title={t('押すと有効／無効を切り替えます')}
          >
            {row.status === 'active' ? t('有効') : t('無効')}
          </button>
        )
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (row) => (!row.is_representative && (
        <button type="button" className="icon-btn icon-btn--danger" onClick={() => handleDelete(row)} aria-label={t('削除')}>
          <Trash2 size={16} />
        </button>
      )),
    },
  ]

  const activeCount = data ? data.members.filter((m) => m.status === 'active').length : 0

  return (
    <div className="my-members">
      <div className="my-members__header">
        <div>
          <h1>{t('メンバー管理')}</h1>
          {data && (
            <p>
              <span className="my-members__code">{data.company.site_code}-{data.company.code}</span>
              　{data.company.name}　／　{t('有効なメンバー')} {activeCount}{t('名')}
            </p>
          )}
        </div>
        <div className="my-members__invite">
          <button type="button" className="btn btn-secondary" onClick={() => setInviteMode('qr')}>
            <QrCode size={16} />
            {t('メンバー招待（QR）')}
          </button>
          <button type="button" className="btn btn-primary" onClick={() => setInviteMode('url')}>
            <Copy size={16} />
            {t('メンバー招待（URL）')}
          </button>
        </div>
      </div>

      {data ? (
        <DataTable columns={columns} rows={data.members} rowKey={(row) => row.id} emptyMessage={t('メンバーがいません')} />
      ) : (
        <p className="settings-page__loading">{t('読み込み中…')}</p>
      )}

      {inviteMode && (
        <InviteLinkModal mode={inviteMode} targetLabel="メンバー" onClose={() => { setInviteMode(null); load() }} />
      )}
    </div>
  )
}
