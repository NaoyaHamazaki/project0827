import { ShieldQuestion, Sparkles } from 'lucide-react'
import { useLanguage } from '../context/LanguageContext'
import './ChatSettingsPage.css'

const PLANNED_FEATURES = [
  {
    icon: Sparkles,
    title: 'チャット履歴AIマスキング',
    body: 'チャットの内容をAIが定期的にチェックし、漏洩した場合の影響が大きい情報と判断したものを自動的にマスキングします。',
  },
  {
    icon: ShieldQuestion,
    title: 'マスキング判断（人による確認）',
    body: 'AIが自動判断できなかったメッセージを一覧化し、担当者が確認のうえマスキング対象かどうかを判断できるようにします。',
  },
]

export default function ChatSettingsPage() {
  const { t } = useLanguage()
  return (
    <div className="chat-settings-page">
      <div className="chat-settings-page__header">
        <h1>{t('チャット設定')}</h1>
        <p>{t('以下は検討中の機能です。詳細な仕様はドキュメントに記録しており、まだ実装はされていません')}</p>
      </div>

      <div className="chat-settings-page__list">
        {PLANNED_FEATURES.map(({ icon: Icon, title, body }) => (
          <div key={title} className="chat-settings-page__card">
            <div className="chat-settings-page__icon">
              <Icon size={20} />
            </div>
            <div className="chat-settings-page__card-body">
              <div className="chat-settings-page__card-title-row">
                <h2>{t(title)}</h2>
                <span className="chat-settings-page__badge">{t('検討中')}</span>
              </div>
              <p>{t(body)}</p>
            </div>
          </div>
        ))}
      </div>

      <p className="chat-settings-page__footer">
        {t('docs/チャット設定_AIマスキング仕様案.md に仕様案を記録しています')}
      </p>
    </div>
  )
}
