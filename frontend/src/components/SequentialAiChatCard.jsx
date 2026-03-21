import { useCallback, useEffect, useId, useState } from 'react'

import aiChatChipIcon from '../assets/ai-chat-chip-icon.png'
import { useSommelierUiStore } from '../store/sommelierUiStore'

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

/**
 * Развёрнутая панель ИИ-чата. Высота карточки — от viewport; область сообщений ограничена max-h,
 * чтобы колонка чата не растягивалась на весь flex-1 (иначе высота «плавает» с dvh и шапкой).
 */
function SequentialAiChatPanel({ open, onClose, titleId }) {
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

  if (!open) return null

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
        <header className="relative flex shrink-0 items-center gap-3 pl-3 pr-14 pt-5 pb-3">
          <div className="flex h-[82px] w-[82px] shrink-0 items-center justify-center">
            <AiChipIcon />
          </div>
          <h2
            id={titleId}
            className="font-['Montserrat'] text-[clamp(26px,5vw,45px)] font-bold leading-[100.79%] tracking-[0.03em] text-black"
          >
            ИИ-Чат
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-6 rounded-full p-1 text-stone-600 transition hover:bg-stone-100 hover:text-stone-900"
            aria-label="Закрыть"
          >
            <ChatCloseIcon />
          </button>
        </header>

        <div className="flex min-h-0 flex-1 flex-col justify-end">
          <div className="mx-auto flex min-h-0 w-full max-w-full flex-1 flex-col px-[15px] pb-2 max-h-[min(510px,calc(100dvh-14rem))]">
            <div className="flex min-h-0 flex-1 flex-col justify-end gap-4 overflow-y-auto overscroll-contain py-4 [scrollbar-width:thin]">
              <div className="flex justify-end">
                <div className="max-w-[min(414px,85%)] rounded-[24px] bg-[#B12030] px-10 py-2.5">
                  <p className="text-center font-['Montserrat'] text-[clamp(16px,3.5vw,25px)] font-bold leading-[100.79%] tracking-[0.03em] text-white">
                    Сообщение
                  </p>
                </div>
              </div>
              <div className="flex justify-start">
                <div className="max-w-[min(414px,92%)] rounded-[31px] bg-[#D8D6D6] px-4 py-6">
                  <p className="font-['Montserrat'] text-[clamp(15px,3.2vw,25px)] font-bold leading-[120%] tracking-[0.03em] text-black">
                    влыолвоыдллывотлыодлаоывла
                  </p>
                </div>
              </div>
            </div>

            <div className="shrink-0 pb-4 pt-2">
              <input
                type="text"
                readOnly
                placeholder="Напишите сообщение…"
                className="h-[57px] w-full cursor-default rounded-[31px] border-0 bg-[#E9E6E6] px-5 font-['Montserrat'] text-[clamp(14px,2.5vw,18px)] text-stone-800 outline-none placeholder:text-stone-400"
                aria-label="Поле сообщения (скоро)"
              />
            </div>
          </div>
        </div>
    </div>
  )
}

/**
 * Компактная карточка + развёрнутая панель ИИ-Чат (последовательный тур с AI).
 */
export function SequentialAiChatCard() {
  const [panelOpen, setPanelOpen] = useState(false)
  const titleId = useId()
  const sequentialAiChatCloseSignal = useSommelierUiStore((s) => s.sequentialAiChatCloseSignal)
  const signalCloseSommelier = useSommelierUiStore((s) => s.signalCloseSommelier)

  useEffect(() => {
    if (sequentialAiChatCloseSignal > 0) setPanelOpen(false)
  }, [sequentialAiChatCloseSignal])

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

      <SequentialAiChatPanel open={panelOpen} onClose={() => setPanelOpen(false)} titleId={titleId} />
    </>
  )
}
