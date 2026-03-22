import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'

import { PlaceDetailModal } from '../components/PlaceDetailModal'
import { PlaceHoverCard } from '../components/PlaceHoverCard'
import { PlacePhotoImg } from '../components/PlacePhotoImg'
import { RouteMap } from '../components/RouteMap'
import { SequentialAiChatCard } from '../components/SequentialAiChatCard'
import { fetchPlaces } from '../lib/api'
import { primaryPhotoUrl } from '../lib/placePhoto'
import { geocodeSearchQuery } from '../lib/yandexGeocode'
import {
  buildDrivingNavLegs,
  buildDrivingRouteCoordsOrdered,
  yandexMapsDrivingUrl,
  yandexMapsFullRouteUrl,
} from '../lib/yandexNavLink'
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

/** Сообщения по коду GeolocationPositionError (1/2/3). */
function geolocationErrorHint(code) {
  switch (code) {
    case 1:
      return 'Доступ к геолокации запрещён. Разрешите «Местоположение» для этого сайта в настройках браузера (значок замка слева от адреса) или введите адрес ниже.'
    case 2:
      return 'Позицию определить не удалось (часто на ПК без GPS или в эмуляторе). Введите город или адрес вручную.'
    case 3:
      return 'Истекло время ожидания. Проверьте GPS/сеть или введите адрес вручную.'
    default:
      return 'Не удалось определить место. Разрешите доступ к геолокации или введите адрес вручную.'
  }
}

function isSecureContextForGeo() {
  if (typeof window === 'undefined') return true
  if (window.isSecureContext) return true
  const h = window.location.hostname
  return h === 'localhost' || h === '127.0.0.1'
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
    drivingRouteStart,
    setDrivingRouteStart,
    clearDrivingRouteStart,
  } = useTripStore()
  const [allPlaces, setAllPlaces] = useState([])
  const [drivingGeoHint, setDrivingGeoHint] = useState(null)
  const [addressSearch, setAddressSearch] = useState('')
  const [geocodeLoading, setGeocodeLoading] = useState(false)
  const [geocodeError, setGeocodeError] = useState(null)
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

  const pickDrivingGeo = useCallback(() => {
    setDrivingGeoHint(null)
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setDrivingGeoHint('Геолокация недоступна в этом браузере')
      return
    }
    if (!isSecureContextForGeo()) {
      setDrivingGeoHint(
        'Геолокация в браузере доступна только по HTTPS (или на localhost). Откройте сайт по https:// либо введите адрес вручную.',
      )
      return
    }

    const readPosition = (opts) =>
      new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, opts)
      })

    void (async () => {
      const apply = (pos) => {
        setDrivingRouteStart({
          kind: 'point',
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          label: 'Вы здесь',
        })
      }
      let firstFailCode
      try {
        const pos = await readPosition({
          enableHighAccuracy: true,
          timeout: 14000,
          maximumAge: 0,
        })
        apply(pos)
        return
      } catch (e) {
        firstFailCode = e?.code
        /* часто на ПК первая попытка с GPS таймаутит — пробуем грубую сеть/cell */
      }
      try {
        const pos = await readPosition({
          enableHighAccuracy: false,
          timeout: 12000,
          maximumAge: 300000,
        })
        apply(pos)
      } catch (e2) {
        setDrivingGeoHint(geolocationErrorHint(e2?.code ?? firstFailCode))
      }
    })()
  }, [setDrivingRouteStart])

  const submitAddressForDriving = useCallback(async () => {
    setGeocodeError(null)
    setGeocodeLoading(true)
    try {
      const r = await geocodeSearchQuery(addressSearch)
      setDrivingRouteStart({
        kind: 'point',
        latitude: r.latitude,
        longitude: r.longitude,
        label: r.label,
      })
    } catch (e) {
      setGeocodeError(e?.message || 'Не удалось найти адрес')
    } finally {
      setGeocodeLoading(false)
    }
  }, [addressSearch, setDrivingRouteStart])

  const drivingNavLegs = useMemo(
    () => (drivingRouteStart ? buildDrivingNavLegs(drivingRouteStart, places) : []),
    [drivingRouteStart, places],
  )

  const yandexFullRouteHref = useMemo(() => {
    if (!drivingRouteStart) return null
    const coords = buildDrivingRouteCoordsOrdered(drivingRouteStart, places)
    return yandexMapsFullRouteUrl(coords)
  }, [drivingRouteStart, places])

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
                <div className="px-3">
                  <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-stone-500">Добавить</h2>
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
          drivingRouteStart={drivingRouteStart}
          showDrivingSetupHint={places.length >= 1 && !drivingRouteStart}
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

        {places.length >= 1 && (
          <div className="route-levitate shrink-0 rounded-[22px] border border-stone-200/90 bg-white/95 px-3 py-2.5 text-left shadow-sm">
            <p className="text-[11px] font-bold uppercase tracking-wide text-stone-600">Откуда выезжаем</p>
            <p className="mt-1 text-[10px] leading-snug text-stone-600">
              Как в навигаторе: сначала старт (геолокация или адрес), затем линия по дорогам на карте и ссылки в Яндекс.Карты по
              каждому отрезку.
            </p>
            {!drivingRouteStart ? (
              <div className="mt-2 space-y-2">
                <button
                  type="button"
                  onClick={() => void pickDrivingGeo()}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-wine-600 to-wine-800 py-2.5 text-[11px] font-semibold text-white shadow-md transition hover:brightness-110"
                >
                  <span aria-hidden>📍</span>
                  Определить по геолокации
                </button>
                {drivingGeoHint ? (
                  <p className="text-[10px] leading-snug text-red-700">{drivingGeoHint}</p>
                ) : null}
                <form
                  className="space-y-1"
                  onSubmit={(e) => {
                    e.preventDefault()
                    void submitAddressForDriving()
                  }}
                >
                  <span className="block text-[10px] font-semibold text-stone-500">Или введите адрес / город</span>
                  <div className="flex gap-1.5">
                    <input
                      type="search"
                      enterKeyHint="search"
                      value={addressSearch}
                      onChange={(e) => {
                        setAddressSearch(e.target.value)
                        setGeocodeError(null)
                      }}
                      placeholder="Например: Краснодар, ул. Красная, 1"
                      className="min-w-0 flex-1 rounded-xl border border-stone-200 bg-white px-2.5 py-2 text-[11px] text-stone-900 placeholder:text-stone-400"
                      autoComplete="street-address"
                    />
                    <button
                      type="submit"
                      disabled={geocodeLoading || !addressSearch.trim()}
                      className="shrink-0 rounded-xl border border-wine-300 bg-wine-50 px-3 py-2 text-[11px] font-semibold text-wine-900 transition hover:bg-wine-100 disabled:opacity-40"
                    >
                      {geocodeLoading ? '…' : 'Найти'}
                    </button>
                  </div>
                </form>
                {geocodeError ? <p className="text-[10px] leading-snug text-red-700">{geocodeError}</p> : null}
                <div className="flex flex-wrap gap-1.5 border-t border-stone-100 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setDrivingGeoHint(null)
                      setGeocodeError(null)
                      setDrivingRouteStart({ kind: 'stops' })
                    }}
                    className="rounded-full border border-stone-200 bg-stone-50 px-2.5 py-1 text-[10px] font-medium text-stone-700 transition hover:border-wine-300"
                  >
                    Только между остановками
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDrivingGeoHint(null)
                      setGeocodeError(null)
                      setDrivingRouteStart({
                        kind: 'point',
                        latitude: 45.0355,
                        longitude: 38.9753,
                        label: 'Краснодар (центр)',
                      })
                    }}
                    className="rounded-full border border-stone-200 bg-stone-50 px-2.5 py-1 text-[10px] font-medium text-stone-700 transition hover:border-wine-300"
                  >
                    Краснодар (центр)
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-2 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="min-w-0 text-[11px] font-medium text-stone-800">
                    {drivingRouteStart.kind === 'stops'
                      ? 'Линия только между остановками'
                      : drivingRouteStart.label || 'Точка отправления'}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      clearDrivingRouteStart()
                      setDrivingGeoHint(null)
                      setGeocodeError(null)
                      setAddressSearch('')
                    }}
                    className="shrink-0 rounded-lg px-2 py-1 text-[10px] font-semibold text-wine-800 ring-1 ring-wine-200/80 transition hover:bg-wine-50"
                  >
                    Изменить
                  </button>
                </div>
                {drivingNavLegs.length > 0 ? (
                  <div className="border-t border-stone-200 pt-2">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-stone-500">Навигация</p>
                    <p className="mt-0.5 text-[9px] leading-snug text-stone-500">
                      Пошаговый маршрут и голос — в приложении или на сайте Яндекса. Открывайте ссылки в обычной вкладке
                      браузера (не через предпросмотр бота — иначе бывает проверка «не робот»).
                    </p>
                    {yandexFullRouteHref ? (
                      <a
                        href={yandexFullRouteHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-wine-600 to-wine-800 px-3 py-2.5 text-center text-[11px] font-semibold text-white shadow-md transition hover:brightness-110"
                      >
                        Весь маршрут в Яндекс.Картах
                      </a>
                    ) : null}
                    <p className="mt-2 text-[9px] font-semibold uppercase tracking-wide text-stone-400">
                      По отрезкам
                    </p>
                    <ul className="mt-1 max-h-[min(11rem,40dvh)] space-y-1 overflow-y-auto overscroll-contain pr-0.5 text-[10px] [scrollbar-width:thin]">
                      {drivingNavLegs.map((leg, i) => (
                        <li key={`${leg.fromLat}-${leg.fromLon}-${leg.toLat}-${leg.toLon}-${i}`}>
                          <a
                            href={yandexMapsDrivingUrl(leg.fromLat, leg.fromLon, leg.toLat, leg.toLon)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium text-wine-800 underline decoration-wine-300 underline-offset-2 hover:text-wine-950"
                          >
                            {i + 1}. До «{leg.toLabel}»
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        )}

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
            <div className="flex shrink-0 pl-0.5 pr-0.5">
              <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-white [text-shadow:0_1px_4px_rgba(0,0,0,0.55)]">
                Остановки
              </h2>
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
              <div className="px-3">
                <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-stone-500">Добавить</h2>
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
