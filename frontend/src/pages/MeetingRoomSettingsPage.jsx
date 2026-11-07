import { useEffect, useState } from 'react'
import { Plus, Trash2, LayoutGrid } from 'lucide-react'
import { createRoom, deleteRoom, fetchAllRooms, updateRoom } from '../api/meetingRooms'
import { useLanguage } from '../context/LanguageContext'
import { useToast } from '../context/ToastContext'
import './MeetingRoomSettingsPage.css'

export default function MeetingRoomSettingsPage() {
  const { t } = useLanguage()
  const { showToast } = useToast()
  const [rooms, setRooms] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [newName, setNewName] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const load = () => {
    setIsLoading(true)
    fetchAllRooms()
      .then(setRooms)
      .catch(() => showToast(t('会議室一覧の取得に失敗しました'), 'error'))
      .finally(() => setIsLoading(false))
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleToggleBookable = async (room) => {
    try {
      await updateRoom(room.id, { is_bookable: !room.is_bookable })
      load()
    } catch {
      showToast(t('更新に失敗しました'), 'error')
    }
  }

  const handleDelete = async (room) => {
    if (!window.confirm(`「${room.name}」を削除しますか？`)) return
    try {
      await deleteRoom(room.id)
      showToast(t('会議室を削除しました'))
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
      await createRoom({ name, order: rooms.length })
      setNewName('')
      load()
    } catch {
      showToast(t('追加に失敗しました'), 'error')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="meeting-room-settings-page">
      <div className="meeting-room-settings-page__header">
        <h1>{t('会議室設定')}</h1>
        <p>{t('登録済みの会議室を管理します。一時的に予約を受け付けない場合は「予約可能」のチェックを外してください')}</p>
      </div>

      <section className="settings-page__section">
        <h2>{t('会議室一覧')}</h2>

        {isLoading ? (
          <p className="settings-page__loading">{t('読み込み中…')}</p>
        ) : (
          <div className="meeting-room-settings-page__table">
            <div className="meeting-room-settings-page__row meeting-room-settings-page__row--head">
              <span>{t('会議室名')}</span>
              <span>{t('予約可能')}</span>
              <span />
            </div>
            {rooms.map((room) => (
              <div key={room.id} className="meeting-room-settings-page__row">
                <span>{room.name}</span>
                <label className="settings-page__toggle">
                  <input
                    type="checkbox"
                    checked={room.is_bookable}
                    onChange={() => handleToggleBookable(room)}
                  />
                </label>
                <button
                  type="button"
                  className="icon-btn icon-btn--danger"
                  onClick={() => handleDelete(room)}
                  aria-label={t('削除')}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
            {rooms.length === 0 && (
              <p className="meeting-room-settings-page__empty">{t('会議室が登録されていません')}</p>
            )}

            <form className="meeting-room-settings-page__row meeting-room-settings-page__row--add" onSubmit={handleAdd}>
              <input
                value={newName}
                onChange={(event) => setNewName(event.target.value)}
                placeholder={t('新しい会議室名')}
              />
              <span />
              <button type="submit" className="icon-btn" disabled={isSaving || !newName.trim()} aria-label={t('追加')}>
                <Plus size={16} />
              </button>
            </form>
          </div>
        )}
      </section>

      <section className="settings-page__section">
        <h2>
          <LayoutGrid size={18} className="meeting-room-settings-page__section-icon" />
          {t('間取り図')}
        </h2>
        <p className="settings-page__section-desc">
          {t('間取り図を作成する機能は今後追加予定です（詳細は別途ご相談のうえ実装します）。')}
        </p>
      </section>
    </div>
  )
}
