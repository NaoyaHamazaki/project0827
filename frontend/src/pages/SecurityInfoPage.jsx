import { Lock, ShieldCheck, Users, Timer, MessageCircleOff, Cloud, Smartphone, Server, Database, ArrowRight } from 'lucide-react'
import { useLanguage } from '../context/LanguageContext'
import './SecurityInfoPage.css'

const SECTIONS = [
  {
    icon: Lock,
    title: '通信の暗号化',
    body: 'このシステムとの通信はすべて暗号化（HTTPS）されています。入力していただいた情報が、通信の途中で第三者に盗み見られることはありません。',
  },
  {
    icon: ShieldCheck,
    title: 'パスワードの保護',
    body: 'ログインパスワードは暗号化して保存されています。運営者を含め、誰も元のパスワードの文字列を見ることはできません。',
  },
  {
    icon: Users,
    title: '操作できる範囲の制限',
    body: '管理者とそれ以外のアカウントで、操作できる範囲を分けています。会員情報の編集やシステム設定の変更など、重要な操作は管理者のみが行えるようになっています。',
  },
  {
    icon: Timer,
    title: 'QRコードの有効期限',
    body: '受付でご提示いただくQRコードは5分間で自動的に無効になり、新しいものに切り替わります。万が一画面を撮影・保存されても、時間が経てば使えなくなるため安全です。',
  },
  {
    icon: MessageCircleOff,
    title: 'チャットのプライバシー',
    body: 'チャット機能でのやり取りは、会話をしているご本人同士にしか表示されません。管理者であっても、第三者同士の会話の内容を見ることはできない仕組みになっています。',
  },
  {
    icon: Cloud,
    title: 'データの保管',
    body: 'データはクラウド上の安全な環境に保管されており、不正なアクセスやデータの持ち出しを防ぐための対策を行っています。',
  },
]

export default function SecurityInfoPage() {
  const { t } = useLanguage()
  return (
    <div className="security-info-page">
      <div className="security-info-page__header">
        <h1>{t('セキュリティについて')}</h1>
        <p>{t('安心してご利用いただくための取り組みをご紹介します')}</p>
      </div>

      <div className="security-info-page__diagram">
        <div className="security-info-page__diagram-node">
          <Smartphone size={24} />
          <span>{t('あなたの端末')}</span>
        </div>
        <div className="security-info-page__diagram-arrow">
          <ArrowRight size={20} />
          <span className="security-info-page__diagram-lock"><Lock size={14} />{t('暗号化通信')}</span>
        </div>
        <div className="security-info-page__diagram-node">
          <Server size={24} />
          <span>{t('サーバー')}</span>
        </div>
        <div className="security-info-page__diagram-arrow">
          <ArrowRight size={20} />
          <span className="security-info-page__diagram-lock"><Lock size={14} />{t('暗号化保存')}</span>
        </div>
        <div className="security-info-page__diagram-node">
          <Database size={24} />
          <span>{t('データベース')}</span>
        </div>
      </div>

      <div className="security-info-page__grid">
        {SECTIONS.map(({ icon: Icon, title, body }) => (
          <div key={title} className="security-info-page__card">
            <div className="security-info-page__icon">
              <Icon size={22} />
            </div>
            <h2>{t(title)}</h2>
            <p>{t(body)}</p>
          </div>
        ))}
      </div>

      <p className="security-info-page__footer">
        {t('ご不明な点やご不安な点がございましたら、お気軽にお問い合わせください。')}
      </p>
    </div>
  )
}
