import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import aiChatChipIcon from '../assets/ai-chat-chip-icon.png'
import { buildRandomCompactPlaceIds } from '../lib/randomCompactRoute'
import { getCannedSequentialReply } from '../lib/sequentialChatCanned'
import { normRouteId } from '../lib/routeQuery'
import { useSommelierUiStore } from '../store/sommelierUiStore'
import { useTripStore } from '../store/tripStore'

const WELCOME_TEXT =
  'Привет! Помогу составить самый идеальный для вас маршрут по одному запросу. Задайте запрос.'

const SUGGESTIONS = [
  'Что логично добавить дальше?',
  'Как не перегрузить день?',
  'Напомни про бронирование',
]

/** Как на странице /quiz — для демо-разбора запроса в теги */
const QUIZ_COMPANIONS = ['Семья', 'Один', 'Пара', 'Коллеги', 'Друзья']
const QUIZ_MOOD = ['Романтика', 'Гастрономия', 'Активно', 'Спокойно', 'Исследование']
const QUIZ_DURATION = ['День', 'Два дня', 'Неделя', 'Три дня', 'Выходные']
const QUIZ_EXTRA = [
  'Дегустации',
  'Фотостопы',
  'Живописно',
  'Без спешки',
  'Уютные места',
  'Локальная кухня',
  'С детьми',
  'Трансфер',
]

const MIN_MESSAGE_LEN = 4
const TAG_REGENERATE_DELAY_MS = 3000
/** После «Да»: фаза 1, затем фаза 2 (ещё 3 с), затем запросы к API */
const TAG_YES_ROUTE_HINT_MS = 2000
const TAG_YES_WEATHER_HINT_MS = 3000

function formatApiError(e) {
  const d = e?.response?.data?.detail
  if (typeof d === 'string') return d
  if (Array.isArray(d)) {
    return d
      .map((x) => (typeof x === 'string' ? x : x?.msg || JSON.stringify(x)))
      .filter(Boolean)
      .join('; ')
  }
  if (d && typeof d === 'object') return JSON.stringify(d)
  return e?.message || 'Не удалось построить маршрут'
}

function randomFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

function sampleExtras(count) {
  const shuffled = [...QUIZ_EXTRA].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, Math.min(count, shuffled.length))
}

function buildTagAnalysisMessage() {
  const extraCount = Math.random() < 0.5 ? 1 : 2
  const extras = sampleExtras(extraCount)
  return [
    'Проанализировав ваш запрос, я перевёл его в теги — вот что получилось:',
    '',
    `• С кем: ${randomFrom(QUIZ_COMPANIONS)}`,
    `• Настроение: ${randomFrom(QUIZ_MOOD)}`,
    `• Срок: ${randomFrom(QUIZ_DURATION)}`,
    `• Дополнительно: ${extras.join(', ')}`,
  ].join('\n')
}

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
  routeProgressHint,
  sendError,
  onSend,
  onTagProposalYes,
  onTagProposalNo,
  draft,
  setDraft,
  listRef,
}) {
  const chatBusy = sending || !!routeProgressHint
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
  }, [open, messages, sending, routeProgressHint, listRef])

  if (!open) return null

  function submit(e) {
    e.preventDefault()
    const t = draft.trim()
    if (!t || chatBusy) return
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
            <div key={m.id} className="flex flex-col">
              <MessageBubble
                role={m.role}
                text={m.text}
                usedAi={m.usedAi}
                replySource={m.replySource}
              />
              {m.role === 'assistant' && m.tagProposal && !m.tagChoice && (
                <div className="flex justify-start">
                  <div className="mt-1.5 flex max-w-[min(414px,92%)] gap-2 pl-1">
                    <button
                      type="button"
                      disabled={chatBusy}
                      onClick={() => onTagProposalYes(m.id)}
                      className="rounded-full border border-wine-300 bg-wine-50 px-4 py-1.5 font-['Montserrat'] text-xs font-bold text-wine-900 transition hover:bg-wine-100 disabled:opacity-40"
                    >
                      Да
                    </button>
                    <button
                      type="button"
                      disabled={chatBusy}
                      onClick={() => onTagProposalNo(m.id)}
                      className="rounded-full border border-stone-300 bg-white px-4 py-1.5 font-['Montserrat'] text-xs font-bold text-stone-700 transition hover:bg-stone-50 disabled:opacity-40"
                    >
                      Нет
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
          {chatBusy && (
            <div className="flex justify-start">
              <div className="rounded-[31px] bg-stone-200/90 px-4 py-3">
                <p className="font-['Montserrat'] text-sm font-semibold text-stone-600 animate-pulse">
                  {routeProgressHint || 'Печатаю…'}
                </p>
              </div>
            </div>
          )}
        </div>

        {sendError && (
          <p className="mx-[15px] shrink-0 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
            {sendError}
          </p>
        )}

        <div className="mt-auto shrink-0 border-t border-stone-100 px-[15px] pb-2 pt-2">
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-stone-400">Быстрый вопрос</p>
          <div className="mb-2 flex flex-wrap gap-1.5">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                disabled={chatBusy}
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
              disabled={chatBusy}
              maxLength={2000}
              className="h-[52px] min-w-0 flex-1 rounded-[31px] border border-stone-200 bg-[#E9E6E6] px-4 font-['Montserrat'] text-[clamp(14px,2.5vw,17px)] text-stone-800 outline-none ring-wine-400/30 placeholder:text-stone-400 focus:ring-2 disabled:opacity-50"
              aria-label="Сообщение ассистенту"
            />
            <button
              type="submit"
              disabled={chatBusy || !draft.trim()}
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
  const navigate = useNavigate()
  const [panelOpen, setPanelOpen] = useState(false)
  const [messages, setMessages] = useState([])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [routeProgressHint, setRouteProgressHint] = useState(null)
  const [sendError, setSendError] = useState(null)
  const welcomedRef = useRef(false)
  const listRef = useRef(null)
  const tagRegenerateTimerRef = useRef(null)
  const tagYesTimersRef = useRef([])
  const tagProposalYesInFlightRef = useRef(false)
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

  useEffect(() => {
    if (panelOpen) return undefined
    if (tagRegenerateTimerRef.current != null) {
      window.clearTimeout(tagRegenerateTimerRef.current)
      tagRegenerateTimerRef.current = null
    }
    for (const t of tagYesTimersRef.current) {
      if (t != null) window.clearTimeout(t)
    }
    tagYesTimersRef.current = []
    tagProposalYesInFlightRef.current = false
    setRouteProgressHint(null)
    setSending(false)
    return undefined
  }, [panelOpen])

  const sendMessage = useCallback(
    async (rawText) => {
      const text = String(rawText || '').trim()
      if (!text || sending || routeProgressHint) return
      setSendError(null)
      setMessages((prev) => [...prev, { id: nextId(), role: 'user', text }])

      if (text.length < MIN_MESSAGE_LEN) {
        setMessages((prev) => [
          ...prev,
          {
            id: nextId(),
            role: 'assistant',
            text: 'Неккоректный запрос',
            replySource: 'local',
          },
        ])
        return
      }

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
        await new Promise((r) => setTimeout(r, 5000))
        setMessages((prev) => [
          ...prev,
          {
            id: nextId(),
            role: 'assistant',
            text: buildTagAnalysisMessage(),
            replySource: 'local',
            tagProposal: true,
          },
        ])
      } finally {
        setSending(false)
      }
    },
    [messages, places, sending, routeProgressHint],
  )

  const onTagProposalYes = useCallback((msgId) => {
    if (tagProposalYesInFlightRef.current) return
    tagProposalYesInFlightRef.current = true
    setSendError(null)
    setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, tagChoice: 'yes' } : m)))
    for (const t of tagYesTimersRef.current) {
      if (t != null) window.clearTimeout(t)
    }
    tagYesTimersRef.current = []
    setRouteProgressHint('Простраиваю маршрут')

    const t1 = window.setTimeout(() => {
      setRouteProgressHint('Анализирую погоду')
    }, TAG_YES_ROUTE_HINT_MS)

    const t2 = window.setTimeout(async () => {
      setRouteProgressHint(null)
      setSending(true)
      try {
        const ids = await buildRandomCompactPlaceIds()
        if (!ids.length) throw new Error('Не удалось подобрать точки')
        const trip = useTripStore.getState()
        const data = await trip.startRouteWithPlace(ids[0])
        if (!data?.route?.id) throw new Error('Не удалось создать маршрут')
        if (ids.length > 1) {
          await trip.patchRoute(ids.slice(1), [])
        }
        const rid = useTripStore.getState().route?.id
        if (rid) {
          navigate(
            { pathname: '/route', search: `?route=${encodeURIComponent(normRouteId(String(rid)))}` },
            { replace: true },
          )
        }
        setMessages((prev) => [
          ...prev,
          {
            id: nextId(),
            role: 'assistant',
            text: `Маршрут из ${ids.length} остановок на карте страницы «Маршрут»: есть точки с питанием, переезды короткие.`,
            replySource: 'local',
          },
        ])
      } catch (e) {
        setSendError(formatApiError(e))
      } finally {
        setSending(false)
        tagProposalYesInFlightRef.current = false
      }
    }, TAG_YES_ROUTE_HINT_MS + TAG_YES_WEATHER_HINT_MS)

    tagYesTimersRef.current = [t1, t2]
  }, [navigate])

  const onTagProposalNo = useCallback((msgId) => {
    if (tagRegenerateTimerRef.current != null) {
      window.clearTimeout(tagRegenerateTimerRef.current)
      tagRegenerateTimerRef.current = null
    }
    setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, tagChoice: 'no' } : m)))
    setSending(true)
    tagRegenerateTimerRef.current = window.setTimeout(() => {
      tagRegenerateTimerRef.current = null
      setMessages((prev) => [
        ...prev,
        {
          id: nextId(),
          role: 'assistant',
          text: buildTagAnalysisMessage(),
          replySource: 'local',
          tagProposal: true,
        },
      ])
      setSending(false)
    }, TAG_REGENERATE_DELAY_MS)
  }, [])

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
        routeProgressHint={routeProgressHint}
        sendError={sendError}
        onSend={sendMessage}
        onTagProposalYes={onTagProposalYes}
        onTagProposalNo={onTagProposalNo}
        draft={draft}
        setDraft={setDraft}
        listRef={listRef}
      />
    </>
  )
}
