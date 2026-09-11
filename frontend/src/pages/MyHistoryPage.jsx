import { useEffect, useState } from 'react'
import { LogIn as CheckInIcon, LogOut as CheckOutIcon, ArrowRight } from 'lucide-react'
import { fetchMyHistory } from '../api/access'
import { useLanguage } from '../context/LanguageContext'
import './MyHistoryPage.css'

function formatDateTime(isoString, language) {
  return new Date(isoString).toLocaleString(language === 'en' ? 'en-US' : 'ja-JP', {
    month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  })
}

function currentYearMonth() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export default function MyHistoryPage() {
  const { t, language } = useLanguage()
  const [yearMonth, setYearMonth] = useState(currentYearMonth())
  const [history, setHistory] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const [year, month] = yearMonth.split('-').map(Number)
    setIsLoading(true)
    fetchMyHistory({ year, month })
      .then((data) => {
        setHistory(data)
        setError('')
      })
      .catch(() => {
        setError(t('アカウントに会員情報が紐付けられていません。管理者にお問い合わせください'))
        setHistory(null)
      })
      .finally(() => setIsLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [yearMonth, language])

  return (
    <div className="my-history-page">
      <div className="my-history-page__header">
        <h1>{t('利用履歴')}</h1>
        <input
          type="month"
          value={yearMonth}
          onChange={(event) => setYearMonth(event.target.value)}
        />
      </div>

      {isLoading ? (
        <p className="my-history-page__loading">{t('読み込み中…')}</p>
      ) : error ? (
        <p className="my-history-page__error">{error}</p>
      ) : (
        <>
          <div className="my-history-page__summary">
            <div className="my-history-page__stat">
              <span className="my-history-page__stat-label">{t('来場回数')}</span>
              <span className="my-history-page__stat-value">
                {language === 'en' ? history.visit_count : `${history.visit_count}回`}
              </span>
            </div>
            <div className="my-history-page__stat">
              <span className="my-history-page__stat-label">{t('滞在時間合計')}</span>
              <span className="my-history-page__stat-value">{history.used_hours}h</span>
            </div>
            <div className="my-history-page__stat">
              <span className="my-history-page__stat-label">{t('上限 / 残り')}</span>
              <span className="my-history-page__stat-value">
                {history.limit_hours == null
                  ? t('無制限')
                  : language === 'en'
                    ? `${history.limit_hours}h / ${history.remaining_hours}h remaining`
                    : `${history.limit_hours}h / 残り${history.remaining_hours}h`}
              </span>
            </div>
          </div>

          {history.sessions.length === 0 ? (
            <p className="my-history-page__empty">{t('この月の来場記録はありません')}</p>
          ) : (
            <ul className="my-history-page__list">
              {history.sessions.map((session) => (
                <li key={session.check_in} className="my-history-session">
                  <div className="my-history-session__times">
                    <span className="my-history-session__time">
                      <CheckInIcon size={16} />
                      {formatDateTime(session.check_in, language)}
                    </span>
                    <ArrowRight size={16} className="my-history-session__arrow" />
                    <span className="my-history-session__time">
                      <CheckOutIcon size={16} />
                      {session.is_ongoing ? (
                        <span className="my-history-session__ongoing">{t('在室中')}</span>
                      ) : (
                        formatDateTime(session.check_out, language)
                      )}
                    </span>
                  </div>
                  <span className="my-history-session__duration">{session.duration_hours}h</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  )
}
