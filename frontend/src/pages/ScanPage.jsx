import { useCallback, useEffect, useRef, useState } from 'react'
import jsQR from 'jsqr'
import QRCode from 'qrcode'
import {
  CheckCircle2,
  XCircle,
  ScanLine,
  LogIn as CheckInIcon,
  LogOut as CheckOutIcon,
  Usb,
  Hash,
  QrCode,
  Delete,
  Camera,
  UserCircle2,
} from 'lucide-react'
import { scanCard, fetchRecentLogs, fetchMyQr, fetchMyStatus } from '../api/access'
import { getReaderStatus, startReader } from '../api/readerAgent'
import { fetchOrgSettings } from '../api/orgSettings'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import { useToast } from '../context/ToastContext'
import { notifyScanResult } from '../utils/feedback'
import './ScanPage.css'

const RECENT_POLL_MS = 15000
const QR_SCAN_INTERVAL_MS = 200
const RESULT_AUTO_CLOSE_MS = 4000
const MY_STATUS_POLL_MS = 5000

const METHOD_TILES = [
  { key: 'card', label: 'バーコード / ICカード', icon: ScanLine },
  { key: 'pin', label: '番号入力', icon: Hash },
  { key: 'qr', label: 'QRコード', icon: QrCode },
]

function formatTime(isoString, language) {
  return new Date(isoString).toLocaleTimeString(language === 'en' ? 'en-US' : 'ja-JP', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
}

function MethodTiles({ methods, active, onSelect }) {
  const { t } = useLanguage()
  return (
    <div className="scan-tiles">
      {methods.map(({ key, label, icon: Icon }) => (
        <button
          key={key}
          type="button"
          className={`scan-tile ${active === key ? 'is-active' : ''}`}
          onClick={() => onSelect(key)}
        >
          <Icon size={28} strokeWidth={1.8} />
          <span>{t(label)}</span>
        </button>
      ))}
    </div>
  )
}

function PinKeypad({ onSubmit, disabled }) {
  const { t } = useLanguage()
  const [value, setValue] = useState('')

  const press = (digit) => setValue((current) => (current + digit).slice(0, 20))
  const backspace = () => setValue((current) => current.slice(0, -1))
  const confirm = () => {
    if (!value || disabled) return
    onSubmit(value)
    setValue('')
  }

  return (
    <div className="scan-pin">
      <div className="scan-pin__display">{value || t('番号を入力')}</div>
      <div className="scan-pin__grid">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
          <button key={digit} type="button" className="scan-pin__key" onClick={() => press(digit)}>
            {digit}
          </button>
        ))}
        <button type="button" className="scan-pin__key" onClick={backspace} aria-label={t('1文字削除')}>
          <Delete size={18} />
        </button>
        <button type="button" className="scan-pin__key" onClick={() => press('0')}>
          0
        </button>
        <button
          type="button"
          className="scan-pin__key scan-pin__key--confirm"
          onClick={confirm}
          disabled={!value || disabled}
        >
          {t('確定')}
        </button>
      </div>
    </div>
  )
}

function QrScanner({ onDetect }) {
  const { t } = useLanguage()
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const intervalRef = useRef(null)
  const [isActive, setIsActive] = useState(false)
  const [error, setError] = useState('')

  const stop = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    setIsActive(false)
  }, [])

  useEffect(() => stop, [stop])

  // videoタグがまだマウントされていない状態でsrcObjectを代入すると失敗するため、
  // isActiveがtrueになって<video>が実際にマウントされた後にストリームを繋ぐ
  useEffect(() => {
    if (!isActive || !streamRef.current || !videoRef.current) return undefined

    const video = videoRef.current
    video.srcObject = streamRef.current
    video.play().catch(() => {})

    intervalRef.current = setInterval(() => {
      const canvas = canvasRef.current
      if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) return
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext('2d')
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const code = jsQR(imageData.data, imageData.width, imageData.height)
      if (code?.data) {
        stop()
        onDetect(code.data)
      }
    }, QR_SCAN_INTERVAL_MS)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [isActive, onDetect, stop])

  const start = async () => {
    setError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      streamRef.current = stream
      setIsActive(true)
    } catch {
      setError(t('カメラを起動できませんでした。ブラウザのカメラ権限をご確認ください'))
    }
  }

  return (
    <div className="scan-qr">
      {isActive ? (
        <>
          <video ref={videoRef} className="scan-qr__video" muted playsInline />
          <canvas ref={canvasRef} className="scan-qr__canvas" />
          <button type="button" className="btn btn-secondary" onClick={stop}>
            {t('カメラを閉じる')}
          </button>
        </>
      ) : (
        <button type="button" className="btn btn-primary" onClick={start}>
          <Camera size={16} />
          {t('カメラでQRコードを読み取る')}
        </button>
      )}
      {error && <p className="scan-qr__error">{error}</p>}
    </div>
  )
}

function UsagePanel({ usage }) {
  const { language } = useLanguage()
  const { visit_count: visitCount, used_hours: usedHours, limit_hours: limitHours, remaining_hours: remainingHours } = usage
  const isOverLimit = limitHours != null && remainingHours < 0

  const hoursLine = language === 'en'
    ? (limitHours == null
        ? `This month's usage: ${usedHours}h (unlimited)`
        : `This month's usage: ${usedHours}h / ${limitHours}h (${remainingHours}h remaining)`)
    : (limitHours == null
        ? `今月の利用時間: ${usedHours}h（上限なし）`
        : `今月の利用時間: ${usedHours}h / ${limitHours}h（残り${remainingHours}h）`)
  const visitsLine = language === 'en' ? `${visitCount} visit(s)` : `来場${visitCount}回`

  return (
    <div className={`scan-usage ${isOverLimit ? 'scan-usage--over' : ''}`}>
      <p className="scan-usage__hours">{hoursLine}</p>
      <p className="scan-usage__visits">{visitsLine}</p>
    </div>
  )
}

function SecurityCardStep({ step, onConfirm, onCancel, isSubmitting }) {
  const { t } = useLanguage()
  const [value, setValue] = useState('')
  const inputRef = useRef(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [step])

  const handleSubmit = (event) => {
    event.preventDefault()
    const trimmed = value.trim()
    if (!trimmed || isSubmitting) return
    onConfirm(trimmed)
    setValue('')
  }

  return (
    <div className="scan-panel scan-card-step">
      <p className="scan-panel__name">{step.memberBrief?.name}</p>
      {step.mode === 'issue' ? (
        <>
          <p className="scan-panel__sub">{t('貸し出すセキュリティカードを選択、またはスキャンしてください')}</p>
          {step.availableCards?.length > 0 ? (
            <div className="scan-card-step__list">
              {step.availableCards.map((card) => (
                <button
                  key={card.id}
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => onConfirm(card.card_number)}
                  disabled={isSubmitting}
                >
                  {card.card_number}
                </button>
              ))}
            </div>
          ) : (
            <p className="scan-card-step__error">{t('貸出可能なセキュリティカードがありません')}</p>
          )}
        </>
      ) : (
        <>
          <p className="scan-panel__sub">
            {t('返却されたセキュリティカードをスキャン、または番号を入力してください')}
          </p>
          {step.expectedCard && (
            <p className="scan-card-step__expected">
              {t('貸出中のカード番号')}: <strong>{step.expectedCard.card_number}</strong>
            </p>
          )}
          {step.errorMessage && <p className="scan-card-step__error">{step.errorMessage}</p>}
        </>
      )}
      <form className="scan-input scan-card-step__form" onSubmit={handleSubmit}>
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder={t('カード番号を入力/スキャン')}
          autoComplete="off"
        />
        <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
          {t('確定')}
        </button>
      </form>
      <button type="button" className="btn btn-secondary scan-card-step__cancel" onClick={onCancel}>
        {t('キャンセル')}
      </button>
    </div>
  )
}

function ResultModal({ result, onClose, children }) {
  useEffect(() => {
    const timer = setTimeout(onClose, RESULT_AUTO_CLOSE_MS)
    return () => clearTimeout(timer)
  }, [onClose])

  const tone = !result ? 'idle' : result.success ? 'success' : 'error'

  return (
    <div className="scan-result-overlay" onMouseDown={onClose}>
      <div
        className={`scan-panel scan-result-modal scan-panel--${tone}`}
        onMouseDown={(event) => event.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}

function AdminScanView() {
  const { t, language } = useLanguage()
  const { showToast } = useToast()
  const [cardInput, setCardInput] = useState('')
  const [result, setResult] = useState(null)
  const [pendingCardStep, setPendingCardStep] = useState(null)
  const [recentLogs, setRecentLogs] = useState([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showReaderPrompt, setShowReaderPrompt] = useState(false)
  const [isStartingReader, setIsStartingReader] = useState(false)
  const [enabledMethods, setEnabledMethods] = useState(['card'])
  const [activeMethod, setActiveMethod] = useState(null)
  const inputRef = useRef(null)

  const refocusInput = useCallback(() => {
    inputRef.current?.focus()
  }, [])

  const loadRecentLogs = useCallback(async () => {
    try {
      const logs = await fetchRecentLogs(5)
      setRecentLogs(logs)
    } catch {
      // 直近ログの取得失敗はスキャン操作自体を妨げないため無視する
    }
  }, [])

  useEffect(() => {
    loadRecentLogs()
    const interval = setInterval(loadRecentLogs, RECENT_POLL_MS)
    return () => clearInterval(interval)
  }, [loadRecentLogs])

  useEffect(() => {
    getReaderStatus().then(({ reachable, running }) => {
      if (reachable && !running) setShowReaderPrompt(true)
    })
  }, [])

  useEffect(() => {
    fetchOrgSettings()
      .then((data) => setEnabledMethods(data.enabled_checkin_methods))
      .catch(() => {
        // 設定取得に失敗した場合は既定（バーコード/ICカードのみ）のまま動作させる
      })
  }, [])

  useEffect(() => {
    if (activeMethod && enabledMethods.includes(activeMethod)) return
    const first = METHOD_TILES.map((tile) => tile.key).find((key) => enabledMethods.includes(key))
    setActiveMethod(first ?? null)
  }, [enabledMethods, activeMethod])

  useEffect(() => {
    if (activeMethod === 'card') refocusInput()
  }, [activeMethod, refocusInput])

  const handleStartReader = async () => {
    setIsStartingReader(true)
    try {
      const started = await startReader()
      if (started) {
        showToast(t('カードリーダーを起動しました'))
        setShowReaderPrompt(false)
      } else {
        showToast(t('カードリーダーの起動に失敗しました'), 'error')
      }
    } finally {
      setIsStartingReader(false)
    }
  }

  const submitScan = useCallback(
    async (rawValue, method, securityCardNumber = '') => {
      const trimmed = rawValue.trim()
      if (!trimmed || isSubmitting) return

      setIsSubmitting(true)
      try {
        const response = await scanCard(trimmed, method, securityCardNumber)

        if (!response.success && response.reason === 'security_card_required') {
          setPendingCardStep({
            mode: 'issue',
            cardIdentifier: trimmed,
            method,
            memberBrief: response.member,
            availableCards: response.available_security_cards,
          })
          return
        }

        if (!response.success && (response.reason === 'return_card_required' || response.reason === 'card_mismatch')) {
          setPendingCardStep({
            mode: 'return',
            cardIdentifier: trimmed,
            method,
            memberBrief: response.member,
            expectedCard: response.expected_security_card,
            errorMessage: response.reason === 'card_mismatch'
              ? t('カード番号が一致しません。返却されたカードをご確認ください')
              : '',
          })
          return
        }

        setPendingCardStep(null)
        setResult(response)
        notifyScanResult(response.success)
        if (response.success) {
          setRecentLogs((current) => [response.log, ...current].slice(0, 5))
        }
      } catch {
        setPendingCardStep(null)
        setResult({ success: false, reason: 'network_error', member: null, log: null })
        notifyScanResult(false)
      } finally {
        setIsSubmitting(false)
        refocusInput()
      }
    },
    [isSubmitting, refocusInput, t]
  )

  const handleSubmit = (event) => {
    event.preventDefault()
    submitScan(cardInput, 'card')
    setCardInput('')
  }

  const handleSecurityCardConfirm = (securityCardNumber) => {
    if (!pendingCardStep) return
    submitScan(pendingCardStep.cardIdentifier, pendingCardStep.method, securityCardNumber)
  }

  const handleSecurityCardCancel = () => {
    setPendingCardStep(null)
    refocusInput()
  }

  const renderResultContent = () => {
    if (!result) return null

    if (result.reason === 'not_found') {
      return (
        <>
          <XCircle size={48} strokeWidth={1.8} />
          <p className="scan-panel__headline">{t('未登録のカードです')}</p>
          <p className="scan-panel__sub">{t('会員管理画面でカードIDを登録してください')}</p>
        </>
      )
    }

    if (result.reason === 'network_error') {
      return (
        <>
          <XCircle size={48} strokeWidth={1.8} />
          <p className="scan-panel__headline">{t('通信エラーが発生しました')}</p>
          <p className="scan-panel__sub">{t('もう一度スキャンしてください')}</p>
        </>
      )
    }

    if (result.reason === 'security_card_unavailable') {
      return (
        <>
          <XCircle size={48} strokeWidth={1.8} />
          <p className="scan-panel__name">{result.member.name}</p>
          <p className="scan-panel__sub">{t('選択されたセキュリティカードは貸出できません。もう一度お試しください')}</p>
        </>
      )
    }

    const { member, success, log, usage } = result
    const Icon = success ? CheckCircle2 : XCircle

    return (
      <>
        <Icon size={48} strokeWidth={1.8} />
        <p className="scan-panel__name">{member.name}</p>
        <p className="scan-panel__company">{member.company_name || t('所属企業未設定')}</p>
        {success ? (
          <>
            <div className="scan-panel__type">
              {log.type === 'check_in' ? <CheckInIcon size={20} /> : <CheckOutIcon size={20} />}
              {log.type === 'check_in' ? t('入室しました') : t('退室しました')}
            </div>
            {usage && <UsagePanel usage={usage} />}
          </>
        ) : (
          <p className="scan-panel__sub">{t('このカードは無効化されています')}</p>
        )}
      </>
    )
  }

  const availableTiles = METHOD_TILES.filter((tile) => enabledMethods.includes(tile.key))

  return (
    <div className="scan-page">
      {showReaderPrompt && (
        <div className="scan-reader-banner">
          <Usb size={18} />
          <span>{t('カードリーダー連携が停止しています（通常は自動で起動します）')}</span>
          <button
            type="button"
            className="btn btn-primary scan-reader-banner__btn"
            onClick={handleStartReader}
            disabled={isStartingReader}
          >
            {isStartingReader ? t('起動中…') : t('起動する')}
          </button>
          <button
            type="button"
            className="btn btn-secondary scan-reader-banner__btn"
            onClick={() => setShowReaderPrompt(false)}
          >
            {t('後で')}
          </button>
        </div>
      )}
      <div className="scan-page__main">
        {pendingCardStep ? (
          <SecurityCardStep
            step={pendingCardStep}
            onConfirm={handleSecurityCardConfirm}
            onCancel={handleSecurityCardCancel}
            isSubmitting={isSubmitting}
          />
        ) : (
          <>
            <MethodTiles methods={availableTiles} active={activeMethod} onSelect={setActiveMethod} />

            {activeMethod === 'card' && (
              <form className="scan-input" onSubmit={handleSubmit}>
                <label htmlFor="scan-input-field">{t('バーコード / ICカード読み取り')}</label>
                <input
                  id="scan-input-field"
                  ref={inputRef}
                  type="text"
                  value={cardInput}
                  onChange={(event) => setCardInput(event.target.value)}
                  onBlur={() => setTimeout(refocusInput, 50)}
                  placeholder={t('スキャン待機中…')}
                  autoComplete="off"
                  autoFocus
                />
              </form>
            )}

            {activeMethod === 'pin' && (
              <div className="scan-alt-methods__block">
                <PinKeypad onSubmit={(value) => submitScan(value, 'pin')} disabled={isSubmitting} />
              </div>
            )}

            {activeMethod === 'qr' && (
              <div className="scan-alt-methods__block">
                <QrScanner onDetect={(value) => submitScan(value, 'qr')} />
              </div>
            )}

            {!activeMethod && (
              <div className="scan-panel scan-panel--idle">
                <div className="scan-panel__idle">
                  <ScanLine size={56} strokeWidth={1.5} />
                  <p>{t('利用可能な入力方式が設定されていません')}</p>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <aside className="scan-recent">
        <h2>{t('直近の打刻ログ')}</h2>
        {recentLogs.length === 0 ? (
          <p className="scan-recent__empty">{t('まだ打刻がありません')}</p>
        ) : (
          <ul className="scan-recent__list">
            {recentLogs.map((log) => (
              <li key={log.id} className="scan-recent__item">
                <div className={`scan-recent__dot scan-recent__dot--${log.type}`} />
                <div className="scan-recent__info">
                  <span className="scan-recent__name">{log.member.name}</span>
                  <span className="scan-recent__meta">
                    {log.type === 'check_in' ? t('入室') : t('退室')} ・ {formatTime(log.created_at, language)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </aside>

      {result && (
        <ResultModal result={result} onClose={() => setResult(null)}>
          {renderResultContent()}
        </ResultModal>
      )}
    </div>
  )
}

function StatusPanel({ status }) {
  const { t, language } = useLanguage()
  const { log, usage } = status
  if (!log) return null

  const isCheckedIn = log.type === 'check_in'
  const time = formatTime(log.created_at, language)
  const statusLine = language === 'en'
    ? `${isCheckedIn ? 'Checked in' : 'Checked out'} at ${time}`
    : `${isCheckedIn ? '入室中' : '退室済'}（${time}〜）`

  const hasLimit = usage && usage.limit_hours != null
  const remainingLine = hasLimit
    ? (language === 'en' ? `${usage.remaining_hours}h remaining` : `残り${usage.remaining_hours}h`)
    : null

  return (
    <div className={`user-qr-status ${isCheckedIn ? 'user-qr-status--in' : 'user-qr-status--out'}`}>
      <div className={`user-qr-status__dot ${isCheckedIn ? 'is-in' : 'is-out'}`} />
      <span className="user-qr-status__line">{statusLine}</span>
      {remainingLine && <span className="user-qr-status__remaining">{remainingLine}</span>}
    </div>
  )
}

function UserQrView() {
  const { t, language } = useLanguage()
  const [qrData, setQrData] = useState(null)
  const [remainingSeconds, setRemainingSeconds] = useState(0)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [status, setStatus] = useState({ log: null, usage: null })
  const canvasRef = useRef(null)

  const loadQr = useCallback(async () => {
    try {
      const data = await fetchMyQr()
      setQrData(data)
      setError('')
    } catch {
      setError(t('アカウントに会員情報が紐付けられていません。管理者にお問い合わせください'))
      setQrData(null)
    } finally {
      setIsLoading(false)
    }
  }, [t])

  useEffect(() => {
    loadQr()
  }, [loadQr])

  useEffect(() => {
    if (!qrData || !canvasRef.current) return
    QRCode.toCanvas(canvasRef.current, qrData.token, { width: 220, margin: 1 }).catch(() => {})
  }, [qrData])

  useEffect(() => {
    if (!qrData) return undefined
    const tick = () => {
      const secondsLeft = Math.max(0, Math.round((new Date(qrData.expires_at) - new Date()) / 1000))
      setRemainingSeconds(secondsLeft)
      if (secondsLeft <= 0) loadQr()
    }
    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [qrData, loadQr])

  useEffect(() => {
    const poll = async () => {
      try {
        const data = await fetchMyStatus()
        setStatus({ log: data.log, usage: data.usage })
      } catch {
        // ポーリング失敗は静かに無視する（次回のポーリングで復帰する）
      }
    }
    poll()
    const interval = setInterval(poll, MY_STATUS_POLL_MS)
    return () => clearInterval(interval)
  }, [])

  if (isLoading) {
    return <div className="user-qr-page__loading">{t('読み込み中…')}</div>
  }

  if (error) {
    return (
      <div className="user-qr-page">
        <div className="user-qr-card user-qr-card--error">
          <UserCircle2 size={48} strokeWidth={1.5} />
          <p>{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="user-qr-page">
      <div className="user-qr-card">
        <p className="user-qr-card__name">
          {language === 'en' ? qrData.member_name : `${qrData.member_name} さん`}
        </p>
        <canvas ref={canvasRef} />
        <p className="user-qr-card__timer">
          {language === 'en'
            ? `${remainingSeconds}s remaining (refreshes automatically)`
            : `残り${remainingSeconds}秒（自動更新されます）`}
        </p>
        <StatusPanel status={status} />
        <div className="user-qr-card__cardid">
          <span className="user-qr-card__cardid-label">{t('カードID')}</span>
          <span className="user-qr-card__cardid-value">{qrData.card_identifier}</span>
        </div>
      </div>
    </div>
  )
}

export default function ScanPage() {
  const { isAdmin } = useAuth()
  return isAdmin ? <AdminScanView /> : <UserQrView />
}
