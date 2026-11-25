import { useState } from 'react'
import { cancelReservation, createReservation, updateReservation } from '../../api/meetingRooms'
import { useLanguage } from '../../context/LanguageContext'
import { useToast } from '../../context/ToastContext'
import Modal from '../Modal'
import { atHour, hourLabel, toDateKey } from './bookingTime'

const START_HOURS = Array.from({ length: 24 }, (_, i) => i)

function errorMessage(err) {
  const data = err?.response?.data
  return data?.non_field_errors?.[0] || data?.detail || (Array.isArray(data) ? data[0] : null)
}

/**
 * 会議室予約のフォーム。
 * - 新規: マスをタップしたときの会議室・日付・開始時刻が入った状態で開く（終了は＋1時間。変更可）
 * - 既存（自分の予約／管理者）: 時間・会議室・備考の変更と、予約の取り消しができる
 */
export default function ReservationFormModal({ rooms, initial, reservation, onClose, onSaved }) {
  const { t } = useLanguage()
  const { showToast } = useToast()
  const isEdit = Boolean(reservation)

  const [form, setForm] = useState(() => {
    if (isEdit) {
      const start = new Date(reservation.start_at)
      const end = new Date(reservation.end_at)
      const sameDay = toDateKey(start) === toDateKey(end)
      return {
        room: reservation.room,
        date: toDateKey(start),
        startHour: start.getHours(),
        endHour: sameDay ? Math.max(end.getHours() + (end.getMinutes() > 0 ? 1 : 0), start.getHours() + 1) : 24,
        note: reservation.note || '',
      }
    }
    return {
      room: initial.room, date: initial.date, startHour: initial.hour, endHour: initial.hour + 1, note: '',
    }
  })
  const [isSaving, setIsSaving] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [error, setError] = useState('')

  const set = (key) => (event) => {
    const raw = event.target.value
    setForm((current) => {
      const next = { ...current, [key]: ['startHour', 'endHour', 'room'].includes(key) ? Number(raw) : raw }
      if (key === 'startHour' && next.endHour <= next.startHour) next.endHour = next.startHour + 1
      return next
    })
  }

  const endHours = Array.from({ length: 24 - form.startHour }, (_, i) => form.startHour + 1 + i)

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setIsSaving(true)
    const payload = {
      room: form.room,
      start_at: atHour(form.date, form.startHour).toISOString(),
      end_at: atHour(form.date, form.endHour).toISOString(),
      note: form.note,
    }
    try {
      if (isEdit) {
        await updateReservation(reservation.id, payload)
        showToast(t('予約を変更しました'))
      } else {
        await createReservation(payload)
        showToast(t('予約しました'))
      }
      onSaved()
    } catch (err) {
      setError(errorMessage(err) || t('予約に失敗しました'))
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancelReservation = async () => {
    setIsSaving(true)
    try {
      await cancelReservation(reservation.id)
      showToast(t('予約を取り消しました'))
      onSaved()
    } catch (err) {
      setError(errorMessage(err) || t('取り消しに失敗しました'))
      setIsSaving(false)
    }
  }

  return (
    <Modal title={isEdit ? t('予約の確認・変更') : t('会議室を予約する')} onClose={onClose}>
      <form className="settings-form" onSubmit={handleSubmit}>
        {error && <p className="meeting-room-booking-page__error">{error}</p>}
        {isEdit && !reservation.is_mine && (reservation.company_name || reservation.requested_by_name) && (
          <p className="booking-form__owner">
            {t('予約者')}: {[reservation.requested_by_name, reservation.company_name].filter(Boolean).join(' / ')}
          </p>
        )}
        <div className="field">
          <label htmlFor="booking-room">{t('会議室名')}</label>
          <select id="booking-room" value={form.room} onChange={set('room')} required>
            {rooms.map((room) => (
              <option key={room.id} value={room.id}>{room.name}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="booking-date">{t('日付')}</label>
          <input id="booking-date" type="date" value={form.date} onChange={set('date')} required />
        </div>
        <div className="booking-form__times">
          <div className="field">
            <label htmlFor="booking-start">{t('開始時間')}</label>
            <select id="booking-start" value={form.startHour} onChange={set('startHour')}>
              {START_HOURS.map((hour) => <option key={hour} value={hour}>{hourLabel(hour)}</option>)}
            </select>
          </div>
          <span className="booking-form__tilde" aria-hidden="true">〜</span>
          <div className="field">
            <label htmlFor="booking-end">{t('終了時間')}</label>
            <select id="booking-end" value={form.endHour} onChange={set('endHour')}>
              {endHours.map((hour) => <option key={hour} value={hour}>{hourLabel(hour)}</option>)}
            </select>
          </div>
        </div>
        <div className="field">
          <label htmlFor="booking-note">{t('備考')}</label>
          <input
            id="booking-note"
            value={form.note}
            maxLength={200}
            onChange={set('note')}
            placeholder={t('任意')}
          />
        </div>

        {confirmCancel ? (
          <div className="booking-form__confirm">
            <p>{t('この予約を取り消しますか？')}</p>
            <div className="members-form__actions">
              <button type="button" className="btn btn-secondary" onClick={() => setConfirmCancel(false)}>
                {t('戻る')}
              </button>
              <button type="button" className="btn btn-danger" onClick={handleCancelReservation} disabled={isSaving}>
                {t('取り消す')}
              </button>
            </div>
          </div>
        ) : (
          <div className="members-form__actions booking-form__actions">
            {isEdit && (
              <button
                type="button"
                className="btn btn-secondary booking-form__cancel-reservation"
                onClick={() => setConfirmCancel(true)}
              >
                {t('予約を取り消す')}
              </button>
            )}
            <button type="button" className="btn btn-secondary" onClick={onClose}>{t('閉じる')}</button>
            <button type="submit" className="btn btn-primary" disabled={isSaving}>
              {isSaving ? t('保存中…') : (isEdit ? t('変更を保存') : t('予約'))}
            </button>
          </div>
        )}
      </form>
    </Modal>
  )
}
