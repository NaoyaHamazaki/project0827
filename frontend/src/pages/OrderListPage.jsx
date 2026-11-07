import { useEffect, useState } from 'react'
import { fetchOrders, updateOrderStatus } from '../api/orders'
import DataTable from '../components/DataTable'
import { useLanguage } from '../context/LanguageContext'
import { useToast } from '../context/ToastContext'
import './OrderListPage.css'

const STATUS_LABELS = {
  received: '受付',
  done: '対応済',
  cancelled: '取消',
}

const ALL_STATUSES = ['received', 'done', 'cancelled']

function StatusCell({ order, onChanged }) {
  const { t } = useLanguage()
  const [isOpen, setIsOpen] = useState(false)

  const handlePick = async (status) => {
    setIsOpen(false)
    if (status === order.status) return
    if (!window.confirm(`ステータスを「${t(STATUS_LABELS[status])}」に変更しますか？`)) return
    try {
      const updated = await updateOrderStatus(order.id, status)
      onChanged(updated)
    } catch {
      // 失敗時は一覧の再取得で整合させる想定（呼び出し元でエラートースト表示）
      onChanged(null)
    }
  }

  return (
    <div className="order-list__status-cell">
      <button
        type="button"
        className={`order-list__status-badge order-list__status-badge--${order.status}`}
        onClick={() => setIsOpen((current) => !current)}
      >
        {t(STATUS_LABELS[order.status])}
      </button>
      {isOpen && (
        <div className="order-list__status-menu">
          {ALL_STATUSES.filter((status) => status !== order.status).map((status) => (
            <button key={status} type="button" onClick={() => handlePick(status)}>
              {t(STATUS_LABELS[status])}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function OrderListPage() {
  const { t, language } = useLanguage()
  const { showToast } = useToast()
  const [orders, setOrders] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  const load = () => {
    setIsLoading(true)
    fetchOrders()
      .then(setOrders)
      .catch(() => showToast(t('注文一覧の取得に失敗しました'), 'error'))
      .finally(() => setIsLoading(false))
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleChanged = (updated) => {
    if (!updated) {
      showToast(t('更新に失敗しました'), 'error')
      load()
      return
    }
    setOrders((current) => current.map((order) => (order.id === updated.id ? updated : order)))
  }

  const columns = [
    { key: 'room_name', header: t('会議室名') },
    {
      key: 'content',
      header: t('注文内容'),
      render: (row) => row.lines.map((line) => `${line.menu_item_name} x${line.quantity}`).join('、'),
    },
    {
      key: 'requester',
      header: t('注文者'),
      render: (row) => (
        <span>
          {row.requested_by_name || t('不明')}
          {row.company_name && <span className="order-list__company"> / {row.company_name}</span>}
        </span>
      ),
    },
    {
      key: 'created_at',
      header: t('注文日時'),
      render: (row) => new Date(row.created_at).toLocaleString(language === 'en' ? 'en-US' : 'ja-JP', {
        month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
      }),
    },
    {
      key: 'status',
      header: t('ステータス'),
      render: (row) => <StatusCell order={row} onChanged={handleChanged} />,
    },
  ]

  return (
    <div className="order-list-page">
      <div className="order-list-page__header">
        <h1>{t('注文一覧')}</h1>
        <p>{t('ユーザーからの注文を確認し、ステータスを更新できます（ステータスをタップすると変更できます）')}</p>
      </div>

      {isLoading ? (
        <p className="settings-page__loading">{t('読み込み中…')}</p>
      ) : (
        <DataTable columns={columns} rows={orders} rowKey={(row) => row.id} emptyMessage={t('注文はまだありません')} />
      )}
    </div>
  )
}
