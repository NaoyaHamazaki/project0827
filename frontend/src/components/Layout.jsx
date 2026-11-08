import { Fragment, useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { LogOut, Menu, X, ChevronDown, Home } from 'lucide-react'
import { fetchChatUnread } from '../api/chat'
import { useAuth } from '../context/AuthContext'
import { LANGUAGE_TOGGLE_ENABLED, useLanguage } from '../context/LanguageContext'
import { adminGroupsFor, findActiveGroup, userItemsFor } from '../navConfig'
import MiniNav from './MiniNav'
import './Layout.css'

const ROLE_LABELS = {
  master: 'マスター',
  admin: '管理者',
  representative: 'ユーザー（代表）',
  user: 'ユーザー',
}

function LanguageToggle() {
  const { language, setLanguage } = useLanguage()
  return (
    <div className="layout__lang-toggle" role="group" aria-label="Language">
      <button
        type="button"
        className={`layout__lang-btn ${language === 'ja' ? 'is-active' : ''}`}
        onClick={() => setLanguage('ja')}
      >
        JA
      </button>
      <button
        type="button"
        className={`layout__lang-btn ${language === 'en' ? 'is-active' : ''}`}
        onClick={() => setLanguage('en')}
      >
        EN
      </button>
    </div>
  )
}

// 親メニュー押下で展開し、展開時に子メニューの1つ目へ遷移する。
// どのグループが現在地にあたるかは navConfig.findActiveGroup で一括判定した結果を受け取る
// （パスがグループをまたいで前方一致しうるため、グループ単体では判定できない）
function NavGroup({ icon: Icon, label, items, badge, isActiveGroup }) {
  const navigate = useNavigate()
  const [isOpen, setIsOpen] = useState(isActiveGroup)

  useEffect(() => {
    if (isActiveGroup) setIsOpen(true)
  }, [isActiveGroup])

  const handleToggle = () => {
    if (!isOpen) {
      setIsOpen(true)
      if (items.length > 0) navigate(items[0].to)
    } else {
      setIsOpen(false)
    }
  }

  return (
    <div className="layout__group">
      <button
        type="button"
        className={`layout__link layout__group-toggle ${isActiveGroup ? 'active' : ''}`}
        onClick={handleToggle}
        aria-expanded={isOpen}
      >
        <Icon size={18} />
        <span className="layout__group-label">{label}</span>
        {badge > 0 && <span className="layout__badge">{badge}</span>}
        <ChevronDown size={14} className={`layout__group-chevron ${isOpen ? 'is-open' : ''}`} />
      </button>
      {isOpen && (
        <div className="layout__group-children">
          {items.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className="layout__link layout__link--child">
              {item.label}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Layout() {
  const { staff, isAdmin, isMaster, isRepresentative, logout } = useAuth()
  const { t } = useLanguage()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const location = useLocation()
  const [chatUnread, setChatUnread] = useState(0)

  useEffect(() => {
    let cancelled = false
    const load = () => fetchChatUnread()
      .then((count) => { if (!cancelled) setChatUnread(count) })
      .catch(() => {})
    load()
    const timer = setInterval(load, 8000)
    return () => { cancelled = true; clearInterval(timer) }
  }, [location.pathname])

  useEffect(() => {
    setIsMenuOpen(false)
  }, [location.pathname])

  const badges = { chat: chatUnread }
  const adminGroups = adminGroupsFor(isMaster)
  const activeGroup = isAdmin ? findActiveGroup(adminGroups, location.pathname) : null

  return (
    <div className="layout">
      <aside className="layout__sidebar">
        <div className="layout__sidebar-top">
          <div className="layout__brand">{t('受付システム')}</div>
          <button
            type="button"
            className="layout__menu-toggle"
            onClick={() => setIsMenuOpen((current) => !current)}
            aria-label={isMenuOpen ? t('メニューを閉じる') : t('メニューを開く')}
            aria-expanded={isMenuOpen}
          >
            {isMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
        <nav className={`layout__nav ${isMenuOpen ? 'is-open' : ''}`}>
          <NavLink to="/top" className="layout__link">
            <Home size={18} />
            {t('トップ')}
          </NavLink>
          {isAdmin ? (
            adminGroups.map((group) => (
              <Fragment key={group.key}>
                <NavGroup
                  icon={group.icon}
                  label={t(group.label)}
                  items={group.items.map((item) => ({ ...item, label: t(item.label) }))}
                  badge={group.badgeKey ? badges[group.badgeKey] : undefined}
                  isActiveGroup={activeGroup?.key === group.key}
                />
                {group.dividerAfter && <div className="layout__nav-divider" />}
              </Fragment>
            ))
          ) : (
            userItemsFor(isRepresentative).map((item) => (
              <NavLink key={item.key} to={item.to} end={item.end} className="layout__link">
                <item.icon size={18} />
                {t(item.label)}
                {item.badgeKey && badges[item.badgeKey] > 0 && (
                  <span className="layout__badge">{badges[item.badgeKey]}</span>
                )}
              </NavLink>
            ))
          )}
        </nav>
        <div className={`layout__footer ${isMenuOpen ? 'is-open' : ''}`}>
          <div className="layout__user">
            <span className="layout__user-name">{staff?.display_name}</span>
            <span className="layout__user-role">{t(ROLE_LABELS[staff?.role] || 'ユーザー')}</span>
          </div>
          {LANGUAGE_TOGGLE_ENABLED && <LanguageToggle />}
          <button type="button" className="layout__logout" onClick={logout}>
            <LogOut size={16} />
            {t('ログアウト')}
          </button>
        </div>
      </aside>
      <main className="layout__content">
        {isAdmin && activeGroup && <MiniNav group={activeGroup} />}
        <Outlet />
      </main>
    </div>
  )
}
