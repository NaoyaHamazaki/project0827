import { CheckCircle2, XCircle, X } from 'lucide-react'
import { useLanguage } from '../context/LanguageContext'
import './ToastStack.css'

const ICONS = {
  success: CheckCircle2,
  error: XCircle,
}

export default function ToastStack({ toasts, onDismiss }) {
  const { t } = useLanguage()
  if (toasts.length === 0) return null

  return (
    <div className="toast-stack" role="status" aria-live="polite">
      {toasts.map((toast) => {
        const Icon = ICONS[toast.tone] ?? CheckCircle2
        return (
          <div key={toast.id} className={`toast toast--${toast.tone}`}>
            <Icon size={18} strokeWidth={2.2} />
            <span className="toast__message">{toast.message}</span>
            <button
              type="button"
              className="toast__close"
              onClick={() => onDismiss(toast.id)}
              aria-label={t('閉じる')}
            >
              <X size={16} />
            </button>
          </div>
        )
      })}
    </div>
  )
}
