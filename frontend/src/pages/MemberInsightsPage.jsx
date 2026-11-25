import { useEffect, useState } from 'react'
import { AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react'
import { fetchMemberInsights } from '../api/members'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import { useToast } from '../context/ToastContext'
import './MemberInsightsPage.css'

const WEEKDAYS = ['月', '火', '水', '木', '金', '土', '日']
const HEAT_STEPS = 5 // 混み具合の色の段階（0件は別扱い）

function shiftMonth({ year, month }, delta) {
  const d = new Date(year, month - 1 + delta, 1)
  return { year: d.getFullYear(), month: d.getMonth() + 1 }
}

const pct = (ratio) => `${Math.round(ratio * 100)}%`

function Section({ title, note, children }) {
  return (
    <section className="insights__section">
      <div className="insights__section-head">
        <h2>{title}</h2>
        {note && <p>{note}</p>}
      </div>
      {children}
    </section>
  )
}

function Empty({ children }) {
  return <p className="insights__empty">{children}</p>
}

// 横棒グラフ（1系列）。値はバーの右に表示
function HBarList({ rows, max, valueLabel }) {
  return (
    <ul className="insights__hbars">
      {rows.map((row) => (
        <li key={row.key} title={`${row.label}：${valueLabel(row)}`}>
          <span className="insights__hbar-label">{row.label}</span>
          <span className="insights__hbar-track">
            <span className="insights__hbar-fill" style={{ width: `${max ? (row.value / max) * 100 : 0}%` }} />
          </span>
          <span className="insights__hbar-value">{valueLabel(row)}</span>
        </li>
      ))}
    </ul>
  )
}

// C: 利用時間ランキングとプラン上限に近い会員
function UsageSection({ usage, threshold }) {
  const { t } = useLanguage()
  return (
    <Section
      title={t('利用時間ランキング')}
      note={`${t('今月の利用時間が多い会員（上位10名）。プラン上限の')}${pct(threshold)}${t('以上は注意表示')}`}
    >
      {usage.near_limit.length > 0 && (
        <div className="insights__alert" role="status">
          <AlertTriangle size={16} aria-hidden="true" />
          <span>
            {t('プラン上限に近い会員')}：
            {usage.near_limit.map((r) => `${r.name}（${pct(r.ratio)}）`).join('、')}
          </span>
        </div>
      )}
      {usage.top.length === 0 ? (
        <Empty>{t('この月の利用記録はありません')}</Empty>
      ) : (
        <div className="insights__table-wrap">
          <table className="insights__table">
            <thead>
              <tr>
                <th>{t('順位')}</th>
                <th>{t('会員')}</th>
                <th>{t('プラン')}</th>
                <th className="is-num">{t('来館')}</th>
                <th className="is-num">{t('利用時間')}</th>
                <th>{t('上限に対する割合')}</th>
              </tr>
            </thead>
            <tbody>
              {usage.top.map((row, i) => (
                <tr key={row.member_id} className={row.near_limit ? 'is-near-limit' : ''}>
                  <td className="is-num">{i + 1}</td>
                  <td>
                    <div className="insights__member">{row.name}</div>
                    {row.company && <div className="insights__sub">{row.company}</div>}
                  </td>
                  <td>{row.plan || '—'}</td>
                  <td className="is-num">{row.visits}{t('回')}</td>
                  <td className="is-num">{row.used_hours}h</td>
                  <td>
                    {row.limit_hours ? (
                      <div className="insights__ratio">
                        <span className="insights__ratio-track">
                          <span
                            className={`insights__ratio-fill ${row.near_limit ? 'is-warning' : ''}`}
                            style={{ width: `${Math.min(row.ratio, 1) * 100}%` }}
                          />
                        </span>
                        <span className="insights__ratio-text">
                          {row.near_limit && <AlertTriangle size={13} aria-label={t('注意')} />}
                          {pct(row.ratio)} / {row.limit_hours}h
                        </span>
                      </div>
                    ) : (
                      <span className="insights__sub">{t('上限なし')}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  )
}

// E: 曜日×時間帯の入室数（ヒートマップ。1色の濃淡）
function HeatmapSection({ heatmap }) {
  const { t } = useLanguage()
  const { counts, max } = heatmap
  const usedHours = counts.flatMap((row) => row.map((v, h) => (v > 0 ? h : null))).filter((h) => h !== null)
  const from = Math.min(8, ...usedHours)
  const to = Math.max(21, ...usedHours)
  const hours = Array.from({ length: to - from + 1 }, (_, i) => from + i)
  const step = (v) => (v === 0 ? 0 : Math.max(1, Math.ceil((v / max) * HEAT_STEPS)))
  return (
    <Section title={t('曜日・時間帯ごとの混み具合')} note={t('この月の入室回数を、曜日と時間帯ごとに数えたもの')}>
      {max === 0 ? (
        <Empty>{t('この月の入室記録はありません')}</Empty>
      ) : (
        <>
          <div className="insights__heat-wrap">
            <table className="insights__heat">
              <thead>
                <tr>
                  <th aria-label={t('曜日')} />
                  {hours.map((h) => <th key={h} scope="col">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {counts.map((row, d) => (
                  <tr key={WEEKDAYS[d]}>
                    <th scope="row">{t(WEEKDAYS[d])}</th>
                    {hours.map((h) => (
                      <td key={h} title={`${t(WEEKDAYS[d])} ${h}:00台：${row[h]}${t('回')}`}>
                        <span className={`insights__heat-cell is-step-${step(row[h])}`}>
                          {row[h] > 0 ? row[h] : ''}
                        </span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="insights__heat-legend" aria-hidden="true">
            <span>{t('少')}</span>
            {Array.from({ length: HEAT_STEPS }, (_, i) => <span key={i} className={`insights__heat-cell is-step-${i + 1}`} />)}
            <span>{t('多')}</span>
          </div>
        </>
      )}
    </Section>
  )
}

export default function MemberInsightsPage() {
  const { t } = useLanguage()
  const { isMaster } = useAuth()
  const { showToast } = useToast()
  const now = new Date()
  const [target, setTarget] = useState({ year: now.getFullYear(), month: now.getMonth() + 1 })
  const [site, setSite] = useState('')
  const [data, setData] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    fetchMemberInsights({ ...target, site })
      .then((result) => { if (!cancelled) setData(result) })
      .catch(() => showToast(t('利用状況の取得に失敗しました'), 'error'))
      .finally(() => { if (!cancelled) setIsLoading(false) })
    return () => { cancelled = true }
  }, [target, site, showToast, t])

  const isCurrentMonth = target.year === now.getFullYear() && target.month === now.getMonth() + 1

  return (
    <div className="insights">
      <div className="insights__header">
        <div>
          <h1>{t('利用状況')}</h1>
          <p>{t('会員の利用時間、混み具合、会議室・注文・入会の状況を月ごとに確認できます')}</p>
        </div>
        <div className="insights__controls">
          {isMaster && data && (
            <select value={site} onChange={(e) => setSite(e.target.value)} aria-label={t('所管')}>
              <option value="">{t('すべての所管')}</option>
              {data.sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          )}
          <div className="insights__month">
            <button type="button" className="btn btn-secondary" onClick={() => setTarget((c) => shiftMonth(c, -1))} aria-label={t('前の月')}>
              <ChevronLeft size={18} />
            </button>
            <span className="insights__month-label">{target.year}{t('年')}{target.month}{t('月')}</span>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setTarget((c) => shiftMonth(c, 1))}
              disabled={isCurrentMonth}
              aria-label={t('次の月')}
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </div>

      {!data ? (
        <p className="settings-page__loading">{t('読み込み中…')}</p>
      ) : (
        <div className={`insights__body ${isLoading ? 'is-loading' : ''}`}>
          <div className="insights__tiles">
            <div className="insights__tile">
              <span>{t('有効な会員')}</span>
              <strong>{data.active_members}<small>{t('名')}</small></strong>
            </div>
            <div className="insights__tile">
              <span>{t('延べ利用時間')}</span>
              <strong>{data.usage.total_hours}<small>h</small></strong>
            </div>
            <div className="insights__tile">
              <span>{t('来館回数')}</span>
              <strong>{data.usage.total_visits}<small>{t('回')}</small></strong>
            </div>
            <div className="insights__tile">
              <span>{t('会議室の稼働率')}</span>
              <strong>{Math.round(data.room_utilization.overall_rate * 100)}<small>%</small></strong>
            </div>
            <div className="insights__tile">
              <span>{t('注文数')}</span>
              <strong>{data.menu_ranking.order_count}<small>{t('件')}</small></strong>
            </div>
          </div>

          <UsageSection usage={data.usage} threshold={data.near_limit_ratio} />
          <HeatmapSection heatmap={data.busy_heatmap} />

          <div className="insights__pair">
            <Section
              title={t('会議室の稼働率')}
              note={`${t('9:00〜18:00 のうち予約が入っていた割合（1部屋あたり月')}${data.room_utilization.open_hours_per_room}${t('時間）')}`}
            >
              {data.room_utilization.rooms.length === 0 ? (
                <Empty>{t('会議室が登録されていません')}</Empty>
              ) : (
                <HBarList
                  rows={data.room_utilization.rooms.map((r) => ({
                    key: r.room_id, label: r.name, value: r.rate, hours: r.booked_hours,
                  }))}
                  max={1}
                  valueLabel={(row) => `${pct(row.value)}（${row.hours}h）`}
                />
              )}
            </Section>

            <Section title={t('よく注文されるメニュー')} note={t('取消を除いた注文数（杯数）')}>
              {data.menu_ranking.items.length === 0 ? (
                <Empty>{t('この月の注文はありません')}</Empty>
              ) : (
                <HBarList
                  rows={data.menu_ranking.items.map((item) => ({
                    key: item.name, label: item.name, value: item.quantity,
                  }))}
                  max={Math.max(...data.menu_ranking.items.map((i) => i.quantity))}
                  valueLabel={(row) => `${row.value}`}
                />
              )}
            </Section>
          </div>

          <Section title={t('新規会員数の推移')} note={t('直近12か月に登録された会員の数')}>
            {(() => {
              const max = Math.max(1, ...data.signups.map((s) => s.count))
              return (
                <div className="insights__columns" role="img" aria-label={t('新規会員数の推移')}>
                  {data.signups.map((s) => (
                    <div key={`${s.year}-${s.month}`} className="insights__column" title={`${s.year}/${s.month}：${s.count}${t('名')}`}>
                      <span className="insights__column-value">{s.count > 0 ? s.count : ''}</span>
                      <span className="insights__column-bar" style={{ height: `${(s.count / max) * 100}%` }} />
                      <span className="insights__column-label">{s.month}{t('月')}</span>
                    </div>
                  ))}
                </div>
              )
            })()}
          </Section>
        </div>
      )}
    </div>
  )
}
