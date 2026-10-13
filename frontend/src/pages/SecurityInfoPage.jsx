import { useState } from 'react'
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

const DEV_IMPLEMENTED = [
  { category: '認証', detail: 'JWT（djangorestframework-simplejwt）によるトークン認証。アクセストークン8時間・リフレッシュトークン7日間、ローテーション有効' },
  { category: 'パスワード', detail: 'Djangoの標準ハッシュ化保存（平文保存なし）。強度バリデーション4種（ユーザー情報との類似性・最低文字数・一般的すぎるパスワード・数字のみ禁止）を適用' },
  { category: '認可（権限制御）', detail: 'ロールベース（管理者／ユーザー）。会員管理・在室ログ・セキュリティカード管理・設定は管理者限定（IsAdminパーミッションクラス）' },
  { category: 'チャット機能のアクセス制御', detail: '会話・メッセージ・リアクションの全APIが「自分が参加する会話」のみに限定され、第三者（管理者含む）には404を返す。自動テストで検証済み（chat/tests.py）' },
  { category: 'QRコードの不正利用対策', detail: 'django.core.signingによる署名付きトークンを発行し、5分で失効させることで、画面キャプチャの使い回しによる不正入室を防止' },
  { category: 'XSS対策', detail: 'チャットの太字表示はReact要素として描画し、HTML文字列の挿入（dangerouslySetInnerHTML等）は一切使用していない' },
  { category: 'SQLインジェクション対策', detail: '生SQLを使用せず、全てのDB操作をDjango ORM経由で実施（確認済み）' },
  { category: '本番起動時の安全装置', detail: 'DEBUG=Falseで起動する際、開発用の既定SECRET_KEYのままだと起動自体を拒否する仕組みを実装済み（backend/config/settings.py）' },
  { category: '機密情報の環境変数管理', detail: 'DJANGO_SECRET_KEY・DATABASE_URL・DEMO_GATE_PASSWORD等は環境変数で管理し、コードに平文で含めていない' },
  { category: 'デモ環境への簡易アクセス制限', detail: '共通パスワードによる「デモ公開用ゲート」をログイン画面の手前に設置（一時的対応として実装、環境変数未設定時は自動的に無効）' },
  { category: 'デバッグ機能での情報保護', detail: '設定ページの「テーブル確認（開発用）」機能は、パスワードハッシュやWebhookシークレットなどの値を自動的に（非表示）にマスクする' },
  { category: 'セキュリティカード貸出の整合性', detail: '貸出中カードの二重貸出を防止、退室時は会員が借りているカードを自動で返却扱いにする業務ロジック' },
]

const DEV_TODO = [
  { priority: '高', detail: 'ログイン試行のレート制限（未対応）: /api/auth/login/、/api/auth/gate/verify/ に回数制限が未設定' },
  { priority: '高', detail: 'セキュリティヘッダーの追加（未対応）: X-Frame-Options、X-Content-Type-Options、HSTS等の設定が未調整' },
  { priority: '中', detail: 'Django管理画面（/admin/）の扱い（未検討）' },
  { priority: '中', detail: '依存パッケージの脆弱性チェック（未実施）: pip list --outdated / npm audit 等' },
  { priority: '中', detail: 'Webhook機能のSSRF対策（未対応）: 管理者限定機能のためリスクは相対的に低い' },
  { priority: '低', detail: '管理操作の監査ログ（誰がいつ何を変更したかの記録）' },
  { priority: '低', detail: 'Railway上のPostgreSQLの自動バックアップ設定の確認' },
]

export default function SecurityInfoPage() {
  const { t } = useLanguage()
  const [view, setView] = useState('user')

  return (
    <div className="security-info-page">
      <div className="security-info-page__header">
        <div>
          <h1>{t('セキュリティについて')}</h1>
          <p>
            {view === 'user'
              ? t('安心してご利用いただくための取り組みをご紹介します')
              : t('開発者向けの技術的な対策状況です')}
          </p>
        </div>
        <div className="security-info-page__toggle" role="group" aria-label="表示切り替え">
          <button
            type="button"
            className={`security-info-page__toggle-btn ${view === 'user' ? 'is-active' : ''}`}
            onClick={() => setView('user')}
          >
            {t('ユーザー向け')}
          </button>
          <button
            type="button"
            className={`security-info-page__toggle-btn ${view === 'developer' ? 'is-active' : ''}`}
            onClick={() => setView('developer')}
          >
            {t('開発者向け')}
          </button>
        </div>
      </div>

      {view === 'user' ? (
        <>
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
        </>
      ) : (
        <div className="security-info-page__dev">
          <section className="security-info-page__dev-section">
            <h2>{t('実施済みの対策')}</h2>
            <table className="security-info-page__dev-table">
              <tbody>
                {DEV_IMPLEMENTED.map((row) => (
                  <tr key={row.category}>
                    <th>{t(row.category)}</th>
                    <td>{t(row.detail)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="security-info-page__dev-section">
            <h2>{t('追加で実施を推奨する対策（未対応）')}</h2>
            <table className="security-info-page__dev-table security-info-page__dev-table--todo">
              <tbody>
                {DEV_TODO.map((row, index) => (
                  <tr key={index}>
                    <th>
                      <span className={`security-info-page__priority security-info-page__priority--${row.priority}`}>
                        {t(row.priority)}
                      </span>
                    </th>
                    <td>{t(row.detail)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      )}
    </div>
  )
}
