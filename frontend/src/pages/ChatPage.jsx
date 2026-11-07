import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ArrowLeft, Bold, Search, Send, ThumbsUp } from 'lucide-react'
import {
  fetchAdminChatTargets, fetchConversations, fetchMessages, openConversation, searchChatUsers,
  sendMessage, toggleThumbsUp,
} from '../api/chat'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import './ChatPage.css'

const POLL_MS = 3000

// **太字** だけを解釈する。HTMLは一切挿入せずReact要素として描画するのでXSSにならない
function renderBody(body) {
  return body.split(/(\*\*[^*\n]+\*\*)/g).map((part, i) => (
    /^\*\*[^*\n]+\*\*$/.test(part)
      ? <strong key={i}>{part.slice(2, -2)}</strong>
      : <span key={i}>{part}</span>
  ))
}

// 一覧プレビュー用に太字記号を除去する
function plainPreview(body) {
  return body.replace(/\*\*([^*\n]+)\*\*/g, '$1')
}

function formatStamp(iso, language) {
  const d = new Date(iso)
  const locale = language === 'en' ? 'en-US' : 'ja-JP'
  const sameDay = d.toDateString() === new Date().toDateString()
  return sameDay
    ? d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleString(locale, { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function Sidebar({ conversations, activeId, onSelect, onOpenUser }) {
  const { t, language } = useLanguage()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [isSearching, setIsSearching] = useState(false)

  useEffect(() => {
    const keyword = query.trim()
    if (!keyword) {
      setResults([])
      setIsSearching(false)
      return undefined
    }
    setIsSearching(true)
    const timer = setTimeout(() => {
      searchChatUsers(keyword)
        .then(setResults)
        .catch(() => setResults([]))
        .finally(() => setIsSearching(false))
    }, 250)
    return () => clearTimeout(timer)
  }, [query])

  const showResults = query.trim() !== ''

  return (
    <div className="chat__sidebar">
      <div className="chat__search">
        <Search size={16} />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('ユーザーを検索してチャットを開始')}
          aria-label={t('ユーザー検索')}
        />
      </div>

      {showResults ? (
        <ul className="chat__list">
          {results.map((user) => (
            <li key={user.id}>
              <button
                type="button"
                className="chat__item"
                onClick={() => { setQuery(''); onOpenUser(user.id) }}
              >
                <span className="chat__avatar">{user.display_name.slice(0, 1)}</span>
                <span className="chat__item-main">
                  <span className="chat__item-name">{user.display_name}</span>
                  <span className="chat__item-sub">{user.company || user.email}</span>
                </span>
              </button>
            </li>
          ))}
          {!isSearching && results.length === 0 && (
            <li className="chat__empty">{t('該当するユーザーがいません')}</li>
          )}
        </ul>
      ) : (
        <ul className="chat__list">
          {conversations.map((conv) => (
            <li key={conv.id}>
              <button
                type="button"
                className={`chat__item ${conv.id === activeId ? 'is-active' : ''}`}
                onClick={() => (conv.isSynthetic ? onOpenUser(conv.partner.id) : onSelect(conv.id))}
              >
                <span className="chat__avatar">{conv.partner?.display_name.slice(0, 1)}</span>
                <span className="chat__item-main">
                  <span className="chat__item-name">{conv.partner?.display_name}</span>
                  <span className="chat__item-sub">
                    {conv.last_message ? plainPreview(conv.last_message.body) : t('メッセージはまだありません')}
                  </span>
                </span>
                <span className="chat__item-meta">
                  {conv.last_message && (
                    <span className="chat__item-time">{formatStamp(conv.last_message.created_at, language)}</span>
                  )}
                  {conv.unread_count > 0 && <span className="chat__unread">{conv.unread_count}</span>}
                </span>
              </button>
            </li>
          ))}
          {conversations.length === 0 && (
            <li className="chat__empty">{t('上の検索バーから相手を探してチャットを始めましょう')}</li>
          )}
        </ul>
      )}
    </div>
  )
}

function Thread({ conversation, onBack, onSent }) {
  const { staff } = useAuth()
  const { t, language } = useLanguage()
  const [messages, setMessages] = useState([])
  const [draft, setDraft] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState('')
  const textareaRef = useRef(null)
  const bottomRef = useRef(null)
  const lastCountRef = useRef(0)
  const conversationId = conversation.id

  useEffect(() => {
    let cancelled = false
    lastCountRef.current = 0
    setMessages([])
    const load = () => fetchMessages(conversationId)
      .then((data) => { if (!cancelled) setMessages(data) })
      .catch(() => {})
    load()
    const timer = setInterval(load, POLL_MS)
    return () => { cancelled = true; clearInterval(timer) }
  }, [conversationId])

  useEffect(() => {
    if (messages.length !== lastCountRef.current) {
      lastCountRef.current = messages.length
      bottomRef.current?.scrollIntoView({ block: 'end' })
    }
  }, [messages])

  const applyBold = () => {
    const el = textareaRef.current
    if (!el) return
    const { selectionStart: start, selectionEnd: end } = el
    const selected = draft.slice(start, end)
    const next = `${draft.slice(0, start)}**${selected}**${draft.slice(end)}`
    setDraft(next)
    requestAnimationFrame(() => {
      el.focus()
      const caret = selected ? end + 4 : start + 2
      el.setSelectionRange(caret, caret)
    })
  }

  const submit = async () => {
    const body = draft.trim()
    if (!body || isSending) return
    setIsSending(true)
    setError('')
    try {
      const sent = await sendMessage(conversationId, body)
      setMessages((current) => [...current, sent])
      setDraft('')
      onSent()
    } catch {
      setError(t('送信に失敗しました'))
    } finally {
      setIsSending(false)
    }
  }

  const handleKeyDown = (event) => {
    // 日本語入力の変換確定のEnterでは送信しない
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      submit()
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'b') {
      event.preventDefault()
      applyBold()
    }
  }

  const react = async (messageId) => {
    try {
      const updated = await toggleThumbsUp(messageId)
      setMessages((current) => current.map((m) => (m.id === updated.id ? updated : m)))
    } catch {
      // 次回ポーリングで整合する
    }
  }

  return (
    <div className="chat__thread">
      <div className="chat__thread-header">
        <button type="button" className="chat__back" onClick={onBack} aria-label={t('戻る')}>
          <ArrowLeft size={20} />
        </button>
        <span className="chat__avatar">{conversation.partner?.display_name.slice(0, 1)}</span>
        <div>
          <div className="chat__item-name">{conversation.partner?.display_name}</div>
          <div className="chat__item-sub">{conversation.partner?.company || conversation.partner?.email}</div>
        </div>
      </div>

      <div className="chat__messages">
        {messages.length === 0 && <p className="chat__empty">{t('最初のメッセージを送ってみましょう')}</p>}
        {messages.map((m) => {
          const mine = m.sender_id === staff?.id
          return (
            <div key={m.id} className={`chat__msg ${mine ? 'is-mine' : ''}`}>
              <div className="chat__bubble">{renderBody(m.body)}</div>
              <div className="chat__msg-foot">
                <button
                  type="button"
                  className={`chat__thumb ${m.thumbs_up_by_me ? 'is-on' : ''} ${m.thumbs_up_count ? 'has-count' : ''}`}
                  onClick={() => react(m.id)}
                  aria-pressed={m.thumbs_up_by_me}
                  aria-label={t('いいね')}
                >
                  <ThumbsUp size={13} />
                  {m.thumbs_up_count > 0 && <span>{m.thumbs_up_count}</span>}
                </button>
                <span className="chat__msg-time">{formatStamp(m.created_at, language)}</span>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      <div className="chat__composer">
        {error && <p className="chat__error">{error}</p>}
        <div className="chat__toolbar">
          <button type="button" onClick={applyBold} aria-label={t('太字')} title={`${t('太字')} (Ctrl+B)`}>
            <Bold size={15} />
          </button>
          <span className="chat__hint">{t('Enterで送信 / Shift+Enterで改行')}</span>
        </div>
        <div className="chat__input-row">
          <textarea
            ref={textareaRef}
            rows={2}
            value={draft}
            maxLength={2000}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('メッセージを入力')}
          />
          <button
            type="button"
            className="btn btn-primary chat__send"
            onClick={submit}
            disabled={!draft.trim() || isSending}
            aria-label={t('送信')}
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}

export default function ChatPage() {
  const { t } = useLanguage()
  const { isAdmin } = useAuth()
  const [conversations, setConversations] = useState([])
  const [admins, setAdmins] = useState([])
  const [activeId, setActiveId] = useState(null)
  const [extra, setExtra] = useState(null)
  const [searchParams, setSearchParams] = useSearchParams()

  const reload = useCallback(
    () => fetchConversations().then(setConversations).catch(() => {}),
    [],
  )

  useEffect(() => {
    reload()
    const timer = setInterval(reload, POLL_MS * 2)
    return () => clearInterval(timer)
  }, [reload])

  // ユーザー側は、同一事業者の管理者をチャット相手として一覧の先頭に固定表示する
  // （まだ会話が無い場合は、押下するとその場で会話が開始される仮の項目として表示する）
  useEffect(() => {
    if (isAdmin) return
    fetchAdminChatTargets().then(setAdmins).catch(() => setAdmins([]))
  }, [isAdmin])

  const displayConversations = useMemo(() => {
    if (isAdmin || admins.length === 0) return conversations
    const adminIds = new Set(admins.map((admin) => admin.id))
    const pinned = admins.map((admin) => (
      conversations.find((conv) => conv.partner?.id === admin.id)
      || { id: `admin-${admin.id}`, partner: admin, last_message: null, unread_count: 0, isSynthetic: true }
    ))
    const rest = conversations.filter((conv) => !adminIds.has(conv.partner?.id))
    return [...pinned, ...rest]
  }, [conversations, admins, isAdmin])

  const openUser = useCallback(async (userId) => {
    try {
      const conv = await openConversation(userId)
      setExtra(conv)
      setActiveId(conv.id)
      reload()
    } catch {
      // 失敗時は何もしない（検索は閉じたまま）
    }
  }, [reload])

  // サイドバーの管理者一覧から ?with=<staffId> で遷移してきた場合、自動でその相手の会話を開く
  useEffect(() => {
    const withId = searchParams.get('with')
    if (!withId) return
    openUser(Number(withId))
    setSearchParams((params) => {
      params.delete('with')
      return params
    }, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  const active = conversations.find((c) => c.id === activeId) || (extra?.id === activeId ? extra : null)

  return (
    <div className={`chat ${active ? 'has-active' : ''}`}>
      <h1 className="chat__title">{t('チャット')}</h1>
      <div className="chat__layout">
        <Sidebar
          conversations={displayConversations}
          activeId={activeId}
          onSelect={setActiveId}
          onOpenUser={openUser}
        />
        {active ? (
          <Thread
            key={active.id}
            conversation={active}
            onBack={() => setActiveId(null)}
            onSent={reload}
          />
        ) : (
          <div className="chat__placeholder">{t('チャットを選択してください')}</div>
        )}
      </div>
    </div>
  )
}
