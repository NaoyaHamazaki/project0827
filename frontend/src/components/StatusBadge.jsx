import { useLanguage } from '../context/LanguageContext'
import './StatusBadge.css'

const STATUS_LABELS = {
  active: '有効',
  inactive: '無効',
  check_in: '入室',
  check_out: '退室',
  available: '在庫',
  loaned: '貸出中',
  lost: '紛失',
  retired: '廃止',
}

function toneFor(status) {
  if (['active', 'check_in', 'available'].includes(status)) return 'positive'
  if (['check_out', 'retired'].includes(status)) return 'muted'
  if (status === 'loaned') return 'info'
  return 'negative'
}

export default function StatusBadge({ status }) {
  const { t } = useLanguage()
  const tone = toneFor(status)
  const label = STATUS_LABELS[status]
  return <span className={`status-badge status-badge--${tone}`}>{label ? t(label) : status}</span>
}
