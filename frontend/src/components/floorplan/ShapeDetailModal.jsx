import { useEffect, useState } from 'react'
import { fetchReservations } from '../../api/meetingRooms'
import Modal from '../Modal'

const formatRange = (start, end) => {
  const opts = { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }
  const endOpts = { hour: '2-digit', minute: '2-digit' }
  return `${new Date(start).toLocaleString('ja-JP', opts)} 〜 ${new Date(end).toLocaleTimeString('ja-JP', endOpts)}`
}

// 表示モードで図形をクリックしたときの詳細。紐づいた会議室があれば今後の予約も表示する
export default function ShapeDetailModal({ shape, room, onClose }) {
  const [upcoming, setUpcoming] = useState(null)

  useEffect(() => {
    if (!room) return
    fetchReservations()
      .then((list) => {
        const now = new Date()
        setUpcoming(
          list
            .filter((r) => r.room === room.id && r.status === 'confirmed' && new Date(r.end_at) > now)
            .sort((a, b) => new Date(a.start_at) - new Date(b.start_at))
            .slice(0, 3),
        )
      })
      .catch(() => setUpcoming([]))
  }, [room])

  return (
    <Modal title={shape.name || '（名称なし）'} onClose={onClose}>
      <dl className="floor-plan-detail">
        <dt>紐づけ会議室</dt>
        <dd>{room ? room.name : '紐づけなし'}</dd>
        {room && (
          <>
            <dt>予約受付</dt>
            <dd>{room.is_bookable ? '予約可能' : '現在予約不可'}</dd>
          </>
        )}
        <dt>広さ（マス）</dt>
        <dd>{shape.width} × {shape.height}</dd>
        <dt>高さ</dt>
        <dd>{shape.wallHeight} cm</dd>
      </dl>
      {room && (
        <div className="floor-plan-detail__reservations">
          <h3>今後の予約</h3>
          {upcoming === null && <p>読み込み中…</p>}
          {upcoming?.length === 0 && <p>予約はありません</p>}
          {upcoming?.length > 0 && (
            <ul>
              {upcoming.map((r) => (
                <li key={r.id}>
                  <span>{formatRange(r.start_at, r.end_at)}</span>
                  <span>{r.requested_by_name}{r.note ? `（${r.note}）` : ''}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Modal>
  )
}
