import { useCallback, useEffect, useId, useRef, useState } from 'react'

import aiChatChipIcon from '../assets/ai-chat-chip-icon.png'
import { postSequentialChat } from '../lib/api'
import { getCannedSequentialReply } from '../lib/sequentialChatCanned'
import { useSommelierUiStore } from '../store/sommelierUiStore'
import { useTripStore } from '../store/tripStore'

const WELCOME_TEXT =
  'Привет! Помогу спланировать винный маршрут: что добавить после текущих остановок, как не перегрузить день, напомню про бронирование дегустаций. Задайте вопрос или нажмите подсказку ниже.'

const SUGGESTIONS = [
  'Что логично добавить дальше?',
  'Как не перегрузить день?',
  'Напомни про бронирование',
]

/** Иконка чипа из макета (PNG с прозрачным фоном) */
function AiChipIcon({ className = '' }) {
  return (
    <img
      src={aiChatChipIcon}
      alt=""
      className={`h-full w-full select-none object-contain ${className}`}
      draggable={false}
    />
  )
}

function ChatCloseIcon() {
  return (
    <svg className="h-8 w-8" viewBox="0 0 32 32" fill="none" aria-hidden>
      <path
        d="M8 8l16 16M24 8L8 24"
        stroke="#474646"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  )
}

function assistantFootnote(replySource, usedAi) {
  if (replySource === 'canned') return 'Готовый ответ'
  if (replySource === 'yandex') return 'Яндекс GPT'
  if (replySource === 'local') return 'Локальная подсказка'
  if (usedAi === true) return 'Яндекс GPT'
  if (usedAi === false) return 'Локальная подсказка'
  return null
}

function MessageBubble({ role, text, usedAi, replySource }) {
  const isUser = role === 'user'
  const foot = !isUser ? assistantFootnote(replySource, usedAi) : null
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={
          isUser
            ? 'max-w-[min(414px,85%)] rounded-[24px] bg-[#B12030] px-6 py-2.5 shadow-sm'
            : 'max-w-[min(414px,92%)] rounded-[31px] bg-[#D8D6D6] px-4 py-4 shadow-sm'
        }
      >
        <p
          className={`whitespace-pre-wrap font-['Montserrat'] text-[clamp(14px,3vw,18px)] font-semibold leading-[130%] tracking-[0.02em] ${
            isUser ? 'text-white' : 'text-black'
          }`}
        >
          {text}
        </p>
        {foot && (
          <p className="mt-2 text-[10px] font-bold uppercase tracking-wide text-stone-500">{foot}</p>
        )}
      </div>
    </div>
  )
}

/**
 * Развёрнутая панель ИИ-чата.
 */
function SequentialAiChatPanel({
  open,
  onClose,
  titleId,
  messages,
  sending,
  sendError,
  onSend,
  draft,
  setDraft,
  listRef,
}) {
  const onKeyDown = useCallback(
    (e) => {
      if (e.key === 'Escape') onClose()
    },
    [onClose],
  )

  useEffect(() => {
    if (!open) return undefined
    document.addEventListener('keydown', onKeyDown)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = prev
    }
  }, [open, onKeyDown])

  useEffect(() => {
    if (!open || !listRef.current) return
    listRef.current.scrollTop = listRef.current.scrollHeight
  }, [open, messages, sending, listRef])

  if (!open) return null

  function submit(e) {
    e.preventDefault()
    const t = draft.trim()
    if (!t || sending) return
    onSend(t)
    setDraft('')
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="pointer-events-auto fixed z-[256] flex h-[min(2234px,calc(100dvh-1.5rem))] w-[min(502px,calc(100vw-1rem))] origin-top-right scale-[0.7] flex-col overflow-hidden rounded-[43px] bg-white shadow-[0_24px_64px_-20px_rgba(42,13,22,0.4)] ring-1 ring-stone-900/[0.08]"
      style={{
        top: 'max(41px, calc(env(safe-area-inset-top, 0px) + 20px))',
        right: 'max(17px, env(safe-area-inset-right, 0px))',
      }}
    >
      <header className="relative flex shrink-0 items-center gap-3 border-b border-stone-100 pl-3 pr-14 pt-5 pb-3">
        <div className="flex h-[82px] w-[82px] shrink-0 items-center justify-center">
          <AiChipIcon />
        </div>
        <div className="min-w-0">
          <h2
            id={titleId}
            className="font-['Montserrat'] text-[clamp(26px,5vw,45px)] font-bold leading-[100.79%] tracking-[0.03em] text-black"
          >
            ИИ-Чат
          </h2>
          <p className="mt-1 text-[11px] font-medium text-stone-500">Маршрут по Кубани — подсказки по остановкам</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-6 rounded-full p-1 text-stone-600 transition hover:bg-stone-100 hover:text-stone-900"
          aria-label="Закрыть"
        >
          <ChatCloseIcon />
        </button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col">
        <div
          ref={listRef}
          className="mx-auto flex min-h-0 w-full max-w-full flex-1 flex-col gap-3 overflow-y-auto overscroll-contain px-[15px] py-3 max-h-[min(420px,calc(100dvh-16rem))] [scrollbar-width:thin]"
        >
          {messages.map((m) => (
            <MessageBubble
              key={m.id}
              role={m.role}
              text={m.text}
              usedAi={m.usedAi}
              replySource={m.replySource}
            />
          ))}
          {sending && (
            <div className="flex justify-start">
              <div className="rounded-[31px] bg-stone-200/90 px-4 py-3">
                <p className="font-['Montserrat'] text-sm font-semibold text-stone-600 animate-pulse">Печатаю…</p>
              </div>
            </div>
          )}
        </div>

        {sendError && (
          <p className="mx-[15px] shrink-0 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
            {sendError}
          </p>
        )}

        <div className="shrink-0 border-t border-stone-100 px-[15px] pb-3 pt-2">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-stone-400">Быстрый вопрос</p>
          <div className="mb-3 flex flex-wrap gap-1.5">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                disabled={sending}
                onClick={() => onSend(s)}
                className="rounded-full border border-wine-200 bg-wine-50/80 px-2.5 py-1 text-[11px] font-semibold text-wine-900 transition hover:bg-wine-100 disabled:opacity-40"
              >
                {s}
              </button>
            ))}
          </div>
          <form onSubmit={submit} className="flex gap-2">
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Напишите сообщение…"
              disabled={sending}
              maxLength={2000}
              className="h-[52px] min-w-0 flex-1 rounded-[31px] border border-stone-200 bg-[#E9E6E6] px-4 font-['Montserrat'] text-[clamp(14px,2.5vw,17px)] text-stone-800 outline-none ring-wine-400/30 placeholder:text-stone-400 focus:ring-2 disabled:opacity-50"
              aria-label="Сообщение ассистенту"
            />
            <button
              type="submit"
              disabled={sending || !draft.trim()}
              className="h-[52px] shrink-0 rounded-[31px] bg-[#B12030] px-5 font-['Montserrat'] text-sm font-bold text-white shadow-md transition hover:brightness-110 disabled:opacity-40"
            >
              Отправить
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

let msgId = 0
function nextId() {
  msgId += 1
  return `m-${msgId}`
}

/**
 * Компактная карточка + развёрнутая панель ИИ-Чат (последовательный тур с AI).
 */
export function SequentialAiChatCard() {
  const [panelOpen, setPanelOpen] = useState(false)
  const [messages, setMessages] = useState([])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState(null)
  const welcomedRef = useRef(false)
  const listRef = useRef(null)
  const titleId = useId()

  const places = useTripStore((s) => s.places)
  const sequentialAiChatCloseSignal = useSommelierUiStore((s) => s.sequentialAiChatCloseSignal)
  const signalCloseSommelier = useSommelierUiStore((s) => s.signalCloseSommelier)

  useEffect(() => {
    if (sequentialAiChatCloseSignal > 0) setPanelOpen(false)
  }, [sequentialAiChatCloseSignal])

  useEffect(() => {
    if (!panelOpen) return
    if (welcomedRef.current) return
    welcomedRef.current = true
    setMessages([{ id: nextId(), role: 'assistant', text: WELCOME_TEXT }])
  }, [panelOpen])

  const sendMessage = useCallback(
    async (rawText) => {
      const text = String(rawText || '').trim()
      if (!text || sending) return
      setSendError(null)
      const history = messages.slice(-12).map((m) => ({ role: m.role, text: m.text }))
      const route_place_ids = (places || []).map((p) => p.id).filter(Boolean)
      setMessages((prev) => [...prev, { id: nextId(), role: 'user', text }])

      const canned = getCannedSequentialReply(text, places)
      if (canned?.text) {
        setMessages((prev) => [
          ...prev,
          { id: nextId(), role: 'assistant', text: canned.text, replySource: 'canned' },
        ])
        return
      }

      setSending(true)
      try {
        const data = await postSequentialChat({
          message: text,
          route_place_ids,
          history,
        })
        const reply = typeof data?.reply === 'string' ? data.reply : 'Не удалось разобрать ответ.'
        const replySource = data?.used_ai ? 'yandex' : 'local'
        setMessages((prev) => [...prev, { id: nextId(), role: 'assistant', text: reply, replySource }])
      } catch (e) {
        const detail = e.response?.data?.detail || e.message || 'Ошибка сети'
        setSendError(String(detail))
        setMessages((prev) => [
          ...prev,
          {
            id: nextId(),
            role: 'assistant',
            text: 'Сейчас не получилось связаться с ассистентом. Проверьте соединение и попробуйте ещё раз.',
            replySource: 'local',
          },
        ])
      } finally {
        setSending(false)
      }
    },
    [messages, places, sending],
  )

  return (
    <>
      {!panelOpen && (
        <div
          className="pointer-events-auto fixed z-[250] box-border flex h-[111px] w-[min(300px,calc(100vw-1.5rem))] max-w-[calc(100vw-1.5rem)] items-center rounded-[30px] bg-white pl-[11px] pr-[10px] shadow-[0_11px_34px_-10px_rgba(42,13,22,0.28)] ring-1 ring-stone-900/[0.06]"
          style={{
            top: 'max(27px, calc(env(safe-area-inset-top, 0px) + 17px))',
            right: 'max(12px, env(safe-area-inset-right, 0px))',
          }}
          role="region"
          aria-label="ИИ-Чат"
        >
          <div className="flex h-[97px] w-[97px] shrink-0 items-center justify-center self-center">
            <AiChipIcon />
          </div>
          <div className="flex min-w-0 max-w-[min(178px,42vw)] flex-1 flex-col justify-center pl-1 pr-0 pt-1">
            <p className="font-['Montserrat'] text-[clamp(17px,2.4vw,26px)] font-bold leading-[100.79%] tracking-[0.03em] text-black">
              ИИ-Чат
            </p>
            <button
              type="button"
              onClick={() => {
                signalCloseSommelier()
                setPanelOpen(true)
              }}
              className="mt-2 h-[30px] w-full max-w-[136px] shrink-0 rounded-[14px] bg-[#B12030] font-['Montserrat'] text-[clamp(12px,1.9vw,16px)] font-bold leading-[100.79%] tracking-[0.03em] text-white shadow-md transition hover:brightness-110 active:scale-[0.99]"
            >
              Открыть
            </button>
          </div>
        </div>
      )}

      <SequentialAiChatPanel
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        titleId={titleId}
        messages={messages}
        sending={sending}
        sendError={sendError}
        onSend={sendMessage}
        draft={draft}
        setDraft={setDraft}
        listRef={listRef}
      />
    </>
  )
}
