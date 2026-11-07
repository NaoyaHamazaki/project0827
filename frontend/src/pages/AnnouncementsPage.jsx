import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { createAnnouncement, fetchAnnouncements } from '../api/orgSettings'
import Modal from '../components/Modal'
import { useLanguage } from '../context/LanguageContext'
import { useToast } from '../context/ToastContext'
import './AnnouncementsPage.css'

function formatDate(iso, language) {
  return new Date(iso).toLocaleString(language === 'en' ? 'en-US' : 'ja-JP', {
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  })
}

export default function AnnouncementsPage() {
  const { t, language } = useLanguage()
  const { showToast } = useToast()
  const [items, setItems] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [openItem, setOpenItem] = useState(null)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const load = () => {
    setIsLoading(true)
    fetchAnnouncements()
      .then(setItems)
      .catch(() => showToast(t('お知らせの取得に失敗しました'), 'error'))
      .finally(() => setIsLoading(false))
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleCreate = async (event) => {
    event.preventDefault()
    setIsSaving(true)
    try {
      await createAnnouncement({ title, body })
      setTitle('')
      setBody('')
      setIsCreateOpen(false)
      showToast(t('お知らせを作成しました'))
      load()
    } catch {
      showToast(t('作成に失敗しました'), 'error')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="announcements-page">
      <div className="announcements-page__header">
        <div>
          <h1>{t('アップデート情報')}</h1>
          <p>{t('運営からの修正・機能追加などのお知らせです')}</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setIsCreateOpen(true)}>
          <Plus size={16} />
          {t('新規作成')}
        </button>
      </div>

      {isLoading ? (
        <p className="settings-page__loading">{t('読み込み中…')}</p>
      ) : (
        <ul className="announcements-page__list">
          {items.map((item) => (
            <li key={item.id}>
              <button type="button" className="announcements-page__item" onClick={() => setOpenItem(item)}>
                <span className="announcements-page__item-title">{item.title}</span>
                <span className="announcements-page__item-date">{formatDate(item.created_at, language)}</span>
              </button>
            </li>
          ))}
          {items.length === 0 && <p className="announcements-page__empty">{t('お知らせはまだありません')}</p>}
        </ul>
      )}

      {openItem && (
        <Modal title={openItem.title} onClose={() => setOpenItem(null)}>
          <p className="announcements-page__detail-date">{formatDate(openItem.created_at, language)}</p>
          <p className="announcements-page__detail-body">{openItem.body}</p>
        </Modal>
      )}

      {isCreateOpen && (
        <Modal title={t('お知らせを作成')} onClose={() => setIsCreateOpen(false)}>
          <form className="settings-form" onSubmit={handleCreate}>
            <div className="field">
              <label htmlFor="ann-title">{t('タイトル')}</label>
              <input id="ann-title" value={title} onChange={(e) => setTitle(e.target.value)} required autoFocus />
            </div>
            <div className="field">
              <label htmlFor="ann-body">{t('本文')}</label>
              <textarea id="ann-body" rows={6} value={body} onChange={(e) => setBody(e.target.value)} required />
            </div>
            <div className="members-form__actions">
              <button type="button" className="btn btn-secondary" onClick={() => setIsCreateOpen(false)}>
                {t('キャンセル')}
              </button>
              <button type="submit" className="btn btn-primary" disabled={isSaving}>
                {isSaving ? t('保存中…') : t('保存する')}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
