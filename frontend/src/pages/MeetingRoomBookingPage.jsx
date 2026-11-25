import { useCallback, useEffect, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, Map as MapIcon } from 'lucide-react'
import { fetchFloorPlanItems, fetchReservationsDay } from '../api/meetingRooms'
import DayGrid from '../components/booking/DayGrid'
import ReservationFormModal from '../components/booking/ReservationFormModal'
import { formatDateLabel, shiftDateKey, todayKey } from '../components/booking/bookingTime'
import FloorPlanCanvas from '../components/floorplan/FloorPlanCanvas'
import Modal from '../components/Modal'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import { useToast } from '../context/ToastContext'
import './FloorPlanPage.css'
import './MeetingRoomBookingPage.css'

const TABS = [
  { key: 'calendar', label: 'カレンダー', icon: CalendarDays },
  { key: 'floor', label: 'フロアマップ', icon: MapIcon },
]

function DateNav({ dateKey, onChange }) {
  const { t, language } = useLanguage()
  return (
    <div className="booking-date-nav">
      <button type="button" className="btn btn-secondary" onClick={() => onChange(shiftDateKey(dateKey, -1))} aria-label={t('前の日')}>
        <ChevronLeft size={18} />
      </button>
      <label className="booking-date-nav__date" htmlFor="booking-date-picker">
        <span>{formatDateLabel(dateKey, language)}</span>
        <input
          id="booking-date-picker"
          type="date"
          value={dateKey}
          onChange={(event) => event.target.value && onChange(event.target.value)}
        />
      </label>
      <button type="button" className="btn btn-secondary" onClick={() => onChange(shiftDateKey(dateKey, 1))} aria-label={t('次の日')}>
        <ChevronRight size={18} />
      </button>
      {dateKey !== todayKey() && (
        <button type="button" className="btn btn-secondary booking-date-nav__today" onClick={() => onChange(todayKey())}>
          {t('今日')}
        </button>
      )}
    </div>
  )
}

export default function MeetingRoomBookingPage() {
  const { t } = useLanguage()
  const { showToast } = useToast()
  const { isAdmin } = useAuth()
  const [tab, setTab] = useState('calendar')
  const [dateKey, setDateKey] = useState(todayKey())
  const [day, setDay] = useState({ rooms: [], reservations: [] })
  const [isLoading, setIsLoading] = useState(true)
  const [floorItems, setFloorItems] = useState(null)
  const [floorRoomId, setFloorRoomId] = useState(null) // フロアマップで選んだ会議室（日別モーダル表示中）
  const [form, setForm] = useState(null) // { initial } または { reservation }

  const loadDay = useCallback(() => {
    setIsLoading(true)
    return fetchReservationsDay(dateKey)
      .then((data) => setDay({ rooms: data.rooms, reservations: data.reservations }))
      .catch(() => showToast(t('予約状況の取得に失敗しました'), 'error'))
      .finally(() => setIsLoading(false))
  }, [dateKey, showToast, t])

  useEffect(() => { loadDay() }, [loadDay])

  useEffect(() => {
    if (tab !== 'floor' || floorItems) return
    fetchFloorPlanItems()
      .then(setFloorItems)
      .catch(() => {
        setFloorItems([])
        showToast(t('間取り図の取得に失敗しました'), 'error')
      })
  }, [tab, floorItems, showToast, t])

  const openNew = (room, hour) => setForm({ initial: { room: room.id, date: dateKey, hour } })
  const openExisting = (reservation) => setForm({ reservation })

  const handleSaved = () => {
    setForm(null)
    loadDay()
  }

  const handleShapeClick = (shape) => {
    const room = day.rooms.find((r) => r.id === shape.room)
    if (!room) {
      showToast(t('この場所は予約できません'), 'error')
      return
    }
    setFloorRoomId(room.id)
  }

  const floorRoom = day.rooms.find((r) => r.id === floorRoomId)
  // 間取り図の図形は {id, x, y, ...}。キャンバス側の id として配置IDをそのまま使う
  const shapes = (floorItems || []).map((item) => ({ ...item, id: `item-${item.id}` }))
  const bookableRoomIds = new Set(day.rooms.map((r) => r.id))

  return (
    <div className="booking-page">
      <div className="booking-page__header">
        <h1>{t('会議室予約')}</h1>
        <div className="booking-tabs" role="tablist">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              className={`booking-tabs__tab ${tab === key ? 'is-active' : ''}`}
              onClick={() => setTab(key)}
            >
              <Icon size={16} />
              {t(label)}
            </button>
          ))}
        </div>
      </div>

      <DateNav dateKey={dateKey} onChange={setDateKey} />

      {tab === 'calendar' && (
        <>
          <p className="booking-page__hint">{t('空いているマスをタップすると予約できます。自分の予約をタップすると変更・取り消しができます')}</p>
          {day.rooms.length === 0 && !isLoading ? (
            <p className="booking-page__empty">{t('予約できる会議室がありません')}</p>
          ) : (
            <DayGrid
              dateKey={dateKey}
              rooms={day.rooms}
              reservations={day.reservations}
              isAdmin={isAdmin}
              onCellClick={openNew}
              onReservationClick={openExisting}
            />
          )}
        </>
      )}

      {tab === 'floor' && (
        <>
          <p className="booking-page__hint">{t('予約したい会議室をタップすると、その日の空き状況が表示されます')}</p>
          {floorItems === null ? (
            <p className="settings-page__loading">{t('読み込み中…')}</p>
          ) : shapes.length === 0 ? (
            <p className="booking-page__empty">{t('間取り図がまだ登録されていません')}</p>
          ) : (
            <div className="booking-floor">
              <FloorPlanCanvas
                shapes={shapes.map((shape) => ({
                  ...shape,
                  name: shape.name || day.rooms.find((r) => r.id === shape.room)?.name || '',
                }))}
                mode="view"
                selectedId={null}
                onSelect={() => {}}
                onMove={() => {}}
                onResize={() => {}}
                onShapeClick={handleShapeClick}
              />
              <ul className="booking-floor__legend">
                {day.rooms.filter((room) => shapes.some((s) => s.room === room.id)).map((room) => {
                  const count = day.reservations.filter((r) => r.room === room.id).length
                  return (
                    <li key={room.id}>
                      <button type="button" onClick={() => setFloorRoomId(room.id)}>
                        <strong>{room.name}</strong>
                        <span>{count > 0 ? `${t('予約')} ${count}${t('件')}` : t('終日空き')}</span>
                      </button>
                    </li>
                  )
                })}
              </ul>
              {shapes.some((s) => !bookableRoomIds.has(s.room)) && (
                <p className="booking-page__hint">{t('会議室に紐づいていない図形は予約できません')}</p>
              )}
            </div>
          )}
        </>
      )}

      {/* フロアマップ：選んだ会議室の日別ビュー（フォームを開いている間は隠す） */}
      {floorRoom && !form && (
        <Modal title={`${floorRoom.name}　${formatDateLabel(dateKey)}`} onClose={() => setFloorRoomId(null)}>
          <div className="booking-floor__day">
            <DayGrid
              dateKey={dateKey}
              rooms={[floorRoom]}
              reservations={day.reservations}
              isAdmin={isAdmin}
              onCellClick={openNew}
              onReservationClick={openExisting}
            />
          </div>
        </Modal>
      )}

      {form && (
        <ReservationFormModal
          rooms={day.rooms}
          initial={form.initial}
          reservation={form.reservation}
          onClose={() => setForm(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}
