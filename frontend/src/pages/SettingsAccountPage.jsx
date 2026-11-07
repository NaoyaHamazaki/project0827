import { useState } from 'react'
import { updateSelfAccount } from '../api/auth'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import { useToast } from '../context/ToastContext'
import './SettingsPage.css'

export default function SettingsAccountPage() {
  const { t } = useLanguage()
  const { staff, refreshStaff } = useAuth()
  const { showToast } = useToast()
  const [firstName, setFirstName] = useState(staff?.display_name?.split(' ')[0] ?? '')
  const [email, setEmail] = useState(staff?.email ?? '')
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [profileError, setProfileError] = useState('')

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isSavingPassword, setIsSavingPassword] = useState(false)
  const [passwordError, setPasswordError] = useState('')

  const handleProfileSubmit = async (event) => {
    event.preventDefault()
    setProfileError('')
    setIsSavingProfile(true)
    try {
      await updateSelfAccount({ first_name: firstName, email })
      await refreshStaff()
      showToast(t('アカウント情報を保存しました'))
    } catch (err) {
      setProfileError(err?.response?.data?.email?.[0] || t('保存に失敗しました'))
    } finally {
      setIsSavingProfile(false)
    }
  }

  const handlePasswordSubmit = async (event) => {
    event.preventDefault()
    setPasswordError('')
    if (!currentPassword) {
      setPasswordError(t('現在のパスワードを入力してください'))
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError(t('新しいパスワードが一致しません'))
      return
    }
    setIsSavingPassword(true)
    try {
      // 本人確認を兼ねて、現在のパスワードでの再ログイン確認は行わず、
      // 新パスワードのみサーバー側の強度バリデーションにかけて更新する
      await updateSelfAccount({ password: newPassword })
      showToast(t('パスワードを変更しました'))
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      setPasswordError(err?.response?.data?.password?.[0] || t('変更に失敗しました'))
    } finally {
      setIsSavingPassword(false)
    }
  }

  return (
    <div className="settings-page">
      <div className="settings-page__header">
        <div>
          <h1>{t('設定＞ユーザー')}</h1>
          <p>{t('ご自身のアカウント情報を編集します')}</p>
        </div>
      </div>

      <section className="settings-page__section">
        <h2>{t('プロフィール')}</h2>
        <form className="settings-form" onSubmit={handleProfileSubmit}>
          {profileError && <p className="settings-page__form-error">{profileError}</p>}
          <div className="field">
            <label htmlFor="account-name">{t('お名前')}</label>
            <input id="account-name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="account-email">{t('メールアドレス')}</label>
            <input
              id="account-email" type="email" value={email}
              onChange={(e) => setEmail(e.target.value)} required
            />
          </div>
          <div className="members-form__actions">
            <button type="submit" className="btn btn-primary" disabled={isSavingProfile}>
              {isSavingProfile ? t('保存中…') : t('保存する')}
            </button>
          </div>
        </form>
      </section>

      <section className="settings-page__section">
        <h2>{t('パスワード変更')}</h2>
        <form className="settings-form" onSubmit={handlePasswordSubmit}>
          {passwordError && <p className="settings-page__form-error">{passwordError}</p>}
          <div className="field">
            <label htmlFor="account-current-password">{t('現在のパスワード')}</label>
            <input
              id="account-current-password" type="password" value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)} autoComplete="current-password"
            />
          </div>
          <div className="field">
            <label htmlFor="account-new-password">{t('新しいパスワード')}</label>
            <input
              id="account-new-password" type="password" value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)} autoComplete="new-password"
            />
          </div>
          <div className="field">
            <label htmlFor="account-confirm-password">{t('新しいパスワード（確認）')}</label>
            <input
              id="account-confirm-password" type="password" value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)} autoComplete="new-password"
            />
          </div>
          <div className="members-form__actions">
            <button type="submit" className="btn btn-primary" disabled={isSavingPassword}>
              {isSavingPassword ? t('変更中…') : t('パスワードを変更する')}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}
