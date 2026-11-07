import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  ScanLine, LogOut, Menu, X, MessageCircle, ChevronDown, Armchair, ClipboardCheck, Home,
} from 'lucide-react'
import { fetchAdminChatTargets, fetchChatUnread } from '../api/chat'
import { useAuth } from '../context/AuthContext'
import { LANGUAGE_TOGGLE_ENABLED, useLanguage } from '../context/LanguageContext'
import { ADMIN_NAV_GROUPS, findActiveGroup } from '../navConfig'
import MiniNav from './MiniNav'
import './Layout.css'

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

// チャットの子メニューは「同一事業者の管理者一覧」を動的に取得して表示する（ユーザー側のみ）
function UserChatNavGroup({ unread }) {
  const { t } = useLanguage()
  const location = useLocation()
  const navigate = useNavigate()
  const [admins, setAdmins] = useState([])
  const isActiveGroup = location.pathname.startsWith('/chat')
  const [isOpen, setIsOpen] = useState(isActiveGroup)

  useEffect(() => {
    fetchAdminChatTargets().then(setAdmins).catch(() => setAdmins([]))
  }, [])

  useEffect(() => {
    if (isActiveGroup) setIsOpen(true)
  }, [isActiveGroup])

  const handleToggle = () => {
    if (!isOpen) {
      setIsOpen(true)
      if (admins.length > 0) navigate(`/chat?with=${admins[0].id}`)
      else navigate('/chat')
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
        <MessageCircle size={18} />
        <span className="layout__group-label">{t('チャット')}</span>
        {unread > 0 && <span className="layout__badge">{unread}</span>}
        <ChevronDown size={14} className={`layout__group-chevron ${isOpen ? 'is-open' : ''}`} />
      </button>
      {isOpen && (
        <div className="layout__group-children">
          {admins.map((admin) => (
            <NavLink
              key={admin.id}
              to={`/chat?with=${admin.id}`}
              className={() => `layout__link layout__link--child ${
                location.pathname.startsWith('/chat') && location.search === `?with=${admin.id}` ? 'active' : ''
              }`}
            >
              {admin.display_name}
            </NavLink>
          ))}
          {admins.length === 0 && (
            <span className="layout__link layout__link--child layout__link--empty">
              {t('管理者アカウントがありません')}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

export default function Layout() {
  const { staff, isAdmin, logout } = useAuth()
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
  const activeGroup = isAdmin ? findActiveGroup(ADMIN_NAV_GROUPS, location.pathname) : null

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
          {isAdmin ? (
            <>
              <NavLink to="/top" className="layout__link">
                <Home size={18} />
                {t('トップ')}
              </NavLink>
              {ADMIN_NAV_GROUPS.map((group) => (
                <NavGroup
                  key={group.key}
                  icon={group.icon}
                  label={t(group.label)}
                  items={group.items.map((item) => ({ ...item, label: t(item.label) }))}
                  badge={group.badgeKey ? badges[group.badgeKey] : undefined}
                  isActiveGroup={activeGroup?.key === group.key}
                />
              ))}
            </>
          ) : (
            <>
              <NavLink to="/" end className="layout__link">
                <ScanLine size={18} />
                {t('スキャン受付')}
              </NavLink>
              <UserChatNavGroup unread={chatUnread} />
              <NavLink to="/meeting-rooms/book" className="layout__link">
                <Armchair size={18} />
                {t('会議室予約')}
              </NavLink>
              <NavLink to="/orders/new" className="layout__link">
                <ClipboardCheck size={18} />
                {t('注文')}
              </NavLink>
              <NavLink to="/account-settings" className="layout__link">
                <ClipboardCheck size={18} />
                {t('設定')}
              </NavLink>
            </>
          )}
        </nav>
        <div className={`layout__footer ${isMenuOpen ? 'is-open' : ''}`}>
          <div className="layout__user">
            <span className="layout__user-name">{staff?.display_name}</span>
            <span className="layout__user-role">{isAdmin ? t('管理者') : t('ユーザー')}</span>
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
