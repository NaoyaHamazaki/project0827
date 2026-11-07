import { useEffect, useState } from 'react'
import { XCircle } from 'lucide-react'
import { cancelReservation, fetchReservations } from '../api/meetingRooms'
import DataTable from '../components/DataTable'
import { useLanguage } from '../context/LanguageContext'
import { useToast } from '../context/ToastContext'
import './MeetingRoomStatusPage.css'

function formatDateTime(iso, language) {
  return new Date(iso).toLocaleString(language === 'en' ? 'en-US' : 'ja-JP', {
    month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  })
}

export default function MeetingRoomStatusPage() {
  const { t, language } = useLanguage()
  const { showToast } = useToast()
  const [reservations, setReservations] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  const load = () => {
    setIsLoading(true)
    fetchReservations()
      .then(setReservations)
      .catch(() => showToast(t('予約一覧の取得に失敗しました'), 'error'))
      .finally(() => setIsLoading(false))
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleCancel = async (reservation) => {
    if (!window.confirm(t('この予約をキャンセルしますか？'))) return
    try {
      await cancelReservation(reservation.id)
      showToast(t('予約をキャンセルしました'))
      load()
    } catch {
      showToast(t('キャンセルに失敗しました'), 'error')
    }
  }

  const columns = [
    { key: 'room_name', header: t('会議室名') },
    {
      key: 'time',
      header: t('時間'),
      render: (row) => `${formatDateTime(row.start_at, language)} 〜 ${formatDateTime(row.end_at, language)}`,
    },
    { key: 'note', header: t('備考'), render: (row) => row.note || '-' },
    {
      key: 'requester',
      header: t('予約者'),
      render: (row) => (
        <span>
          {row.requested_by_name || t('不明')}
          {row.company_name && <span className="meeting-room-status__company"> / {row.company_name}</span>}
        </span>
      ),
    },
    {
      key: 'status',
      header: t('ステータス'),
      render: (row) => (
        <span className={`meeting-room-status__badge meeting-room-status__badge--${row.status}`}>
          {row.status === 'cancelled' ? t('キャンセル') : t('予約済')}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        row.status === 'confirmed' && (
          <button
            type="button"
            className="icon-btn icon-btn--danger"
            onClick={() => handleCancel(row)}
            aria-label={t('キャンセル')}
          >
            <XCircle size={16} />
          </button>
        )
      ),
    },
  ]

  return (
    <div className="meeting-room-status-page">
      <div className="meeting-room-status-page__header">
        <h1>{t('予約状況')}</h1>
        <p>{t('会議室の予約一覧を確認できます')}</p>
      </div>

      {isLoading ? (
        <p className="settings-page__loading">{t('読み込み中…')}</p>
      ) : (
        <DataTable
          columns={columns}
          rows={reservations}
          rowKey={(row) => row.id}
          emptyMessage={t('予約はまだありません')}
        />
      )}
    </div>
  )
}
