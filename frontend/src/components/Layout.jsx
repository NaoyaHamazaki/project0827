import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { ScanLine, Users, ClipboardList, LogOut, Settings, Menu, X, History, CreditCard } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { LANGUAGE_TOGGLE_ENABLED, useLanguage } from '../context/LanguageContext'
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

export default function Layout() {
  const { staff, isAdmin, logout } = useAuth()
  const { t } = useLanguage()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const location = useLocation()

  useEffect(() => {
    setIsMenuOpen(false)
  }, [location.pathname])

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
          <NavLink to="/" end className="layout__link">
            <ScanLine size={18} />
            {t('スキャン受付')}
          </NavLink>
          {!isAdmin && (
            <NavLink to="/my-history" className="layout__link">
              <History size={18} />
              {t('利用履歴')}
            </NavLink>
          )}
          {isAdmin && (
            <NavLink to="/members" className="layout__link">
              <Users size={18} />
              {t('会員管理')}
            </NavLink>
          )}
          {isAdmin && (
            <NavLink to="/logs" className="layout__link">
              <ClipboardList size={18} />
              {t('在室・ログ管理')}
            </NavLink>
          )}
          {isAdmin && (
            <NavLink to="/security-cards" className="layout__link">
              <CreditCard size={18} />
              {t('セキュリティカード管理')}
            </NavLink>
          )}
          {isAdmin && (
            <NavLink to="/settings" className="layout__link">
              <Settings size={18} />
              {t('設定')}
            </NavLink>
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
        <Outlet />
      </main>
    </div>
  )
}
