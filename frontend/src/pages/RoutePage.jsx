import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'

import { PlaceDetailModal } from '../components/PlaceDetailModal'
import { PlaceHoverCard } from '../components/PlaceHoverCard'
import { PlacePhotoImg } from '../components/PlacePhotoImg'
import { RouteMap } from '../components/RouteMap'
import { SequentialAiChatCard } from '../components/SequentialAiChatCard'
import { fetchPlaces } from '../lib/api'
import { primaryPhotoUrl } from '../lib/placePhoto'
import { ROUTE_ENTRY_SEQUENTIAL_AI } from '../lib/routeEntry'
import { hasSequentialAiTourSession } from '../lib/sequentialAiSession'
import { useSommelierUiStore } from '../store/sommelierUiStore'
import { useTripStore } from '../store/tripStore'

function legsSummary(legs) {
  if (!legs?.length) return null
  const kms = legs.map((l) => Number(l.distance_km) || 0)
  const sum = Math.round(kms.reduce((a, b) => a + b, 0))
  const max = Math.max(...kms)
  return `${legs.length} переезд(ов), суммарно ~${sum} км, до ~${max} км за раз`
}

const CATEGORY_LABEL = {
  winery: 'Винодельня',
  lodging: 'Жильё',
  food: 'Питание',
  transfer: 'Трансфер',
}

const WEATHER_ICON = {
  rain: '🌧',
  sun: '☀️',
  wind: '💨',
}

/** Видно ~столько чипов без прокрутки; дальше — вертикальная карусель как у «Остановки» */
const ADD_CHIPS_VISIBLE = 3
/** От этого числа мест включается вертикальный скролл */
const ADD_CHIPS_SCROLL_MIN = ADD_CHIPS_VISIBLE + 1

/** Как в макете: белая метка на красном круге */
function RoutePinInCircle({ className = '' }) {
  return (
    <span
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#B12030] shadow-md ring-[3px] ring-white ${className}`}
      aria-hidden
    >
      <svg className="h-[22px] w-[22px] text-white" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 6.5 12 6.5s2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
      </svg>
    </span>
  )
}

function ChevronDownIcon({ open, className = 'h-5 w-5 shrink-0 text-stone-500 transition-transform' }) {
  return (
    <svg
      className={`${className} ${open ? 'rotate-180' : ''}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function RoutePage() {
  const location = useLocation()
  const navigate = useNavigate()
  const requestSommelierOpen = useSommelierUiStore((s) => s.requestOpen)
  const {
    route,
    places,
    patching,
    error,
    removeStop,
    addStop,
    startRouteWithPlace,
    loading,
    clearRouteSession,
    clearSequentialAiChat,
    sequentialAiMode,
    sequentialAiChatActive,
  } = useTripStore()
  const [allPlaces, setAllPlaces] = useState([])
  const [detailId, setDetailId] = useState(null)
  const [previewPlace, setPreviewPlace] = useState(null)
  const [aboutRouteOpen, setAboutRouteOpen] = useState(false)
  const [expandedStopId, setExpandedStopId] = useState(null)
  const [coarsePointer, setCoarsePointer] = useState(false)
  const stopsScrollRef = useRef(null)
  const addChipsScrollRef = useRef(null)

  /** Колёсико крутит список остановок, а не всю панель / карту */
  const handleStopsWheel = useCallback((e) => {
    const el = stopsScrollRef.current
    if (!el) return
    const { scrollTop, scrollHeight, clientHeight } = el
    const dy = e.deltaY
    const atTop = scrollTop <= 0
    const atBottom = scrollTop + clientHeight >= scrollHeight - 2
    if ((dy < 0 && !atTop) || (dy > 0 && !atBottom)) {
      e.stopPropagation()
    }
  }, [])

  /** Колёсико крутит список «Добавить», а не карту / панель (как у остановок) */
  const handleAddChipsWheel = useCallback((e) => {
    const el = addChipsScrollRef.current
    if (!el) return
    const { scrollTop, scrollHeight, clientHeight } = el
    const dy = e.deltaY
    const atTop = scrollTop <= 0
    const atBottom = scrollTop + clientHeight >= scrollHeight - 2
    if ((dy < 0 && !atTop) || (dy > 0 && !atBottom)) {
      e.stopPropagation()
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    const mq = window.matchMedia('(hover: none), (pointer: coarse)')
    const apply = () => setCoarsePointer(mq.matches)
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])

  useEffect(() => {
    let c = false
    ;(async () => {
      try {
        const data = await fetchPlaces()
        if (!c) setAllPlaces(data)
      } catch {
        /* ignore */
      }
    })()
    return () => {
      c = true
    }
  }, [])

  /** С главной «Последовательный тур с AI»: пустые остановки, все места в «Добавить» */
  useEffect(() => {
    if (location.state?.routeEntry !== ROUTE_ENTRY_SEQUENTIAL_AI) return
    clearRouteSession()
    navigate(`${location.pathname}${location.search}`, { replace: true, state: {} })
  }, [location.state, location.pathname, location.search, navigate, clearRouteSession])

  /** После F5 на /route: карточка AI-Чат, если тур начат с «Последовательный тур с AI» */
  useEffect(() => {
    if (!hasSequentialAiTourSession()) return
    useTripStore.setState({ sequentialAiChatActive: true })
  }, [])

  const routeIds = useMemo(() => new Set(places.map((p) => p.id)), [places])
  const optionalPlaces = useMemo(
    () => allPlaces.filter((p) => !routeIds.has(p.id)),
    [allPlaces, routeIds],
  )

  const weather = route?.weather_snapshot

  /** Последовательный AI: без карточки-заглушки в «Остановках», только пустой список до первого добавления */
  const showSequentialEmptyStops =
    sequentialAiMode || location.state?.routeEntry === ROUTE_ENTRY_SEQUENTIAL_AI

  const sequentialAiChat =
    sequentialAiChatActive ? (
      <SequentialAiChatCard />
    ) : null

  if (!route) {
    return (
      <>
        {sequentialAiChat}
        <div className="fixed inset-0 z-[5] flex flex-col bg-gradient-to-b from-stone-950 via-stone-900 to-stone-950">
        <div className="relative z-0 min-h-0 flex-1" style={{ minHeight: '40vh' }}>
          <RouteMap
            places={[]}
            onMarkerHoverPreview={setPreviewPlace}
            onMarkerHoverEnd={() => setPreviewPlace(null)}
            onMarkerClick={(id) => {
              setPreviewPlace(null)
              setDetailId(id)
            }}
            className="absolute inset-0 h-full min-h-[40vh] w-full"
          />
        </div>
        <aside
          className="pointer-events-auto absolute left-3 top-3 bottom-3 z-[200] flex min-h-0 w-[min(22rem,calc(100vw-7.5rem))] flex-col gap-3 overflow-hidden overscroll-contain bg-transparent p-0 shadow-none"
          aria-label="Маршрут и добавление мест"
        >
          <div className="route-levitate shrink-0 px-3 py-2.5">
            <div className="flex items-center justify-between gap-2">
              <Link
                to="/"
                className="text-xs font-semibold text-stone-600 transition hover:text-wine-800"
              >
                ← Главная
              </Link>
              <div className="flex flex-wrap items-center justify-end gap-1.5">
                <button
                  type="button"
                  onClick={() => requestSommelierOpen()}
                  className="rounded-full bg-gradient-to-r from-wine-600 to-wine-800 px-2.5 py-1 text-[11px] font-semibold text-white shadow-md ring-1 ring-wine-900/15 transition hover:brightness-110"
                  title="Виртуальный сомелье"
                >
                  Сомелье
                </button>
                <Link
                  to="/quiz"
                  onClick={() => clearSequentialAiChat()}
                  className="rounded-full bg-wine-50 px-2.5 py-1 text-[11px] font-semibold text-wine-800 ring-1 ring-wine-200/60 transition hover:bg-wine-100"
                >
                  Изменить ответы
                </Link>
              </div>
            </div>
          </div>

          <div className="route-levitate shrink-0 overflow-hidden rounded-[22px]">
            <button
              type="button"
              onClick={() => setAboutRouteOpen((v) => !v)}
              className="flex w-full items-center gap-3 px-3 py-3 text-left transition hover:bg-stone-50/90"
              aria-expanded={aboutRouteOpen}
              aria-controls="route-about-panel-empty"
            >
              <RoutePinInCircle />
              <span className="min-w-0 flex-1 font-['Montserrat'] text-[15px] font-bold tracking-tight text-black">
                О маршруте
              </span>
              <ChevronDownIcon open={aboutRouteOpen} className="h-5 w-5 shrink-0 text-stone-400 transition-transform" />
            </button>

            {aboutRouteOpen && (
              <div
                id="route-about-panel-empty"
                className="max-h-[min(52dvh,340px)] overflow-y-auto overscroll-contain border-t border-stone-100 bg-white px-3 pb-3 pt-2.5 text-left"
              >
                <p className="text-xs leading-relaxed text-stone-800">
                  Выберите место в блоке «Добавить» ниже — маршрут начнётся без предварительной генерации по опросу.
                </p>
                <div className="mt-2 rounded-xl border border-stone-100 bg-stone-50/80 px-2.5 py-2 text-[11px] leading-relaxed text-stone-700">
                  👕 Погода и рекомендации по одежде появятся после добавления первой остановки.
                </div>
                <p className="mt-3 text-xs text-stone-500">
                  Текст маршрута и переезды отобразятся здесь после построения.
                </p>
              </div>
            )}
          </div>

          {error && (
            <div className="route-levitate shrink-0 border border-red-100 bg-red-50/95 px-3 py-2 text-left text-xs text-red-800">
              {error}
            </div>
          )}

          <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
            <section className="flex min-h-0 flex-1 flex-col gap-2 text-left">
              <div className="flex shrink-0 flex-wrap items-end justify-between gap-1 pl-0.5 pr-0.5">
                <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-white [text-shadow:0_1px_4px_rgba(0,0,0,0.55)]">
                  Остановки
                </h2>
              </div>
              <div
                ref={stopsScrollRef}
                onWheel={handleStopsWheel}
                className="route-stops-scroll min-h-0 w-full flex-1 overflow-y-auto overscroll-contain pr-0.5 [scrollbar-width:thin]"
                aria-label={
                  showSequentialEmptyStops ? 'Остановок нет — выберите место в разделе «Добавить»' : undefined
                }
              >
                {!showSequentialEmptyStops && (
                  <div className="route-levitate px-3 py-3 text-xs text-stone-600">
                    В маршруте пока нет остановок.
                  </div>
                )}
              </div>
            </section>

            {(optionalPlaces.length > 0 || showSequentialEmptyStops) && (
              <section className="route-levitate shrink-0 pb-3 pt-2 text-left">
                <div className="flex flex-wrap items-end justify-between gap-1 px-3">
                  <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-stone-500">Добавить</h2>
                  {optionalPlaces.length >= ADD_CHIPS_SCROLL_MIN && (
                    <span className="text-[9px] font-medium text-stone-400">Колёсико мыши — прокрутка</span>
                  )}
                </div>
                {optionalPlaces.length >= ADD_CHIPS_SCROLL_MIN ? (
                  <div
                    ref={addChipsScrollRef}
                    onWheel={handleAddChipsWheel}
                    className="route-stops-scroll mx-3 mt-2 max-h-[min(9rem,36dvh)] overflow-y-auto overscroll-contain pr-0.5 [scrollbar-width:thin]"
                  >
                    <ul className="flex flex-col gap-1.5 pb-0.5">
                      {optionalPlaces.map((p) => (
                        <li key={p.id}>
                          <button
                            type="button"
                            disabled={patching || loading}
                            onClick={() => startRouteWithPlace(p.id)}
                            className="route-stop-snap flex w-full min-w-0 snap-start items-center rounded-full border border-stone-200/90 bg-white px-3 py-1.5 text-left text-xs font-semibold text-stone-700 shadow-sm transition hover:border-wine-300 hover:bg-wine-50 hover:text-wine-900 disabled:opacity-40"
                          >
                            <span className="min-w-0 truncate">+ {p.name}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <div className="mt-2 flex flex-wrap gap-1.5 px-3">
                    {optionalPlaces.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        disabled={patching || loading}
                        onClick={() => startRouteWithPlace(p.id)}
                        className="rounded-full border border-stone-200/90 bg-white px-3 py-1.5 text-xs font-semibold text-stone-700 shadow-sm transition hover:border-wine-300 hover:bg-wine-50 hover:text-wine-900 disabled:opacity-40"
                      >
                        + {p.name}
                      </button>
                    ))}
                    {optionalPlaces.length === 0 && showSequentialEmptyStops && (
                      <p className="w-full py-2 text-xs text-stone-500">Загрузка мест…</p>
                    )}
                  </div>
                )}
              </section>
            )}
          </div>
        </aside>
      </div>
      </>
    )
  }

  return (
    <>
      {sequentialAiChat}
      <div className="fixed inset-0 z-[5] flex flex-col bg-gradient-to-b from-stone-950 via-stone-900 to-stone-950">
      <div className="relative z-0 min-h-0 flex-1" style={{ minHeight: '40vh' }}>
        <RouteMap
          places={places}
          routeColor={route.weather_snapshot?.route_color}
          onMarkerHoverPreview={setPreviewPlace}
          onMarkerHoverEnd={() => setPreviewPlace(null)}
          onMarkerClick={(id) => {
            setPreviewPlace(null)
            setDetailId(id)
          }}
          className="absolute inset-0 h-full min-h-[40vh] w-full"
        />
        {previewPlace && !detailId && <PlaceHoverCard place={previewPlace} />}
      </div>

      <aside
        className="pointer-events-auto absolute left-3 top-3 bottom-3 z-[200] flex min-h-0 w-[min(22rem,calc(100vw-7.5rem))] flex-col gap-3 overflow-hidden overscroll-contain bg-transparent p-0 shadow-none"
        aria-label="Маршрут и остановки"
      >
        <div className="route-levitate shrink-0 px-3 py-2.5">
          <div className="flex items-center justify-between gap-2">
            <Link
              to="/"
              className="text-xs font-semibold text-stone-600 transition hover:text-wine-800"
            >
              ← Главная
            </Link>
            <div className="flex flex-wrap items-center justify-end gap-1.5">
              <button
                type="button"
                onClick={() => requestSommelierOpen()}
                className="rounded-full bg-gradient-to-r from-wine-600 to-wine-800 px-2.5 py-1 text-[11px] font-semibold text-white shadow-md ring-1 ring-wine-900/15 transition hover:brightness-110"
                title="Виртуальный сомелье"
              >
                Сомелье
              </button>
              <Link
                to="/quiz"
                onClick={() => clearSequentialAiChat()}
                className="rounded-full bg-wine-50 px-2.5 py-1 text-[11px] font-semibold text-wine-800 ring-1 ring-wine-200/60 transition hover:bg-wine-100"
              >
                Изменить ответы
              </Link>
            </div>
          </div>
        </div>

        <div className="route-levitate shrink-0 overflow-hidden rounded-[22px]">
          <button
            type="button"
            onClick={() => setAboutRouteOpen((v) => !v)}
            className="flex w-full items-center gap-3 px-3 py-3 text-left transition hover:bg-stone-50/90"
            aria-expanded={aboutRouteOpen}
            aria-controls="route-about-panel"
          >
            <RoutePinInCircle />
            <span className="min-w-0 flex-1 font-['Montserrat'] text-[15px] font-bold tracking-tight text-black">
              О маршруте
            </span>
            <ChevronDownIcon open={aboutRouteOpen} className="h-5 w-5 shrink-0 text-stone-400 transition-transform" />
          </button>

          {aboutRouteOpen && (
            <div
              id="route-about-panel"
              className="max-h-[min(52dvh,340px)] overflow-y-auto overscroll-contain border-t border-stone-100 bg-white px-3 pb-3 pt-2.5 text-left"
            >
              {weather?.temperature_c != null && (
                <div className="flex items-start gap-2 border-b border-stone-100 pb-2">
                  <span
                    className="mt-0.5 inline-block h-2 w-2 shrink-0 rounded-full shadow-[0_0_8px_rgba(245,158,11,0.7)]"
                    style={{
                      backgroundColor:
                        weather?.route_weather_level === 'excellent'
                          ? '#16a34a'
                          : weather?.route_weather_level === 'bad'
                            ? '#dc2626'
                            : '#eab308',
                    }}
                  />
                  <div>
                    <p className="text-sm font-semibold text-wine-950">
                      ~{weather.temperature_c}°C
                      {weather?.weather_mode ? ` · ${weather.weather_mode}` : ''}
                    </p>
                    {weather?.clothing_tips && (
                      <p className="mt-1.5 text-xs leading-relaxed text-stone-700">
                        👕 {weather.clothing_tips}
                      </p>
                    )}
                    {Array.isArray(weather?.indoor_activities) && weather.indoor_activities.length > 0 && (
                      <p className="mt-1.5 text-xs text-stone-600">
                        {weather.indoor_activities.join(' · ')}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {route.llm_narrative && (
                <div className={weather?.temperature_c != null ? 'mt-2 pt-2' : ''}>
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-stone-500">Рекомендации</p>
                  <p className="mt-1 text-xs leading-relaxed text-stone-800">{route.llm_narrative}</p>
                </div>
              )}

              {route.legs?.length > 0 && (
                <details className="mt-3 rounded-xl border border-stone-100 bg-stone-50/80 px-2.5 py-2">
                  <summary className="cursor-pointer text-[11px] font-semibold text-stone-600 hover:text-wine-900">
                    {legsSummary(route.legs)}
                  </summary>
                  <ul className="mt-2 space-y-1 border-t border-stone-200/50 pt-2 text-[11px] text-stone-600">
                    {route.legs.map((leg, idx) => (
                      <li key={`${leg.from_id}-${leg.to_id}-${idx}`}>
                        <span className="text-stone-400">{idx + 1}.</span> {leg.distance_km} км —{' '}
                        <span className="text-stone-500">
                          {leg.from_name} → {leg.to_name}
                        </span>
                      </li>
                    ))}
                  </ul>
                </details>
              )}

              {!weather?.temperature_c && !route.llm_narrative && (!route.legs || route.legs.length === 0) && (
                <p className="text-xs text-stone-500">Данные о погоде и текст маршрута появятся после построения.</p>
              )}
            </div>
          )}
        </div>

        {error && (
          <div className="route-levitate shrink-0 border border-red-100 bg-red-50/95 px-3 py-2 text-left text-xs text-red-800">
            {error}
          </div>
        )}

        {/* Остановки заполняют высоту до блока «Добавить»; прокрутка колёсиком только внутри списка */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
          <section className="flex min-h-0 flex-1 flex-col gap-2 text-left">
            <div className="flex shrink-0 flex-wrap items-end justify-between gap-1 pl-0.5 pr-0.5">
              <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-white [text-shadow:0_1px_4px_rgba(0,0,0,0.55)]">
                Остановки
              </h2>
              {places.length > 2 && (
                <span className="text-[9px] font-medium text-white/90 [text-shadow:0_1px_3px_rgba(0,0,0,0.6)]">
                  Колёсико мыши — прокрутка
                </span>
              )}
            </div>
            <div
              ref={stopsScrollRef}
              onWheel={handleStopsWheel}
              className="route-stops-scroll min-h-0 w-full flex-1 overflow-y-auto overscroll-contain pr-0.5 [scrollbar-width:thin]"
            >
            <ul className="flex flex-col gap-3 pb-1">
              {places.map((p, i) => {
                const expanded = expandedStopId === p.id
                const photo = primaryPhotoUrl(p)

                return (
                  <li
                    key={p.id}
                    className="route-levitate route-stop-snap overflow-hidden transition-[box-shadow,transform] duration-200 hover:scale-[1.01] hover:shadow-xl"
                    onMouseEnter={() => {
                      if (!coarsePointer) setExpandedStopId(p.id)
                    }}
                    onMouseLeave={() => {
                      if (!coarsePointer) setExpandedStopId(null)
                    }}
                    onClick={() => {
                      if (coarsePointer) {
                        setExpandedStopId((prev) => (prev === p.id ? null : p.id))
                      }
                    }}
                  >
                    {expanded ? (
                      <div className="animate-fade-in">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setDetailId(p.id)
                          }}
                          className="relative block h-40 w-full overflow-hidden border-b-4 border-[#B12030] bg-stone-200"
                          title="Подробнее о месте"
                        >
                          <PlacePhotoImg
                            src={photo}
                            className="h-full w-full object-cover"
                            placeholderClassName="flex h-full w-full items-center justify-center bg-gradient-to-br from-wine-100 to-stone-200 text-4xl text-wine-700/50"
                          />
                        </button>
                        <div className="space-y-2 p-3" onClick={(e) => e.stopPropagation()}>
                          <p className="font-['Montserrat'] text-sm font-bold leading-snug text-black">
                            <span className="mr-1 font-normal text-stone-400">{i + 1}.</span>
                            {p.name}
                          </p>
                          {p.category === 'winery' && p.weather_fit?.icon && (
                            <span className="text-sm" title={p.weather_fit?.reason || ''}>
                              {WEATHER_ICON[p.weather_fit.icon] || '🌤'}
                            </span>
                          )}
                          {p.category && (
                            <p className="text-[10px] font-medium uppercase tracking-wide text-stone-500">
                              {CATEGORY_LABEL[p.category] || p.category}
                            </p>
                          )}
                          <button
                            type="button"
                            className="w-full rounded-full border-2 border-[#B12030] bg-white py-2.5 text-center text-xs font-bold text-[#B12030] shadow-sm transition hover:bg-[#B12030]/5 disabled:opacity-50"
                            disabled={patching}
                            onClick={(e) => {
                              e.stopPropagation()
                              removeStop(p.id)
                            }}
                          >
                            Убрать из маршрута
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 p-2.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setDetailId(p.id)
                          }}
                          className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full border-[3px] border-[#B12030] shadow-md ring-2 ring-white"
                          title={p.name}
                        >
                          <PlacePhotoImg
                            src={photo}
                            className="h-full w-full object-cover"
                            placeholderClassName="flex h-full w-full items-center justify-center bg-gradient-to-br from-wine-100 to-stone-200 text-lg text-wine-700/60"
                          />
                        </button>
                        <div className="min-w-0 flex-1 text-left">
                          <p className="font-['Montserrat'] text-sm font-bold leading-snug text-black">
                            <span className="mr-1 font-normal text-stone-400">{i + 1}.</span>
                            {p.name}
                          </p>
                          {p.category === 'winery' && p.weather_fit?.icon && (
                            <span className="text-[13px]" title={p.weather_fit?.reason || ''}>
                              {WEATHER_ICON[p.weather_fit.icon] || '🌤'}
                            </span>
                          )}
                          {coarsePointer && (
                            <p className="mt-0.5 text-[10px] text-stone-500">Нажмите карточку, чтобы развернуть</p>
                          )}
                        </div>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
            {places.length === 0 && (
              <div className="route-levitate px-3 py-3 text-xs text-stone-600">В маршруте пока нет остановок.</div>
            )}
          </div>
          </section>

          {optionalPlaces.length > 0 && (
            <section className="route-levitate shrink-0 pb-3 pt-2 text-left">
              <div className="flex flex-wrap items-end justify-between gap-1 px-3">
                <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-stone-500">Добавить</h2>
                {optionalPlaces.length >= ADD_CHIPS_SCROLL_MIN && (
                  <span className="text-[9px] font-medium text-stone-400">Колёсико мыши — прокрутка</span>
                )}
              </div>
              {optionalPlaces.length >= ADD_CHIPS_SCROLL_MIN ? (
                <div
                  ref={addChipsScrollRef}
                  onWheel={handleAddChipsWheel}
                  className="route-stops-scroll mx-3 mt-2 max-h-[min(9rem,36dvh)] overflow-y-auto overscroll-contain pr-0.5 [scrollbar-width:thin]"
                >
                  <ul className="flex flex-col gap-1.5 pb-0.5">
                    {optionalPlaces.map((p) => (
                      <li key={p.id}>
                        <button
                          type="button"
                          disabled={patching}
                          onClick={() => addStop(p.id)}
                          className="route-stop-snap flex w-full min-w-0 snap-start items-center rounded-full border border-stone-200/90 bg-white px-3 py-1.5 text-left text-xs font-semibold text-stone-700 shadow-sm transition hover:border-wine-300 hover:bg-wine-50 hover:text-wine-900 disabled:opacity-40"
                        >
                          <span className="min-w-0 truncate">+ {p.name}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="mt-2 flex flex-wrap gap-1.5 px-3">
                  {optionalPlaces.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      disabled={patching}
                      onClick={() => addStop(p.id)}
                      className="rounded-full border border-stone-200/90 bg-white px-3 py-1.5 text-xs font-semibold text-stone-700 shadow-sm transition hover:border-wine-300 hover:bg-wine-50 hover:text-wine-900 disabled:opacity-40"
                    >
                      + {p.name}
                    </button>
                  ))}
                </div>
              )}
            </section>
          )}
        </div>
      </aside>

      {detailId && (
        <PlaceDetailModal
          placeId={detailId}
          onClose={() => setDetailId(null)}
          inRoute={places.some((p) => String(p.id) === String(detailId))}
          patching={patching}
          onRemoveFromRoute={async () => {
            try {
              await removeStop(detailId)
              setDetailId(null)
            } catch {
              /* ошибка уже в store.error */
            }
          }}
        />
      )}
    </div>
    </>
  )
}
