import { useEffect } from 'react'
import { X } from 'lucide-react'
import { useLanguage } from '../context/LanguageContext'
import './Modal.css'

export default function Modal({ title, onClose, children }) {
  const { t } = useLanguage()
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div className="modal-overlay" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal__header">
          <h2>{title}</h2>
          <button type="button" className="modal__close" onClick={onClose} aria-label={t('閉じる')}>
            <X size={20} />
          </button>
        </div>
        <div className="modal__body">{children}</div>
      </div>
    </div>
  )
}
