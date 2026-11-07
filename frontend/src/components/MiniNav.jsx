import { NavLink } from 'react-router-dom'
import { Home } from 'lucide-react'
import { useLanguage } from '../context/LanguageContext'
import './MiniNav.css'

// 各ページの上部に表示する、現在のメニューグループ内を行き来するための横一列のミニナビ。
// スマホでハンバーガーメニューを開かなくても同グループの別ページへ移動できるようにする
export default function MiniNav({ group }) {
  const { t } = useLanguage()
  return (
    <nav className="mini-nav" aria-label={t('ページ内メニュー')}>
      <NavLink to="/top" className="mini-nav__item">
        <Home size={14} />
        {t('トップ')}
      </NavLink>
      {group.items.map((item) => (
        <NavLink key={item.to} to={item.to} end={item.end} className="mini-nav__item">
          {t(item.label)}
        </NavLink>
      ))}
    </nav>
  )
}
