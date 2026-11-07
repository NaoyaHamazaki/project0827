import { Construction } from 'lucide-react'
import { useLanguage } from '../context/LanguageContext'
import './PlaceholderPage.css'

export default function PlaceholderPage({ title }) {
  const { t } = useLanguage()
  return (
    <div className="placeholder-page">
      <div className="placeholder-page__card">
        <Construction size={40} strokeWidth={1.5} />
        <h1>{t(title)}</h1>
        <p>{t('この機能は現在開発中です。今しばらくお待ちください。')}</p>
      </div>
    </div>
  )
}
