import { useEffect, useRef } from 'react'
import { useLanguage } from '../../context/LanguageContext'
import {
  DEFAULT_VIEW_START_HOUR, ROW_HEIGHT, atHour, formatHM, hourLabel, minutesWithinDay, todayKey,
} from './bookingTime'
import './DayGrid.css'

const HOURS = Array.from({ length: 24 }, (_, i) => i)

/**
 * 日別ビュー（行＝時刻 1時間単位、列＝会議室）。
 * 0:00〜24:00 まで予約できるが、開いたときは 9:00 から表示する（上下にスクロールで他の時間帯）。
 * - 空きマスをタップ → onCellClick(room, hour)
 * - 自分の予約（管理者はすべての予約）をタップ → onReservationClick(reservation)
 * - 他の人の予約は「予約済」とだけ表示する
 */
export default function DayGrid({ dateKey, rooms, reservations, isAdmin, onCellClick, onReservationClick }) {
  const { t } = useLanguage()
  const scrollRef = useRef(null)
  const now = new Date()
  const isToday = dateKey === todayKey()

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = DEFAULT_VIEW_START_HOUR * ROW_HEIGHT
  }, [dateKey])

  const nowTop = (now.getHours() * 60 + now.getMinutes()) * (ROW_HEIGHT / 60)

  return (
    <div className="day-grid" ref={scrollRef} style={{ '--day-grid-cols': rooms.length }}>
      <div className="day-grid__head">
        <div className="day-grid__corner" />
        {rooms.map((room) => (
          <div key={room.id} className="day-grid__room-name">{room.name}</div>
        ))}
      </div>

      <div className="day-grid__body" style={{ height: 24 * ROW_HEIGHT }}>
        <div className="day-grid__times">
          {HOURS.map((hour) => (
            <div key={hour} className="day-grid__time" style={{ height: ROW_HEIGHT }}>
              <span>{hourLabel(hour)}</span>
            </div>
          ))}
        </div>

        {rooms.map((room) => {
          const roomReservations = reservations.filter((r) => r.room === room.id)
          return (
            <div key={room.id} className="day-grid__col">
              {HOURS.map((hour) => {
                const isPast = atHour(dateKey, hour + 1) <= now
                return (
                  <button
                    key={hour}
                    type="button"
                    className={`day-grid__cell ${isPast ? 'is-past' : ''}`}
                    style={{ height: ROW_HEIGHT }}
                    disabled={isPast}
                    onClick={() => onCellClick(room, hour)}
                    aria-label={`${room.name} ${hourLabel(hour)} ${t('を予約')}`}
                  />
                )
              })}

              {roomReservations.map((reservation) => {
                const { start, end } = minutesWithinDay(reservation, dateKey)
                const canOpen = reservation.is_mine || isAdmin
                const top = start * (ROW_HEIGHT / 60)
                const height = Math.max((end - start) * (ROW_HEIGHT / 60), 20)
                const timeText = `${formatHM(new Date(reservation.start_at))}–${formatHM(new Date(reservation.end_at))}`
                const who = reservation.is_mine
                  ? t('自分の予約')
                  : (reservation.company_name || reservation.requested_by_name || t('予約済'))
                return (
                  <button
                    key={reservation.id}
                    type="button"
                    className={`day-grid__chip ${reservation.is_mine ? 'is-mine' : 'is-other'}`}
                    style={{ top, height }}
                    disabled={!canOpen}
                    onClick={() => canOpen && onReservationClick(reservation)}
                    title={`${who} ${timeText}`}
                  >
                    <strong>{who}</strong>
                    <span>{timeText}</span>
                    {canOpen && reservation.note && <span className="day-grid__chip-note">{reservation.note}</span>}
                  </button>
                )
              })}
            </div>
          )
        })}

        {isToday && <div className="day-grid__now" style={{ top: nowTop }} aria-hidden="true" />}
      </div>
    </div>
  )
}
