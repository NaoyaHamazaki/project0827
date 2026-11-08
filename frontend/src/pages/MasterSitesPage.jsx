import { useEffect, useState } from 'react'
import { Copy, Plus, QrCode, Users } from 'lucide-react'
import { createSite, fetchSiteAdmins, fetchSites } from '../api/tenants'
import DataTable from '../components/DataTable'
import InviteLinkModal from '../components/InviteLinkModal'
import Modal from '../components/Modal'
import { useLanguage } from '../context/LanguageContext'
import { useToast } from '../context/ToastContext'
import './MasterSitesPage.css'

function SiteAdminsModal({ site, onClose, onInvite }) {
  const { t } = useLanguage()
  const [admins, setAdmins] = useState(null)

  useEffect(() => {
    fetchSiteAdmins(site.id).then((data) => setAdmins(data.admins)).catch(() => setAdmins([]))
  }, [site.id])

  return (
    <Modal title={`${site.code} ${site.name}　${t('管理者一覧')}`} onClose={onClose}>
      <div className="master-sites__admins">
        {admins === null && <p className="settings-page__loading">{t('読み込み中…')}</p>}
        {admins?.length === 0 && <p className="master-sites__empty">{t('まだ管理者がいません。招待URLを発行してください')}</p>}
        {admins?.length > 0 && (
          <ul>
            {admins.map((admin) => (
              <li key={admin.id}>
                <span className="master-sites__admin-no">{String(admin.admin_number).padStart(2, '0')}</span>
                <span className="master-sites__admin-name">{admin.display_name}</span>
                <span className="master-sites__admin-email">{admin.email}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="master-sites__invite-actions">
          <button type="button" className="btn btn-secondary" onClick={() => onInvite('qr')}>
            <QrCode size={16} />
            {t('管理者招待（QR表示）')}
          </button>
          <button type="button" className="btn btn-primary" onClick={() => onInvite('url')}>
            <Copy size={16} />
            {t('管理者招待（URLをコピー）')}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// マスター向け：所管（支店）の一覧・追加と、所管ごとの管理者の確認・招待
export default function MasterSitesPage() {
  const { t } = useLanguage()
  const { showToast } = useToast()
  const [sites, setSites] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [newName, setNewName] = useState('')
  const [activeSite, setActiveSite] = useState(null)
  const [inviteMode, setInviteMode] = useState(null)

  const load = () => {
    fetchSites()
      .then(setSites)
      .catch(() => showToast(t('所管一覧の取得に失敗しました'), 'error'))
      .finally(() => setIsLoading(false))
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleAdd = async (event) => {
    event.preventDefault()
    const name = newName.trim()
    if (!name) return
    try {
      const site = await createSite({ name })
      showToast(`${t('所管を追加しました')}: ${site.code} ${site.name}`)
      setNewName('')
      load()
    } catch {
      showToast(t('追加に失敗しました'), 'error')
    }
  }

  const columns = [
    { key: 'code', header: t('所管コード'), render: (row) => <span className="master-sites__code">{row.code}</span> },
    { key: 'name', header: t('所管名') },
    { key: 'admin_count', header: t('管理者'), render: (row) => `${row.admin_count}${t('名')}` },
    { key: 'company_count', header: t('所属'), render: (row) => `${row.company_count}${t('社')}` },
    { key: 'member_count', header: t('会員'), render: (row) => `${row.member_count}${t('名')}` },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <button type="button" className="btn btn-secondary master-sites__row-btn" onClick={() => setActiveSite(row)}>
          <Users size={14} />
          {t('管理者を見る・招待')}
        </button>
      ),
    },
  ]

  return (
    <div className="master-sites">
      <div className="master-sites__header">
        <h1>{t('所管一覧')}</h1>
        <p>{t('支店（所管）ごとに管理者を招待します。管理者はそれぞれの所管の中で会員を管理します')}</p>
      </div>

      <form className="master-sites__add" onSubmit={handleAdd}>
        <input
          value={newName}
          onChange={(event) => setNewName(event.target.value)}
          placeholder={t('新しい所管名（例: 新宿）')}
        />
        <button type="submit" className="btn btn-primary" disabled={!newName.trim()}>
          <Plus size={16} />
          {t('所管を追加')}
        </button>
      </form>

      {isLoading ? (
        <p className="settings-page__loading">{t('読み込み中…')}</p>
      ) : (
        <DataTable columns={columns} rows={sites} rowKey={(row) => row.id} emptyMessage={t('所管がありません')} />
      )}

      {activeSite && !inviteMode && (
        <SiteAdminsModal site={activeSite} onClose={() => setActiveSite(null)} onInvite={setInviteMode} />
      )}
      {activeSite && inviteMode && (
        <InviteLinkModal
          mode={inviteMode}
          targetLabel={`${activeSite.name}の管理者`}
          payload={{ site: activeSite.id }}
          onClose={() => setInviteMode(null)}
        />
      )}
    </div>
  )
}
