import {
  Armchair, ClipboardCheck, MessageCircle, Megaphone, ScanLine, Settings, Users,
} from 'lucide-react'

// サイドバー・トップページ・各ページのミニナビで共有する、管理者側メニューの構成。
// 1箇所を直せば3箇所すべてに反映される。
export const ADMIN_NAV_GROUPS = [
  {
    key: 'reception',
    icon: ScanLine,
    label: '受付',
    items: [
      { to: '/', end: true, label: 'スキャン受付' },
      { to: '/logs', label: '受付ログ' },
      { to: '/reception-settings', label: '受付設定' },
    ],
  },
  {
    key: 'chat',
    icon: MessageCircle,
    label: 'チャット',
    badgeKey: 'chat',
    items: [
      { to: '/chat', label: 'チャット連絡' },
      { to: '/chat-settings', label: 'チャット設定' },
    ],
  },
  {
    key: 'meeting-rooms',
    icon: Armchair,
    label: '会議室',
    items: [
      { to: '/meeting-rooms/book', label: '会議室予約' },
      { to: '/meeting-rooms/status', label: '予約状況' },
      { to: '/meeting-rooms/settings', label: '会議室設定' },
    ],
  },
  {
    key: 'orders',
    icon: ClipboardCheck,
    label: '注文',
    dividerAfter: true,
    items: [
      { to: '/orders', end: true, label: '注文一覧' },
      { to: '/orders/menu-settings', label: 'メニュー設定' },
    ],
  },
  {
    key: 'members',
    icon: Users,
    label: '会員管理',
    items: [
      { to: '/members', end: true, label: '会員一覧' },
      { to: '/members/new', label: '新規会員作成' },
      { to: '/security-cards', label: 'セキュリティカード' },
    ],
  },
  {
    key: 'settings',
    icon: Settings,
    label: '設定',
    items: [
      { to: '/settings', end: true, label: '一般' },
      { to: '/settings/account', label: 'ユーザー' },
    ],
  },
  {
    key: 'announcements',
    icon: Megaphone,
    label: 'お知らせ',
    items: [
      { to: '/announcements', end: true, label: 'アップデート情報' },
      { to: '/security-info', label: 'セキュリティについて' },
      { to: '/settings/debug-tables', label: '（テスト用）テーブル情報' },
    ],
  },
]

// ユーザー側メニュー（サブメニューを持たないフラットな項目のみ）
export const USER_NAV_ITEMS = [
  { key: 'scan', icon: ScanLine, to: '/', end: true, label: 'スキャン受付' },
  { key: 'chat', icon: MessageCircle, to: '/chat', label: 'チャット', badgeKey: 'chat' },
  { key: 'meeting-rooms', icon: Armchair, to: '/meeting-rooms/book', label: '会議室予約' },
  { key: 'orders', icon: ClipboardCheck, to: '/orders/new', label: '注文' },
  { key: 'settings', icon: Settings, to: '/account-settings', label: '設定' },
]

export function pathMatchesItem(pathname, to) {
  if (to === '/') return pathname === '/'
  return pathname === to || pathname.startsWith(`${to}/`)
}

// パスは複数グループにまたがってマッチしうる（例: /settings/debug-tables は
// 設定グループの /settings にも、お知らせグループの /settings/debug-tables にも前方一致する）ので、
// 最も長く一致する項目を持つグループを採用する
export function findActiveGroup(groups, pathname) {
  let best = null
  let bestLength = -1
  groups.forEach((group) => {
    group.items.forEach((item) => {
      if (pathMatchesItem(pathname, item.to) && item.to.length > bestLength) {
        best = group
        bestLength = item.to.length
      }
    })
  })
  return best
}
