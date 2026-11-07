import { useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import {
  createMenuItem, deleteMenuItem, fetchAllMenuItems, fetchOrderSettings, updateMenuItem,
  updateOrderSettings,
} from '../api/orders'
import { useLanguage } from '../context/LanguageContext'
import { useToast } from '../context/ToastContext'
import './OrderMenuSettingsPage.css'

function AcceptWindowSection() {
  const { t } = useLanguage()
  const { showToast } = useToast()
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    fetchOrderSettings()
      .then((data) => {
        setStartTime(data.accept_start_time ? data.accept_start_time.slice(0, 5) : '')
        setEndTime(data.accept_end_time ? data.accept_end_time.slice(0, 5) : '')
      })
      .catch(() => showToast(t('受付時間の取得に失敗しました'), 'error'))
      .finally(() => setIsLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await updateOrderSettings({
        accept_start_time: startTime || null,
        accept_end_time: endTime || null,
      })
      showToast(t('受付時間を保存しました'))
    } catch {
      showToast(t('保存に失敗しました'), 'error')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <section className="settings-page__section">
      <h2>{t('受付可能時間')}</h2>
      <p className="settings-page__section-desc">
        {t('この時間を過ぎると「注文」ページが受付時間外として表示されます。空欄の場合は常時受付可能です。')}
      </p>
      {isLoading ? (
        <p className="settings-page__loading">{t('読み込み中…')}</p>
      ) : (
        <div className="order-menu-settings-page__time-row">
          <div className="field">
            <label htmlFor="accept-start">{t('受付開始時刻')}</label>
            <input
              id="accept-start"
              type="time"
              value={startTime}
              onChange={(event) => setStartTime(event.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="accept-end">{t('受付終了時刻')}</label>
            <input
              id="accept-end"
              type="time"
              value={endTime}
              onChange={(event) => setEndTime(event.target.value)}
            />
          </div>
          <button type="button" className="btn btn-primary" onClick={handleSave} disabled={isSaving}>
            {isSaving ? t('保存中…') : t('保存する')}
          </button>
        </div>
      )}
    </section>
  )
}

export default function OrderMenuSettingsPage() {
  const { t } = useLanguage()
  const { showToast } = useToast()
  const [items, setItems] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [newName, setNewName] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const load = () => {
    setIsLoading(true)
    fetchAllMenuItems()
      .then(setItems)
      .catch(() => showToast(t('メニュー一覧の取得に失敗しました'), 'error'))
      .finally(() => setIsLoading(false))
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleToggleAvailable = async (item) => {
    try {
      await updateMenuItem(item.id, { is_available: !item.is_available })
      load()
    } catch {
      showToast(t('更新に失敗しました'), 'error')
    }
  }

  const handleDelete = async (item) => {
    if (!window.confirm(`「${item.name}」を削除しますか？`)) return
    try {
      await deleteMenuItem(item.id)
      showToast(t('メニューを削除しました'))
      load()
    } catch {
      showToast(t('削除に失敗しました'), 'error')
    }
  }

  const handleAdd = async (event) => {
    event.preventDefault()
    const name = newName.trim()
    if (!name) return
    setIsSaving(true)
    try {
      await createMenuItem({ name, order: items.length })
      setNewName('')
      load()
    } catch {
      showToast(t('追加に失敗しました'), 'error')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="order-menu-settings-page">
      <div className="order-menu-settings-page__header">
        <h1>{t('メニュー設定')}</h1>
        <p>{t('注文で選択できるメニューを管理します。一時的に受付しない場合は「受付可能」のチェックを外してください')}</p>
      </div>

      <section className="settings-page__section">
        <h2>{t('メニュー一覧')}</h2>

        {isLoading ? (
          <p className="settings-page__loading">{t('読み込み中…')}</p>
        ) : (
          <div className="order-menu-settings-page__table">
            <div className="order-menu-settings-page__row order-menu-settings-page__row--head">
              <span>{t('メニュー名')}</span>
              <span>{t('受付可能')}</span>
              <span />
            </div>
            {items.map((item) => (
              <div key={item.id} className="order-menu-settings-page__row">
                <span>{item.name}</span>
                <label className="settings-page__toggle">
                  <input
                    type="checkbox"
                    checked={item.is_available}
                    onChange={() => handleToggleAvailable(item)}
                  />
                </label>
                <button
                  type="button"
                  className="icon-btn icon-btn--danger"
                  onClick={() => handleDelete(item)}
                  aria-label={t('削除')}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
            {items.length === 0 && (
              <p className="order-menu-settings-page__empty">{t('メニューが登録されていません')}</p>
            )}

            <form className="order-menu-settings-page__row order-menu-settings-page__row--add" onSubmit={handleAdd}>
              <input
                value={newName}
                onChange={(event) => setNewName(event.target.value)}
                placeholder={t('新しいメニュー名（例: お茶（Hot））')}
              />
              <span />
              <button type="submit" className="icon-btn" disabled={isSaving || !newName.trim()} aria-label={t('追加')}>
                <Plus size={16} />
              </button>
            </form>
          </div>
        )}
      </section>

      <AcceptWindowSection />
    </div>
  )
}
