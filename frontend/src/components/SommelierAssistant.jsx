import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useLocation } from 'react-router-dom'

import { fetchSommelierRecommend } from '../lib/api'
import { bumpSommelierRootToBodyEnd } from '../lib/sommelierDom'
import { useSommelierUiStore } from '../store/sommelierUiStore'
import { useTripStore } from '../store/tripStore'

/** Выше оверлеев Яндекс.Карт (часто 1e4–1e6); инлайн — не зависит от purge Tailwind */
const LAYER_Z = 2147483646

const fabLeft = () =>
  typeof window !== 'undefined'
    ? `max(16px, env(safe-area-inset-left, 0px))`
    : '16px'
const fabBottom = () =>
  typeof window !== 'undefined' ? `max(20px, env(safe-area-inset-bottom, 0px))` : '20px'

function sommelierPortalHost() {
  if (typeof document === 'undefined') return null
  return document.getElementById('sommelier-root') ?? document.body
}

const Q1 = [
  { value: 'red', label: 'Красное' },
  { value: 'white', label: 'Белое' },
  { value: 'sparkling', label: 'Игристое' },
]
const Q2 = [
  { value: 'fruity', label: 'Фруктовый' },
  { value: 'aged', label: 'Выдержанный' },
  { value: 'dry', label: 'Сухой' },
]
const Q3 = [
  { value: 'tasting', label: 'Дегустация' },
  { value: 'tour', label: 'Экскурсия' },
  { value: 'purchase', label: 'Покупка' },
]

/** Иконка бокала: почти пустой — тонкий остаток вина у дна, контур чаши читается на фоне круга */
function SommelierFabWineGlass() {
  const bowlClipId = useId().replace(/:/g, '')
  return (
    <svg
      className="pointer-events-none absolute left-[34px] top-[14px] z-20 h-[73px] w-[34px]"
      viewBox="0 0 42 91"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <defs>
        <clipPath id={bowlClipId}>
          <rect x="5" y="6" width="32" height="29" rx="6" />
        </clipPath>
      </defs>
      {/* Ножка */}
      <rect x="16" y="50" width="10" height="37" rx="1.5" fill="#FFFFFF" />
      {/* Подставка */}
      <rect x="5" y="86" width="32" height="4.5" rx="2" fill="#FFFFFF" />
      {/* Чаша: полупрозрачная «пустота» + белый контур — виден красный фон круга */}
      <rect
        x="2.5"
        y="2.5"
        width="37"
        height="35"
        rx="8"
        fill="rgba(255, 255, 255, 0.14)"
        stroke="#FFFFFF"
        strokeWidth="2.25"
        strokeLinejoin="round"
      />
      {/* Остаток вина у дна (клип внутри чаши — только нижняя полоска) */}
      <g clipPath={`url(#${bowlClipId})`}>
        <ellipse cx="21" cy="42" rx="17" ry="12" fill="#4A0D14" />
        <ellipse cx="21" cy="33.5" rx="12" ry="2.2" fill="#F5C2C8" opacity="0.85" />
      </g>
    </svg>
  )
}

export function SommelierAssistant() {
  const location = useLocation()
  const openRequestId = useSommelierUiStore((s) => s.openRequestId)
  const sommelierCloseSignal = useSommelierUiStore((s) => s.sommelierCloseSignal)
  const signalCloseSequentialAiChat = useSommelierUiStore((s) => s.signalCloseSequentialAiChat)
  const route = useTripStore((s) => s.route)
  const routePlaces = useTripStore((s) => s.places)
  const patching = useTripStore((s) => s.patching)
  const loadingRoute = useTripStore((s) => s.loading)
  const addStop = useTripStore((s) => s.addStop)
  const startRouteWithPlace = useTripStore((s) => s.startRouteWithPlace)
  const [open, setOpen] = useState(false)
  const [panelOffset, setPanelOffset] = useState({ x: 0, y: 0 })
  const panelOffsetRef = useRef({ x: 0, y: 0 })
  const [step, setStep] = useState(0)
  const answersRef = useRef({ wine_type: null, wine_style: null, visit_goal: null })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)
  const [addingId, setAddingId] = useState(null)
  const [addError, setAddError] = useState(null)

  const reset = useCallback(() => {
    setStep(0)
    answersRef.current = { wine_type: null, wine_style: null, visit_goal: null }
    setError(null)
    setResult(null)
    setLoading(false)
    setAddError(null)
    setAddingId(null)
  }, [])

  const handleOpen = () => {
    setOpen(true)
    if (step === 0 && !result) {
      /* начальный шаг */
    }
  }

  const handleClose = () => {
    setOpen(false)
  }

  /** Карта Яндекса дописывает узлы в конец body — держим #sommelier-root последним */
  useLayoutEffect(() => {
    bumpSommelierRootToBodyEnd()
  }, [location.pathname])

  useEffect(() => {
    if (sommelierCloseSignal > 0) setOpen(false)
  }, [sommelierCloseSignal])

  useEffect(() => {
    if (openRequestId > 0) {
      signalCloseSequentialAiChat()
      setOpen(true)
    }
  }, [openRequestId, signalCloseSequentialAiChat])

  useEffect(() => {
    panelOffsetRef.current = panelOffset
  }, [panelOffset])

  useEffect(() => {
    if (!open) setPanelOffset({ x: 0, y: 0 })
  }, [open])

  const beginPanelDrag = useCallback((e) => {
    if (e.button !== 0) return
    if (e.target.closest('button, a, input, textarea, select')) return
    e.preventDefault()
    const ox = panelOffsetRef.current.x
    const oy = panelOffsetRef.current.y
    const sx = e.clientX
    const sy = e.clientY
    const onMove = (ev) => {
      setPanelOffset({
        x: ox + ev.clientX - sx,
        y: oy + ev.clientY - sy,
      })
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
  }, [])

  const runRecommend = async (finalAnswers) => {
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const data = await fetchSommelierRecommend({
        wine_type: finalAnswers.wine_type,
        wine_style: finalAnswers.wine_style,
        visit_goal: finalAnswers.visit_goal,
      })
      setResult(data)
      setStep(5)
    } catch (e) {
      setError(
        typeof e.response?.data === 'string'
          ? e.response.data
          : e.response?.data?.detail || e.message || 'Не удалось получить рекомендации',
      )
      setStep(5)
    } finally {
      setLoading(false)
    }
  }

  const pick = (field, value) => {
    const next = { ...answersRef.current, [field]: value }
    answersRef.current = next
    if (field === 'visit_goal') {
      setStep(4)
      void runRecommend(next)
    } else {
      if (field === 'wine_type') setStep(2)
      if (field === 'wine_style') setStep(3)
    }
  }

  const routeIdSet = new Set((routePlaces || []).map((p) => String(p.id)))

  const handleAddToRoute = async (placeId) => {
    if (!placeId || patching || loadingRoute) return
    if (routeIdSet.has(String(placeId))) return
    setAddError(null)
    setAddingId(String(placeId))
    try {
      if (!route) {
        await startRouteWithPlace(placeId)
      } else {
        const res = await addStop(placeId)
        if (res === null) {
          setAddError('Маршрут устарел — нажмите «Добавить» ещё раз.')
        }
      }
    } catch (e) {
      setAddError(e?.response?.data?.detail || e?.message || 'Не удалось добавить в маршрут')
    } finally {
      setAddingId(null)
    }
  }

  const ui = (
    <div
      id="turizm-sommelier-layer"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: LAYER_Z,
        pointerEvents: 'none',
      }}
    >
      <button
        type="button"
        data-turizm-sommelier-fab="v3-wine-glass"
        data-vite-build={import.meta.env.VITE_APP_BUILD_ID ?? 'dev'}
        onClick={() => {
          if (open) handleClose()
          else {
            signalCloseSequentialAiChat()
            handleOpen()
          }
        }}
        style={{
          pointerEvents: 'auto',
          position: 'fixed',
          left: fabLeft(),
          bottom: fabBottom(),
          right: 'auto',
          zIndex: 2,
          width: 101,
          height: 130,
          padding: 0,
          margin: 0,
          border: 'none',
          background: 'transparent',
          cursor: 'pointer',
          filter: 'drop-shadow(0 4px 14px rgba(0, 0, 0, 0.35)) drop-shadow(0 6px 24px rgba(69, 21, 38, 0.45))',
        }}
        className="group relative transition hover:brightness-[1.03] hover:scale-[1.02] active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-wine-500 focus-visible:ring-offset-2"
        aria-label={open ? 'Закрыть сомелье' : 'Виртуальный сомелье'}
        title="Виртуальный сомелье"
      >
        {/* Rectangle 37161 — белая подложка */}
        <span
          className="pointer-events-none absolute bottom-0 left-[10px] z-0 flex h-[94px] w-[82px] items-end justify-center rounded-[21px] bg-white"
          aria-hidden
        />
        {/* Ellipse 185 — красный круг */}
        <span
          className="pointer-events-none absolute left-0 top-0 z-10 h-[101px] w-[101px] rounded-full bg-[#B12030]"
          aria-hidden
        />
        <SommelierFabWineGlass />
        {/* Подпись: размер и шрифт инлайном — тот же бандл, что и разметка; не «мигает» из‑за рассинхрона кэша CSS/JS */}
        <span
          className="pointer-events-none absolute bottom-[14px] left-1/2 z-30 max-w-none -translate-x-1/2 whitespace-nowrap text-center"
          data-ii-label-px="10"
          style={{
            fontFamily: "'Montserrat', system-ui, sans-serif",
            fontSize: 10,
            fontWeight: 700,
            lineHeight: 1,
            letterSpacing: '0.03em',
            color: '#000000',
          }}
        >
          ИИ-сомелье
        </span>
      </button>

      {open && (
        <div
          style={{
            pointerEvents: 'auto',
            position: 'fixed',
            left: fabLeft(),
            bottom: `calc(168px + env(safe-area-inset-bottom, 0px))`,
            right: 'auto',
            zIndex: 3,
            transform: `translate(${panelOffset.x}px, ${panelOffset.y}px)`,
          }}
          className="flex w-[min(calc(100vw-2.5rem),400px)] max-h-[min(72dvh,560px)] flex-col overflow-hidden rounded-2xl border border-stone-200/90 bg-[#faf7f2]/98 shadow-card-lg backdrop-blur-md"
          role="dialog"
          aria-labelledby="sommelier-title"
        >
          <div
            className="flex shrink-0 cursor-grab select-none touch-none items-center justify-between gap-2 border-b border-stone-200/80 bg-white/80 px-3 py-2.5 active:cursor-grabbing"
            onPointerDown={beginPanelDrag}
            role="presentation"
          >
            <div className="min-w-0">
              <h2 id="sommelier-title" className="font-display text-sm font-semibold text-wine-950">
                Виртуальный сомелье
              </h2>
              <p className="text-[10px] text-stone-500">Три вопроса — персональная подборка</p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={reset}
                className="rounded-lg px-2 py-1 text-[11px] font-medium text-wine-800 hover:bg-wine-50"
              >
                Заново
              </button>
              <button
                type="button"
                onClick={handleClose}
                className="rounded-full p-1.5 text-stone-500 hover:bg-stone-100 hover:text-stone-800"
                aria-label="Свернуть"
              >
                ×
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3 space-y-3 text-left">
            {step === 0 && (
              <div className="space-y-3">
                <p className="text-sm text-stone-700 leading-relaxed">
                  Здравствуйте! Я помогу выбрать винодельни под ваш вкус. Ответьте на три коротких вопроса.
                </p>
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="w-full rounded-xl bg-gradient-to-r from-wine-600 to-wine-800 py-2.5 text-sm font-semibold text-white shadow-soft"
                >
                  Начать
                </button>
              </div>
            )}

            {step === 1 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-stone-800">Какое вино предпочитаете?</p>
                <div className="flex flex-wrap gap-2">
                  {Q1.map((o) => (
                    <button
                      key={o.value}
                      type="button"
                      onClick={() => pick('wine_type', o.value)}
                      className="rounded-full border border-stone-200 bg-white px-3 py-2 text-xs font-medium text-stone-700 shadow-sm transition hover:border-wine-400 hover:text-wine-900"
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-stone-800">Какой стиль?</p>
                <div className="flex flex-wrap gap-2">
                  {Q2.map((o) => (
                    <button
                      key={o.value}
                      type="button"
                      onClick={() => pick('wine_style', o.value)}
                      className="rounded-full border border-stone-200 bg-white px-3 py-2 text-xs font-medium text-stone-700 shadow-sm transition hover:border-wine-400 hover:text-wine-900"
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-stone-800">Что ищете?</p>
                <div className="flex flex-wrap gap-2">
                  {Q3.map((o) => (
                    <button
                      key={o.value}
                      type="button"
                      onClick={() => pick('visit_goal', o.value)}
                      disabled={loading}
                      className="rounded-full border border-stone-200 bg-white px-3 py-2 text-xs font-medium text-stone-700 shadow-sm transition hover:border-wine-400 hover:text-wine-900 disabled:opacity-50"
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {step === 4 && loading && (
              <p className="text-sm text-stone-600 animate-pulse">Подбираю винодельни…</p>
            )}

            {step === 5 && error && (
              <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
            )}

            {step === 5 && result && !error && (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`text-[10px] font-semibold uppercase tracking-wide ${result.used_ai ? 'text-emerald-700' : 'text-stone-500'}`}
                  >
                    {result.used_ai ? 'Яндекс ИИ' : 'Локальная подборка'}
                  </span>
                </div>
                <p className="text-sm leading-relaxed text-stone-800">{result.explanation}</p>
                {result.recommendations?.length > 0 && (
                  <ul className="space-y-2">
                    {result.recommendations.map((r) => (
                      <li
                        key={r.place_id}
                        className="rounded-xl border border-stone-200/80 bg-white/90 p-2.5 shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-semibold text-wine-900 text-sm">{r.name}</p>
                          <button
                            type="button"
                            disabled={
                              patching ||
                              loadingRoute ||
                              addingId === String(r.place_id) ||
                              routeIdSet.has(String(r.place_id))
                            }
                            onClick={() => void handleAddToRoute(r.place_id)}
                            className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-wine-300 bg-wine-50 text-sm font-bold leading-none text-wine-900 transition hover:bg-wine-100 disabled:opacity-40"
                            title={
                              routeIdSet.has(String(r.place_id))
                                ? 'Уже в маршруте'
                                : route
                                  ? 'Добавить в маршрут'
                                  : 'Начать маршрут с этой точки'
                            }
                            aria-label="Добавить винодельню в маршрут"
                          >
                            {addingId === String(r.place_id) ? '…' : '+'}
                          </button>
                        </div>
                        <p className="mt-1 text-xs text-stone-600 leading-snug">{r.reason}</p>
                        <div className="mt-2">
                          {routeIdSet.has(String(r.place_id)) ? (
                            <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700 ring-1 ring-emerald-200">
                              Уже в маршруте
                            </span>
                          ) : (
                            <button
                              type="button"
                              disabled={patching || loadingRoute || addingId === String(r.place_id)}
                              onClick={() => void handleAddToRoute(r.place_id)}
                              className="inline-flex items-center rounded-lg border border-wine-200 bg-wine-50 px-2.5 py-1.5 text-[11px] font-semibold text-wine-900 transition hover:bg-wine-100 disabled:opacity-50"
                            >
                              {addingId === String(r.place_id)
                                ? 'Добавляю…'
                                : route
                                  ? '+ В маршрут'
                                  : '+ Начать маршрут здесь'}
                            </button>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                {addError && (
                  <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
                    {addError}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )

  const host = sommelierPortalHost()
  if (!host) return null
  return createPortal(ui, host)
}
