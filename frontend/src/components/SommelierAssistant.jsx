import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useLocation } from 'react-router-dom'

import { fetchSommelierRecommend } from '../lib/api'
import { bumpSommelierRootToBodyEnd } from '../lib/sommelierDom'
import { useSommelierUiStore } from '../store/sommelierUiStore'
import { useTripStore } from '../store/tripStore'

/** Выше оверлеев Яндекс.Карт (часто 1e4–1e6); инлайн — не зависит от purge Tailwind */
const LAYER_Z = 2147483000

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

function WineGlassIcon({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M7 3h10l-1 8.5c0 2.5-2 4.5-4 4.5s-4-2-4-4.5L7 3zm2.2 2l.55 5.2c.15 1.3 1.1 2.3 2.25 2.3s2.1-1 2.25-2.3L14.8 5H9.2zM8 20h8v2H8v-2z" />
    </svg>
  )
}

export function SommelierAssistant() {
  const location = useLocation()
  const openRequestId = useSommelierUiStore((s) => s.openRequestId)
  const route = useTripStore((s) => s.route)
  const routePlaces = useTripStore((s) => s.places)
  const patching = useTripStore((s) => s.patching)
  const addStop = useTripStore((s) => s.addStop)
  const [open, setOpen] = useState(false)
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
    if (openRequestId > 0) setOpen(true)
  }, [openRequestId])

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
    if (!route || !placeId || patching) return
    if (routeIdSet.has(String(placeId))) return
    setAddError(null)
    setAddingId(String(placeId))
    try {
      await addStop(placeId)
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
        onClick={() => (open ? handleClose() : handleOpen())}
        style={{
          pointerEvents: 'auto',
          position: 'absolute',
          bottom: 20,
          right: 20,
          zIndex: 2,
          width: 56,
          height: 56,
          borderRadius: 9999,
          color: '#fff',
          background: 'linear-gradient(145deg, #9e2d52 0%, #451526 100%)',
          boxShadow: '0 4px 28px rgba(69, 21, 38, 0.45)',
          border: '2px solid rgba(255,255,255,0.42)',
        }}
        className="flex items-center justify-center transition hover:brightness-110 hover:scale-105 active:scale-95"
        aria-label={open ? 'Закрыть сомелье' : 'Виртуальный сомелье'}
        title="Виртуальный сомелье"
      >
        <WineGlassIcon className="h-7 w-7" />
      </button>

      {open && (
        <div
          style={{ pointerEvents: 'auto', position: 'absolute', bottom: 96, right: 20, zIndex: 3 }}
          className="flex w-[min(calc(100vw-2.5rem),400px)] max-h-[min(72dvh,560px)] flex-col overflow-hidden rounded-2xl border border-stone-200/90 bg-[#faf7f2]/98 shadow-card-lg backdrop-blur-md"
          role="dialog"
          aria-labelledby="sommelier-title"
        >
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-stone-200/80 bg-white/80 px-3 py-2.5">
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
                    {result.used_ai ? 'Yandex AI' : 'Локальная подборка'}
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
                            disabled={!route || patching || addingId === String(r.place_id) || routeIdSet.has(String(r.place_id))}
                            onClick={() => void handleAddToRoute(r.place_id)}
                            className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-wine-300 bg-wine-50 text-sm font-bold leading-none text-wine-900 transition hover:bg-wine-100 disabled:opacity-40"
                            title={
                              routeIdSet.has(String(r.place_id))
                                ? 'Уже в маршруте'
                                : route
                                  ? 'Добавить в маршрут'
                                  : 'Сначала соберите маршрут'
                            }
                            aria-label="Добавить винодельню в маршрут"
                          >
                            {addingId === String(r.place_id) ? '…' : '+'}
                          </button>
                        </div>
                        <p className="mt-1 text-xs text-stone-600 leading-snug">{r.reason}</p>
                        {route ? (
                          <div className="mt-2">
                            {routeIdSet.has(String(r.place_id)) ? (
                              <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700 ring-1 ring-emerald-200">
                                Уже в маршруте
                              </span>
                            ) : (
                              <button
                                type="button"
                                disabled={patching || addingId === String(r.place_id)}
                                onClick={() => void handleAddToRoute(r.place_id)}
                                className="inline-flex items-center rounded-lg border border-wine-200 bg-wine-50 px-2.5 py-1.5 text-[11px] font-semibold text-wine-900 transition hover:bg-wine-100 disabled:opacity-50"
                              >
                                {addingId === String(r.place_id) ? 'Добавляю…' : '+ В маршрут'}
                              </button>
                            )}
                          </div>
                        ) : null}
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
