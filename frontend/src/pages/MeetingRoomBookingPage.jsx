import { useEffect, useState } from 'react'
import { CalendarPlus } from 'lucide-react'
import { createReservation, fetchBookableRooms } from '../api/meetingRooms'
import Modal from '../components/Modal'
import { useLanguage } from '../context/LanguageContext'
import { useToast } from '../context/ToastContext'
import './MeetingRoomBookingPage.css'

const EMPTY_FORM = { room: '', start_at: '', end_at: '', note: '' }

export default function MeetingRoomBookingPage() {
  const { t } = useLanguage()
  const { showToast } = useToast()
  const [rooms, setRooms] = useState([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isModalOpen) return
    fetchBookableRooms()
      .then((data) => {
        setRooms(data)
        setForm((current) => ({ ...current, room: data[0]?.id ?? '' }))
      })
      .catch(() => setRooms([]))
  }, [isModalOpen])

  const openModal = () => {
    setForm(EMPTY_FORM)
    setError('')
    setIsModalOpen(true)
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setIsSaving(true)
    try {
      await createReservation({
        room: form.room,
        start_at: form.start_at,
        end_at: form.end_at,
        note: form.note,
      })
      showToast(t('会議室を予約しました'))
      setIsModalOpen(false)
    } catch (err) {
      const detail = err?.response?.data?.non_field_errors?.[0]
      setError(detail || t('予約に失敗しました'))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="meeting-room-booking-page">
      <div className="meeting-room-booking-page__card">
        <CalendarPlus size={40} strokeWidth={1.5} />
        <h1>{t('会議室予約')}</h1>
        <p>{t('空いている会議室を選んで予約できます')}</p>
        <button type="button" className="btn btn-primary" onClick={openModal}>
          {t('会議室を予約する')}
        </button>
      </div>

      {isModalOpen && (
        <Modal title={t('会議室を予約する')} onClose={() => setIsModalOpen(false)}>
          <form className="settings-form" onSubmit={handleSubmit}>
            {error && <p className="meeting-room-booking-page__error">{error}</p>}
            <div className="field">
              <label htmlFor="booking-room">{t('会議室名')}</label>
              <select
                id="booking-room"
                value={form.room}
                onChange={(event) => setForm({ ...form, room: event.target.value })}
                required
              >
                {rooms.length === 0 && <option value="">{t('予約可能な会議室がありません')}</option>}
                {rooms.map((room) => (
                  <option key={room.id} value={room.id}>{room.name}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="booking-start">{t('開始時間')}</label>
              <input
                id="booking-start"
                type="datetime-local"
                value={form.start_at}
                onChange={(event) => setForm({ ...form, start_at: event.target.value })}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="booking-end">{t('終了時間')}</label>
              <input
                id="booking-end"
                type="datetime-local"
                value={form.end_at}
                onChange={(event) => setForm({ ...form, end_at: event.target.value })}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="booking-note">{t('備考')}</label>
              <input
                id="booking-note"
                value={form.note}
                onChange={(event) => setForm({ ...form, note: event.target.value })}
                placeholder={t('任意')}
              />
            </div>

            <div className="members-form__actions">
              <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>
                {t('キャンセル')}
              </button>
              <button type="submit" className="btn btn-primary" disabled={isSaving || rooms.length === 0}>
                {isSaving ? t('予約中…') : t('予約')}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
