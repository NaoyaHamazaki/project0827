import { Fragment } from 'react'
import { useNavigate } from 'react-router-dom'
import { adminGroupsFor, userItemsFor } from '../navConfig'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import './TopPage.css'

// 大きなカードで各メニューへ遷移できるトップページ（スマホ操作に不慣れな方にも分かりやすいように）。
// 管理者・ユーザーの両方で表示する
export default function TopPage() {
  const { t } = useLanguage()
  const { isAdmin, isMaster, isRepresentative } = useAuth()
  const navigate = useNavigate()

  const items = isAdmin
    ? adminGroupsFor(isMaster).map((group) => ({
      key: group.key, icon: group.icon, label: group.label, to: group.items[0].to,
      dividerAfter: group.dividerAfter,
    }))
    : userItemsFor(isRepresentative).map((item) => ({ key: item.key, icon: item.icon, label: item.label, to: item.to }))

  return (
    <div className="top-page">
      <h1>{t('トップ')}</h1>
      <p className="top-page__desc">{t('使いたいメニューを選んでください')}</p>
      <div className="top-page__grid">
        {items.map((item) => (
          <Fragment key={item.key}>
            <button
              type="button"
              className="top-page__card"
              onClick={() => navigate(item.to)}
            >
              <item.icon size={40} strokeWidth={1.5} />
              <span>{t(item.label)}</span>
            </button>
            {item.dividerAfter && <div className="top-page__divider" />}
          </Fragment>
        ))}
      </div>
    </div>
  )
}
