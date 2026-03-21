import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { PlaceDetailModal } from '../components/PlaceDetailModal'
import { PlaceHoverCard } from '../components/PlaceHoverCard'
import { RouteMap } from '../components/RouteMap'
import { fetchPlaces } from '../lib/api'
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

export function RoutePage() {
  const requestSommelierOpen = useSommelierUiStore((s) => s.requestOpen)
  const { route, places, patching, error, removeStop, addStop } = useTripStore()
  const [allPlaces, setAllPlaces] = useState([])
  const [detailId, setDetailId] = useState(null)
  const [previewPlace, setPreviewPlace] = useState(null)
  const [narrativeOpen, setNarrativeOpen] = useState(false)

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

  const routeIds = useMemo(() => new Set(places.map((p) => p.id)), [places])
  const optionalPlaces = useMemo(
    () => allPlaces.filter((p) => !routeIds.has(p.id)),
    [allPlaces, routeIds],
  )

  if (!route) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#faf7f2] bg-mesh-quiz px-6 py-16">
        <div className="max-w-md rounded-3xl border border-stone-200/80 bg-white/80 p-8 text-center shadow-card">
          <p className="font-display text-lg font-semibold text-wine-950">Маршрут ещё не собран</p>
          <p className="mt-2 text-sm text-stone-600">Ответьте на вопросы — и мы построим карту под вас.</p>
          <Link
            to="/quiz"
            className="btn-primary mt-8 inline-flex px-8 py-3 text-sm"
          >
            К вопросам
          </Link>
        </div>
      </div>
    )
  }

  return (
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
        className="pointer-events-auto absolute left-3 top-3 bottom-3 z-[200] flex w-[min(22rem,calc(100vw-7.5rem))] max-h-[calc(100dvh-1.5rem)] flex-col overflow-hidden rounded-3xl glass-route-panel"
        aria-label="Маршрут и остановки"
      >
        <div className="h-1 shrink-0 bg-bar-warm" aria-hidden />
        <div className="shrink-0 border-b border-stone-200/70 bg-gradient-to-b from-white/50 to-transparent px-4 py-3.5">
          <div className="flex items-center justify-between gap-2">
            <Link
              to="/"
              className="text-xs font-semibold text-stone-500 transition hover:text-wine-800"
            >
              ← Главная
            </Link>
            <div className="flex flex-wrap items-center justify-end gap-1.5">
              <button
                type="button"
                onClick={() => requestSommelierOpen()}
                className="rounded-full bg-gradient-to-r from-wine-600 to-wine-800 px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm ring-1 ring-wine-900/20 transition hover:brightness-110"
                title="Виртуальный сомелье"
              >
                Сомелье
              </button>
              <Link
                to="/quiz"
                className="rounded-full bg-wine-50 px-2.5 py-1 text-[11px] font-semibold text-wine-800 ring-1 ring-wine-200/60 transition hover:bg-wine-100"
              >
                Изменить ответы
              </Link>
            </div>
          </div>
          <h1 className="font-display mt-2.5 text-lg font-semibold tracking-tight text-wine-950">Маршрут</h1>
          {route.weather_snapshot?.temperature_c != null && (
            <p className="mt-1 flex items-center gap-1.5 text-xs text-stone-600">
              <span
                className="inline-block h-1.5 w-1.5 rounded-full shadow-[0_0_8px_rgba(245,158,11,0.7)]"
                style={{
                  backgroundColor:
                    route.weather_snapshot?.route_weather_level === 'excellent'
                      ? '#16a34a'
                      : route.weather_snapshot?.route_weather_level === 'bad'
                        ? '#dc2626'
                        : '#eab308',
                }}
              />
              ~{route.weather_snapshot.temperature_c}°C
              {route.weather_snapshot?.weather_mode ? ` · ${route.weather_snapshot.weather_mode}` : ''}
            </p>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3 pb-6">
          <div className="text-left">
            <p
              className={`text-xs leading-relaxed text-stone-700 ${narrativeOpen ? '' : 'line-clamp-3'}`}
            >
              {route.llm_narrative}
            </p>
            {route.weather_snapshot?.clothing_tips && (
              <p className="mt-2 rounded-xl border border-stone-200/70 bg-white/70 px-3 py-2 text-[11px] text-stone-700">
                👕 {route.weather_snapshot.clothing_tips}
              </p>
            )}
            {Array.isArray(route.weather_snapshot?.indoor_activities) &&
              route.weather_snapshot.indoor_activities.length > 0 && (
                <p className="mt-1.5 text-[11px] text-stone-600">
                  {route.weather_snapshot.indoor_activities.slice(0, 2).join(' · ')}
                </p>
              )}
            {route.llm_narrative && route.llm_narrative.length > 140 && (
              <button
                type="button"
                onClick={() => setNarrativeOpen((v) => !v)}
                className="mt-1.5 text-[11px] font-semibold text-wine-800 hover:underline"
              >
                {narrativeOpen ? 'Свернуть' : 'Показать полностью'}
              </button>
            )}
          </div>

          {route.legs?.length > 0 && (
            <details className="mt-4 rounded-2xl border border-stone-200/60 bg-white/40 px-3 py-2 text-left">
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

          {error && (
            <p className="mt-3 rounded-xl border border-red-200/80 bg-red-50/90 px-3 py-2 text-left text-xs text-red-800">
              {error}
            </p>
          )}

          <section className="mt-5 text-left">
            <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-stone-500">Остановки</h2>
            <ul className="mt-2.5 space-y-2">
              {places.map((p, i) => (
                <li
                  key={p.id}
                  className="flex items-start gap-3 rounded-2xl border border-stone-200/70 bg-white/75 p-2.5 shadow-soft transition hover:border-wine-200/80 hover:shadow-card"
                >
                  <button
                    type="button"
                    onClick={() => setDetailId(p.id)}
                    className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full border-2 border-white shadow-md ring-2 ring-wine-100"
                    title={p.name}
                  >
                    {p.photo_urls?.[0] ? (
                      <img src={p.photo_urls[0]} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-wine-100 to-stone-200 text-lg text-wine-700/60">
                        ◆
                      </div>
                    )}
                  </button>
                  <div className="min-w-0 flex-1">
                    <button
                      type="button"
                      className="text-left text-sm font-semibold text-wine-950 hover:text-wine-800 hover:underline"
                      onClick={() => setDetailId(p.id)}
                    >
                      <span className="mr-1 font-normal text-stone-400">{i + 1}.</span>
                      {p.name}
                    </button>
                    {p.category === 'winery' && p.weather_fit?.icon && (
                      <span className="ml-1 text-[13px]" title={p.weather_fit?.reason || ''}>
                        {WEATHER_ICON[p.weather_fit.icon] || '🌤'}
                      </span>
                    )}
                    {p.category && (
                      <span className="ml-1 align-middle text-[10px] font-medium uppercase tracking-wide text-stone-500">
                        {CATEGORY_LABEL[p.category] || p.category}
                      </span>
                    )}
                    <button
                      type="button"
                      className="mt-2 inline-flex items-center rounded-lg border border-red-200/90 bg-red-50/80 px-2.5 py-1.5 text-xs font-semibold text-red-800 transition hover:border-red-300 hover:bg-red-100 disabled:pointer-events-none disabled:opacity-50"
                      disabled={patching}
                      onClick={() => removeStop(p.id)}
                    >
                      Убрать из маршрута
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          {optionalPlaces.length > 0 && (
            <section className="mt-5 pb-2 text-left">
              <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-stone-500">Добавить</h2>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {optionalPlaces.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    disabled={patching}
                    onClick={() => addStop(p.id)}
                    className="rounded-full border border-stone-200/90 bg-white/95 px-3 py-1.5 text-xs font-semibold text-stone-700 shadow-sm transition hover:border-wine-300 hover:bg-wine-50 hover:text-wine-900 disabled:opacity-40"
                  >
                    + {p.name}
                  </button>
                ))}
              </div>
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
  )
}
