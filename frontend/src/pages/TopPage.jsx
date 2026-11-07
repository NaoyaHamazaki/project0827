import { useNavigate } from 'react-router-dom'
import { ADMIN_NAV_GROUPS } from '../navConfig'
import { useLanguage } from '../context/LanguageContext'
import './TopPage.css'

// 大きなカードで各メニューへ遷移できるトップページ（スマホ操作に不慣れな方にも分かりやすいように）
export default function TopPage() {
  const { t } = useLanguage()
  const navigate = useNavigate()

  return (
    <div className="top-page">
      <h1>{t('トップ')}</h1>
      <p className="top-page__desc">{t('使いたいメニューを選んでください')}</p>
      <div className="top-page__grid">
        {ADMIN_NAV_GROUPS.map((group) => {
          const Icon = group.icon
          return (
            <button
              key={group.key}
              type="button"
              className="top-page__card"
              onClick={() => navigate(group.items[0].to)}
            >
              <Icon size={40} strokeWidth={1.5} />
              <span>{t(group.label)}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
