import { useEffect, useMemo, useState } from 'react'
import { Armchair, Clock, Minus, Plus, ClipboardCheck } from 'lucide-react'
import { fetchBookableRooms } from '../api/meetingRooms'
import { createOrder, fetchAvailableMenuItems, fetchOrderSettings } from '../api/orders'
import Modal from '../components/Modal'
import { useLanguage } from '../context/LanguageContext'
import { useToast } from '../context/ToastContext'
import './OrderPage.css'

const TIME_STEP_MIN = 5

function parseTime(value) {
  // "HH:MM" or "HH:MM:SS" → [h, m]
  if (!value) return null
  const [h, m] = value.split(':').map(Number)
  return [h, m]
}

function formatHM(date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

// 時間指定の選択肢を作る。先頭は「今すぐ（現在時刻）」、以降は5分刻みで受付終了時刻まで。
// 受付時間が未設定なら当日23:55まで。日をまたぐ設定（例: 22:00〜翌6:00）は翌日の終了時刻まで。
function buildTimeOptions(settings, now) {
  const start = parseTime(settings?.accept_start_time)
  const end = parseTime(settings?.accept_end_time)
  const limit = new Date(now)
  if (start && end) {
    limit.setHours(end[0], end[1], 0, 0)
    const isOvernight = start[0] * 60 + start[1] > end[0] * 60 + end[1]
    const nowMin = now.getHours() * 60 + now.getMinutes()
    if (isOvernight && nowMin >= start[0] * 60 + start[1]) limit.setDate(limit.getDate() + 1)
  } else {
    limit.setHours(23, 55, 0, 0)
  }

  const options = [{ value: '', label: `${formatHM(now)}（今すぐ）` }]
  const slot = new Date(now)
  slot.setSeconds(0, 0)
  slot.setMinutes(Math.floor(slot.getMinutes() / TIME_STEP_MIN) * TIME_STEP_MIN + TIME_STEP_MIN)
  while (slot <= limit) {
    const nextDay = slot.getDate() !== now.getDate()
    options.push({ value: slot.toISOString(), label: `${nextDay ? '翌' : ''}${formatHM(slot)}` })
    slot.setMinutes(slot.getMinutes() + TIME_STEP_MIN)
  }
  return options
}

export default function OrderPage() {
  const { t } = useLanguage()
  const { showToast } = useToast()
  const [rooms, setRooms] = useState([])
  const [menuItems, setMenuItems] = useState([])
  const [acceptingNow, setAcceptingNow] = useState(true)
  const [orderSettings, setOrderSettings] = useState(null)
  const [requestedAt, setRequestedAt] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [roomId, setRoomId] = useState('')
  const [quantities, setQuantities] = useState({})
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    Promise.all([fetchBookableRooms(), fetchAvailableMenuItems(), fetchOrderSettings()])
      .then(([roomsData, menuData, settingsData]) => {
        setRooms(roomsData)
        setMenuItems(menuData)
        setAcceptingNow(settingsData.is_accepting_now)
        setOrderSettings(settingsData)
        setRoomId(roomsData[0]?.id ?? '')
      })
      .catch(() => showToast(t('情報の取得に失敗しました'), 'error'))
      .finally(() => setIsLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const selectedLines = useMemo(
    () => menuItems
      .filter((item) => quantities[item.id] > 0)
      .map((item) => ({ ...item, quantity: quantities[item.id] })),
    [menuItems, quantities],
  )

  // 画面を開いた時刻を基準に選択肢を作る（注文確定時はサーバー側でも時刻を検証する）
  const timeOptions = useMemo(
    () => (orderSettings ? buildTimeOptions(orderSettings, new Date()) : []),
    [orderSettings],
  )
  const requestedLabel = timeOptions.find((option) => option.value === requestedAt)?.label

  const selectedRoom = rooms.find((room) => String(room.id) === String(roomId))

  const handlePickItem = (item) => {
    setQuantities((current) => ({ ...current, [item.id]: current[item.id] > 0 ? current[item.id] : 1 }))
  }

  const changeQuantity = (item, delta) => {
    setQuantities((current) => {
      const next = Math.max(0, (current[item.id] || 0) + delta)
      return { ...current, [item.id]: next }
    })
  }

  const handleSubmit = async () => {
    setIsSubmitting(true)
    try {
      await createOrder({
        room: roomId,
        items: selectedLines.map((line) => ({ menu_item: line.id, quantity: line.quantity })),
        requested_at: requestedAt || null,
      })
      showToast(t('注文しました'))
      setQuantities({})
      setRequestedAt('')
      setIsConfirmOpen(false)
    } catch (err) {
      const data = err?.response?.data
      const detail = data?.non_field_errors?.[0] || data?.items?.[0] || data?.requested_at?.[0]
        || (Array.isArray(data) ? data[0] : null)
      showToast(detail || t('注文に失敗しました'), 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return <p className="settings-page__loading">{t('読み込み中…')}</p>
  }

  if (!acceptingNow) {
    return (
      <div className="order-page">
        <div className="order-page__closed">
          <ClipboardCheck size={40} strokeWidth={1.5} />
          <h1>{t('注文')}</h1>
          <p>{t('現在は注文受付時間外です。受付時間内に改めてお試しください。')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="order-page">
      <h1>{t('注文')}</h1>

      <section className="order-page__section">
        <h2>{t('会議室名')}</h2>
        <div className="order-page__card-grid">
          {rooms.map((room) => (
            <button
              key={room.id}
              type="button"
              className={`order-page__room-card ${String(roomId) === String(room.id) ? 'is-selected' : ''}`}
              onClick={() => setRoomId(room.id)}
            >
              <Armchair size={24} strokeWidth={1.5} />
              <span>{room.name}</span>
            </button>
          ))}
          {rooms.length === 0 && <p className="order-page__empty">{t('利用できる会議室がありません')}</p>}
        </div>
      </section>

      <section className="order-page__section">
        <h2>{t('メニュー')}</h2>
        <div className="order-page__card-grid">
          {menuItems.map((item) => {
            const qty = quantities[item.id] || 0
            return (
              <div key={item.id} className={`order-page__menu-card ${qty > 0 ? 'is-selected' : ''}`}>
                <button
                  type="button"
                  className="order-page__menu-card-btn"
                  onClick={() => handlePickItem(item)}
                >
                  {item.name}
                </button>
                {qty > 0 && (
                  <div className="order-page__stepper">
                    <button type="button" onClick={() => changeQuantity(item, -1)} aria-label={t('減らす')}>
                      <Minus size={14} />
                    </button>
                    <span>{qty}</span>
                    <button type="button" onClick={() => changeQuantity(item, 1)} aria-label={t('増やす')}>
                      <Plus size={14} />
                    </button>
                  </div>
                )}
              </div>
            )
          })}
          {menuItems.length === 0 && <p className="order-page__empty">{t('注文できるメニューがありません')}</p>}
        </div>
      </section>

      <section className="order-page__section">
        <h2>{t('お届け時刻')}</h2>
        <label className="order-page__time" htmlFor="order-requested-at">
          <Clock size={18} strokeWidth={1.8} aria-hidden="true" />
          <select
            id="order-requested-at"
            value={requestedAt}
            onChange={(event) => setRequestedAt(event.target.value)}
          >
            {timeOptions.map((option) => (
              <option key={option.value || 'now'} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <p className="order-page__hint">{t('5分刻みで、受付時間内の時刻を指定できます')}</p>
      </section>

      <button
        type="button"
        className="btn btn-primary order-page__submit"
        disabled={!roomId || selectedLines.length === 0}
        onClick={() => setIsConfirmOpen(true)}
      >
        {t('注文')}
      </button>

      {isConfirmOpen && (
        <Modal title={t('注文内容の確認')} onClose={() => setIsConfirmOpen(false)}>
          <div className="order-page__confirm">
            <p className="order-page__confirm-room">{t('会議室')}: {selectedRoom?.name}</p>
            <p className={`order-page__confirm-time ${requestedAt ? 'is-scheduled' : ''}`}>
              {t('お届け時刻')}: {requestedAt ? `${requestedLabel} ${t('指定')}` : requestedLabel}
            </p>
            <ul className="order-page__confirm-list">
              {selectedLines.map((line) => (
                <li key={line.id}>
                  <span>{line.name}</span>
                  <span>{t('数量')}: {line.quantity}</span>
                </li>
              ))}
            </ul>
            <div className="members-form__actions">
              <button type="button" className="btn btn-secondary" onClick={() => setIsConfirmOpen(false)}>
                {t('キャンセル')}
              </button>
              <button type="button" className="btn btn-primary" onClick={handleSubmit} disabled={isSubmitting}>
                {isSubmitting ? t('注文中…') : t('注文を確定する')}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
