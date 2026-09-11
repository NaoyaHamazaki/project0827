import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, Send } from 'lucide-react'
import DataTable from '../components/DataTable'
import Modal from '../components/Modal'
import { useLanguage } from '../context/LanguageContext'
import { useToast } from '../context/ToastContext'
import {
  fetchOrgSettings,
  updateOrgSettings,
  listWebhooks,
  createWebhook,
  updateWebhook,
  deleteWebhook,
  testWebhook,
} from '../api/orgSettings'
import { fetchPlans, createPlan, updatePlan, deletePlan } from '../api/members'
import './SettingsPage.css'

const CHECKIN_METHODS = [
  { key: 'card', label: 'バーコード / ICカード', available: true },
  { key: 'pin', label: '番号入力', available: true },
  { key: 'qr', label: 'QRコード（カメラ読取）', available: true },
  { key: 'fingerprint', label: '指紋認証', available: false },
  { key: 'phone', label: 'スマホ認証', available: false },
]

const CSV_COLUMNS = [
  { key: 'member_name', label: '会員名' },
  { key: 'company_name', label: '所属企業' },
  { key: 'type', label: '種別' },
  { key: 'method', label: '入力方式' },
  { key: 'staff', label: '対応スタッフ' },
  { key: 'security_card_number', label: 'セキュリティカード番号' },
  { key: 'timestamp', label: '打刻日時' },
]

const EMPTY_WEBHOOK_FORM = { name: '', url: '', secret: '', event_types: ['checkin', 'checkout'] }

function CheckinMethodsSection({ enabledMethods, onToggle }) {
  const { t } = useLanguage()
  return (
    <section className="settings-page__section">
      <h2>{t('入力方式')}</h2>
      <p className="settings-page__section-desc">
        {t('受付スキャン画面で使用する入力方式を選択してください。指紋認証・スマホ認証は今後の拡張ポイントです。')}
      </p>
      <div className="settings-page__checkbox-list">
        {CHECKIN_METHODS.map((method) => (
          <label
            key={method.key}
            className={`settings-page__checkbox ${!method.available ? 'is-disabled' : ''}`}
          >
            <input
              type="checkbox"
              checked={enabledMethods.includes(method.key)}
              disabled={!method.available}
              onChange={() => onToggle(method.key)}
            />
            <span>{t(method.label)}</span>
            {!method.available && <span className="settings-page__badge">{t('準備中')}</span>}
          </label>
        ))}
      </div>
    </section>
  )
}

function CsvColumnsSection({ selectedColumns, onToggle }) {
  const { t } = useLanguage()
  return (
    <section className="settings-page__section">
      <h2>{t('CSVエクスポート列')}</h2>
      <p className="settings-page__section-desc">
        {t('在室・ログ管理画面でCSVをダウンロードする際に出力する列を選択してください。')}
      </p>
      <div className="settings-page__checkbox-list">
        {CSV_COLUMNS.map((column) => (
          <label key={column.key} className="settings-page__checkbox">
            <input
              type="checkbox"
              checked={selectedColumns.includes(column.key)}
              onChange={() => onToggle(column.key)}
            />
            <span>{t(column.label)}</span>
          </label>
        ))}
      </div>
    </section>
  )
}

function WebhookSection() {
  const { t, language } = useLanguage()
  const { showToast } = useToast()
  const [webhooks, setWebhooks] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingWebhook, setEditingWebhook] = useState(null)
  const [form, setForm] = useState(EMPTY_WEBHOOK_FORM)
  const [isSaving, setIsSaving] = useState(false)
  const [testingId, setTestingId] = useState(null)

  const load = async () => {
    setIsLoading(true)
    try {
      const data = await listWebhooks()
      setWebhooks(data)
    } catch {
      showToast(t('Webhook一覧の取得に失敗しました'), 'error')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const openCreateModal = () => {
    setEditingWebhook(null)
    setForm(EMPTY_WEBHOOK_FORM)
    setIsModalOpen(true)
  }

  const openEditModal = (webhook) => {
    setEditingWebhook(webhook)
    setForm({
      name: webhook.name,
      url: webhook.url,
      secret: webhook.secret,
      event_types: webhook.event_types,
    })
    setIsModalOpen(true)
  }

  const toggleEventType = (eventType) => {
    setForm((current) => ({
      ...current,
      event_types: current.event_types.includes(eventType)
        ? current.event_types.filter((value) => value !== eventType)
        : [...current.event_types, eventType],
    }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setIsSaving(true)
    try {
      if (editingWebhook) {
        await updateWebhook(editingWebhook.id, { ...form, is_active: editingWebhook.is_active })
        showToast(t('Webhookを更新しました'))
      } else {
        await createWebhook(form)
        showToast(t('Webhookを登録しました'))
      }
      setIsModalOpen(false)
      load()
    } catch {
      showToast(t('保存に失敗しました'), 'error')
    } finally {
      setIsSaving(false)
    }
  }

  const handleToggleActive = async (webhook) => {
    try {
      await updateWebhook(webhook.id, { ...webhook, is_active: !webhook.is_active })
      load()
    } catch {
      showToast(t('更新に失敗しました'), 'error')
    }
  }

  const handleDelete = async (webhook) => {
    const confirmMessage = language === 'en' ? `Delete "${webhook.name}"?` : `「${webhook.name}」を削除しますか？`
    if (!window.confirm(confirmMessage)) return
    try {
      await deleteWebhook(webhook.id)
      showToast(t('Webhookを削除しました'))
      load()
    } catch {
      showToast(t('削除に失敗しました'), 'error')
    }
  }

  const handleTest = async (webhook) => {
    setTestingId(webhook.id)
    try {
      await testWebhook(webhook.id)
      showToast(language === 'en' ? `Test sent to "${webhook.name}"` : `「${webhook.name}」へテスト送信しました`)
    } catch {
      showToast(t('テスト送信に失敗しました（URLに到達できませんでした）'), 'error')
    } finally {
      setTestingId(null)
    }
  }

  const columns = [
    { key: 'name', header: t('名称') },
    { key: 'url', header: t('通知先URL') },
    {
      key: 'event_types',
      header: t('イベント'),
      render: (row) => row.event_types.map((type) => (type === 'checkin' ? t('入室') : t('退室'))).join(' / '),
    },
    {
      key: 'is_active',
      header: t('有効'),
      render: (row) => (
        <label className="settings-page__toggle">
          <input type="checkbox" checked={row.is_active} onChange={() => handleToggleActive(row)} />
        </label>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <div className="settings-page__row-actions">
          <button
            type="button"
            className="icon-btn"
            onClick={() => handleTest(row)}
            disabled={testingId === row.id}
            aria-label={t('テスト送信')}
          >
            <Send size={16} />
          </button>
          <button type="button" className="icon-btn" onClick={() => openEditModal(row)} aria-label={t('編集')}>
            <Pencil size={16} />
          </button>
          <button
            type="button"
            className="icon-btn icon-btn--danger"
            onClick={() => handleDelete(row)}
            aria-label={t('削除')}
          >
            <Trash2 size={16} />
          </button>
        </div>
      ),
    },
  ]

  return (
    <section className="settings-page__section">
      <div className="settings-page__section-header">
        <div>
          <h2>{t('Webhook連携')}</h2>
          <p className="settings-page__section-desc">
            {t('入室・退室イベント発生時に、登録したURLへJSONを送信します（他社アプリ・外部APIとの連携用）。')}
          </p>
        </div>
        <button type="button" className="btn btn-primary" onClick={openCreateModal}>
          <Plus size={16} />
          {t('追加')}
        </button>
      </div>

      {isLoading ? (
        <p className="settings-page__loading">{t('読み込み中…')}</p>
      ) : (
        <DataTable columns={columns} rows={webhooks} rowKey={(row) => row.id} emptyMessage={t('Webhookが登録されていません')} />
      )}

      {isModalOpen && (
        <Modal title={editingWebhook ? t('Webhookを編集') : t('Webhookを追加')} onClose={() => setIsModalOpen(false)}>
          <form className="settings-form" onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="webhook-name">{t('名称')}</label>
              <input
                id="webhook-name"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                required
                autoFocus
              />
            </div>
            <div className="field">
              <label htmlFor="webhook-url">{t('通知先URL')}</label>
              <input
                id="webhook-url"
                type="url"
                value={form.url}
                onChange={(event) => setForm({ ...form, url: event.target.value })}
                placeholder="https://example.com/webhook"
                required
              />
            </div>
            <div className="field">
              <label htmlFor="webhook-secret">{t('シークレット（任意）')}</label>
              <input
                id="webhook-secret"
                value={form.secret}
                onChange={(event) => setForm({ ...form, secret: event.target.value })}
              />
            </div>
            <div className="field">
              <label>{t('発火イベント')}</label>
              <div className="settings-page__checkbox-list">
                <label className="settings-page__checkbox">
                  <input
                    type="checkbox"
                    checked={form.event_types.includes('checkin')}
                    onChange={() => toggleEventType('checkin')}
                  />
                  <span>{t('入室')}</span>
                </label>
                <label className="settings-page__checkbox">
                  <input
                    type="checkbox"
                    checked={form.event_types.includes('checkout')}
                    onChange={() => toggleEventType('checkout')}
                  />
                  <span>{t('退室')}</span>
                </label>
              </div>
            </div>

            <div className="members-form__actions">
              <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>
                {t('キャンセル')}
              </button>
              <button type="submit" className="btn btn-primary" disabled={isSaving}>
                {isSaving ? t('保存中…') : t('保存する')}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </section>
  )
}

const EMPTY_PLAN_FORM = { name: '', monthly_hour_limit: '' }

function PlanSection() {
  const { t, language } = useLanguage()
  const { showToast } = useToast()
  const [plans, setPlans] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingPlan, setEditingPlan] = useState(null)
  const [form, setForm] = useState(EMPTY_PLAN_FORM)
  const [isSaving, setIsSaving] = useState(false)

  const load = async () => {
    setIsLoading(true)
    try {
      const data = await fetchPlans()
      setPlans(data)
    } catch {
      showToast(t('プラン一覧の取得に失敗しました'), 'error')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const openCreateModal = () => {
    setEditingPlan(null)
    setForm(EMPTY_PLAN_FORM)
    setIsModalOpen(true)
  }

  const openEditModal = (plan) => {
    setEditingPlan(plan)
    setForm({
      name: plan.name,
      monthly_hour_limit: plan.monthly_hour_limit ?? '',
    })
    setIsModalOpen(true)
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setIsSaving(true)
    const payload = {
      name: form.name,
      monthly_hour_limit: form.monthly_hour_limit === '' ? null : Number(form.monthly_hour_limit),
    }
    try {
      if (editingPlan) {
        await updatePlan(editingPlan.id, payload)
        showToast(t('プランを更新しました'))
      } else {
        await createPlan(payload)
        showToast(t('プランを登録しました'))
      }
      setIsModalOpen(false)
      load()
    } catch {
      showToast(t('保存に失敗しました'), 'error')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (plan) => {
    const confirmMessage = language === 'en'
      ? `Delete "${plan.name}"? Members on this plan will become unassigned.`
      : `「${plan.name}」を削除しますか？（このプランを利用中の会員は「未設定」になります）`
    if (!window.confirm(confirmMessage)) return
    try {
      await deletePlan(plan.id)
      showToast(t('プランを削除しました'))
      load()
    } catch {
      showToast(t('削除に失敗しました'), 'error')
    }
  }

  const columns = [
    { key: 'name', header: t('プラン名') },
    {
      key: 'monthly_hour_limit',
      header: t('月間上限時間'),
      render: (row) => (row.monthly_hour_limit == null
        ? t('無制限')
        : language === 'en' ? `${row.monthly_hour_limit}h` : `${row.monthly_hour_limit}時間`),
    },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <div className="settings-page__row-actions">
          <button type="button" className="icon-btn" onClick={() => openEditModal(row)} aria-label={t('編集')}>
            <Pencil size={16} />
          </button>
          <button
            type="button"
            className="icon-btn icon-btn--danger"
            onClick={() => handleDelete(row)}
            aria-label={t('削除')}
          >
            <Trash2 size={16} />
          </button>
        </div>
      ),
    },
  ]

  return (
    <section className="settings-page__section">
      <div className="settings-page__section-header">
        <div>
          <h2>{t('プラン管理')}</h2>
          <p className="settings-page__section-desc">
            {t('会員に割り当てる月間利用時間の上限プランを管理します（未設定の会員・上限未指定のプランは無制限扱い）。')}
          </p>
        </div>
        <button type="button" className="btn btn-primary" onClick={openCreateModal}>
          <Plus size={16} />
          {t('追加')}
        </button>
      </div>

      {isLoading ? (
        <p className="settings-page__loading">{t('読み込み中…')}</p>
      ) : (
        <DataTable columns={columns} rows={plans} rowKey={(row) => row.id} emptyMessage={t('プランが登録されていません')} />
      )}

      {isModalOpen && (
        <Modal title={editingPlan ? t('プランを編集') : t('プランを追加')} onClose={() => setIsModalOpen(false)}>
          <form className="settings-form" onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="plan-name">{t('プラン名')}</label>
              <input
                id="plan-name"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                required
                autoFocus
              />
            </div>
            <div className="field">
              <label htmlFor="plan-limit">{t('月間上限時間（空欄で無制限）')}</label>
              <input
                id="plan-limit"
                type="number"
                min="0"
                value={form.monthly_hour_limit}
                onChange={(event) => setForm({ ...form, monthly_hour_limit: event.target.value })}
                placeholder={t('例: 10')}
              />
            </div>

            <div className="members-form__actions">
              <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>
                {t('キャンセル')}
              </button>
              <button type="submit" className="btn btn-primary" disabled={isSaving}>
                {isSaving ? t('保存中…') : t('保存する')}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </section>
  )
}

export default function SettingsPage() {
  const { t } = useLanguage()
  const { showToast } = useToast()
  const [enabledMethods, setEnabledMethods] = useState([])
  const [csvColumns, setCsvColumns] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    fetchOrgSettings()
      .then((data) => {
        setEnabledMethods(data.enabled_checkin_methods)
        setCsvColumns(data.csv_export_columns)
      })
      .catch(() => showToast(t('設定の取得に失敗しました'), 'error'))
      .finally(() => setIsLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const toggleMethod = (key) => {
    setEnabledMethods((current) =>
      current.includes(key) ? current.filter((value) => value !== key) : [...current, key]
    )
  }

  const toggleColumn = (key) => {
    setCsvColumns((current) =>
      current.includes(key) ? current.filter((value) => value !== key) : [...current, key]
    )
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await updateOrgSettings({
        enabled_checkin_methods: enabledMethods,
        csv_export_columns: csvColumns,
      })
      showToast(t('設定を保存しました'))
    } catch {
      showToast(t('保存に失敗しました'), 'error')
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return <p className="settings-page__loading">{t('読み込み中…')}</p>
  }

  return (
    <div className="settings-page">
      <div className="settings-page__header">
        <div>
          <h1>{t('設定')}</h1>
          <p>{t('企業の運用に合わせて、入力方式・CSV出力列・外部連携を設定します')}</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={handleSave} disabled={isSaving}>
          {isSaving ? t('保存中…') : t('入出力設定を保存')}
        </button>
      </div>

      <CheckinMethodsSection enabledMethods={enabledMethods} onToggle={toggleMethod} />
      <CsvColumnsSection selectedColumns={csvColumns} onToggle={toggleColumn} />
      <PlanSection />
      <WebhookSection />
    </div>
  )
}
