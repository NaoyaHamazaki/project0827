import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { Copy } from 'lucide-react'
import { createMemberInvite } from '../api/members'
import Modal from './Modal'
import { useLanguage } from '../context/LanguageContext'
import { useToast } from '../context/ToastContext'
import './InviteLinkModal.css'

// 招待URLを発行して、QRコードまたはコピー用URLとして表示する。
// 誰を招待するか（管理者／代表／ユーザー）は、発行する人の権限でサーバー側が決める
export default function InviteLinkModal({ mode, onClose, payload = {}, targetLabel }) {
  const { t } = useLanguage()
  const { showToast } = useToast()
  const canvasRef = useRef(null)
  const [url, setUrl] = useState('')
  const [expiresAt, setExpiresAt] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    createMemberInvite(payload)
      .then(({ token, expires_at }) => {
        setUrl(`${window.location.origin}/register/${token}`)
        setExpiresAt(expires_at)
      })
      .catch(() => showToast(t('招待リンクの発行に失敗しました'), 'error'))
      .finally(() => setIsLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (mode === 'qr' && url && canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, url, { width: 220, margin: 1 }).catch(() => {})
    }
  }, [mode, url])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      showToast(t('URLをコピーしました'))
    } catch {
      showToast(t('コピーに失敗しました'), 'error')
    }
  }

  const title = `${targetLabel ? `${t(targetLabel)}の招待` : t('招待')}（${mode === 'qr' ? t('QR表示') : t('URLをコピー')}）`

  return (
    <Modal title={title} onClose={onClose}>
      {isLoading ? (
        <p className="settings-page__loading">{t('発行中…')}</p>
      ) : (
        <div className="invite-link">
          <p className="invite-link__desc">
            {t('このリンクはご本人が情報を入力して登録するためのものです。24時間以内・1回のみ有効です。')}
          </p>
          {mode === 'qr' ? (
            <canvas ref={canvasRef} className="invite-link__qr" />
          ) : (
            <div className="invite-link__url-row">
              <input readOnly value={url} />
              <button type="button" className="btn btn-primary" onClick={handleCopy}>
                <Copy size={14} />
                {t('コピー')}
              </button>
            </div>
          )}
          {expiresAt && (
            <p className="invite-link__expires">
              {t('有効期限')}: {new Date(expiresAt).toLocaleString('ja-JP')}
            </p>
          )}
        </div>
      )}
    </Modal>
  )
}
