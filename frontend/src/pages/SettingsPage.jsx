import { useEffect, useState } from 'react'
import { Table2 } from 'lucide-react'
import { useLanguage } from '../context/LanguageContext'
import { useToast } from '../context/ToastContext'
import { fetchDebugTables, fetchDebugTableRows } from '../api/orgSettings'
import './SettingsPage.css'

function DebugTableSection() {
  const { t } = useLanguage()
  const { showToast } = useToast()
  const [tables, setTables] = useState([])
  const [selected, setSelected] = useState('')
  const [result, setResult] = useState(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    fetchDebugTables()
      .then((data) => {
        setTables(data)
        if (data.length > 0) setSelected(data[0].value)
      })
      .catch(() => {})
  }, [])

  const handleShow = async () => {
    if (!selected) return
    setIsLoading(true)
    try {
      const data = await fetchDebugTableRows(selected)
      setResult(data)
    } catch {
      showToast(t('テーブル内容の取得に失敗しました'), 'error')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <section className="settings-page__section">
      <h2>{t('テーブル確認（開発用）')}</h2>
      <p className="settings-page__section-desc">
        {t('テスト・動作確認用に、DBの各テーブルの内容をそのまま確認できます（最大200件、パスワード等は非表示）。')}
      </p>
      <div className="settings-page__debug-controls">
        <select value={selected} onChange={(event) => setSelected(event.target.value)}>
          {tables.map((table) => (
            <option key={table.value} value={table.value}>{table.label}</option>
          ))}
        </select>
        <button type="button" className="btn btn-secondary" onClick={handleShow} disabled={isLoading || !selected}>
          <Table2 size={16} />
          {isLoading ? t('取得中…') : t('表示')}
        </button>
      </div>

      {result && (
        <div className="settings-page__debug-result">
          <p className="settings-page__debug-count">
            {t('件数')}: {result.total}{result.total > result.rows.length ? ` (${t('先頭')}${result.rows.length}${t('件を表示')})` : ''}
          </p>
          <div className="settings-page__debug-table-wrap">
            <table className="settings-page__debug-table">
              <thead>
                <tr>
                  {result.columns.map((col) => <th key={col}>{col}</th>)}
                </tr>
              </thead>
              <tbody>
                {result.rows.map((row, i) => (
                  <tr key={i}>
                    {row.map((cell, j) => <td key={j}>{cell}</td>)}
                  </tr>
                ))}
                {result.rows.length === 0 && (
                  <tr><td colSpan={result.columns.length}>{t('データがありません')}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  )
}

export default function SettingsPage() {
  const { t } = useLanguage()

  return (
    <div className="settings-page">
      <div className="settings-page__header">
        <div>
          <h1>{t('設定')}</h1>
          <p>{t('アカウント共通の設定です。受付運用に関する設定は「受付設定」に移動しました')}</p>
        </div>
      </div>

      <DebugTableSection />
    </div>
  )
}
