// 会議室予約（日別ビュー）で使う日付・時刻のヘルパー。日付はすべて端末のローカル時刻で扱う

export const ROW_HEIGHT = 48 // 1時間＝1行の高さ(px)
export const DEFAULT_VIEW_START_HOUR = 9 // 開いたときに先頭に表示する時刻
export const DEFAULT_VIEW_HOURS = 9 // 初期表示で見える時間数（9:00〜18:00）

export function toDateKey(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function todayKey() {
  return toDateKey(new Date())
}

export function shiftDateKey(dateKey, days) {
  const [y, m, d] = dateKey.split('-').map(Number)
  return toDateKey(new Date(y, m - 1, d + days))
}

// dateKey の hour 時（24 なら翌日 0 時）の Date
export function atHour(dateKey, hour) {
  const [y, m, d] = dateKey.split('-').map(Number)
  return new Date(y, m - 1, d, hour, 0, 0, 0)
}

export function hourLabel(hour) {
  return `${String(hour).padStart(2, '0')}:00`
}

export function formatHM(date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

export function formatDateLabel(dateKey, language = 'ja') {
  const date = atHour(dateKey, 0)
  return date.toLocaleDateString(language === 'en' ? 'en-US' : 'ja-JP', {
    year: 'numeric', month: 'numeric', day: 'numeric', weekday: 'short',
  })
}

// 予約の開始・終了を、その日の 0:00 からの分数に変換（日をまたぐ予約はその日の範囲に切り詰める）
export function minutesWithinDay(reservation, dateKey) {
  const dayStart = atHour(dateKey, 0).getTime()
  const start = (new Date(reservation.start_at).getTime() - dayStart) / 60000
  const end = (new Date(reservation.end_at).getTime() - dayStart) / 60000
  return { start: Math.max(0, start), end: Math.min(24 * 60, end) }
}
