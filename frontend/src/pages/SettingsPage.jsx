import { Settings as SettingsIcon } from 'lucide-react'
import { useLanguage } from '../context/LanguageContext'
import './SettingsPage.css'

export default function SettingsPage() {
  const { t } = useLanguage()

  return (
    <div className="settings-page">
      <div className="settings-page__header">
        <div>
          <h1>{t('設定')}</h1>
          <p>{t('アプリ全体に関わる一般設定です')}</p>
        </div>
      </div>

      <section className="settings-page__section settings-page__section--empty">
        <SettingsIcon size={32} strokeWidth={1.5} />
        <p>{t('現在、設定可能な項目はありません。受付運用に関する設定は「受付設定」、ご自身のアカウント情報は「設定＞ユーザー」をご確認ください。')}</p>
      </section>
    </div>
  )
}
