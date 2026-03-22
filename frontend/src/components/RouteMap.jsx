import { useEffect, useLayoutEffect, useRef, useState } from 'react'

import { primaryPhotoUrl } from '../lib/placePhoto'
import { bumpSommelierRootToBodyEnd } from '../lib/sommelierDom'
import { loadYandexMapsApi } from '../lib/yandexMaps'

const HOVER_OPEN_MS = 700

const PLACEHOLDER_SVG = encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120">
    <defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#fce7f0"/><stop offset="100%" style="stop-color:#d6d3d1"/>
    </linearGradient></defs>
    <circle cx="60" cy="60" r="60" fill="url(#g)"/>
    <circle cx="60" cy="60" r="36" fill="none" stroke="#7c2944" stroke-width="2.5" opacity="0.45"/>
    <path fill="#7c2944" opacity="0.5" d="M60 38c-8 0-14 6-14 14 0 10 14 26 14 26s14-16 14-26c0-8-6-14-14-14z"/>
  </svg>`,
)

function photoUrlForPlace(p) {
  const u = primaryPhotoUrl(p)
  if (u) return u
  return `data:image/svg+xml;charset=utf-8,${PLACEHOLDER_SVG}`
}

export const MAP_LEFT_MARGIN_BASE_PX = 392

function mapLeftMarginPx() {
  if (typeof window === 'undefined') return MAP_LEFT_MARGIN_BASE_PX
  const vw = window.innerWidth
  const panel = Math.min(22 * 16, Math.max(200, vw - 120))
  return Math.min(MAP_LEFT_MARGIN_BASE_PX, 12 + panel + 24)
}

const MARKER_PX = 38
const MARKER_RADIUS = 19
const ICON_OFFSET = [-MARKER_RADIUS, -MARKER_RADIUS]
const ICON_SHAPE_CENTER = [MARKER_RADIUS, MARKER_RADIUS]

function dedupeRouteCoords(coords) {
  const out = []
  for (const c of coords) {
    const prev = out[out.length - 1]
    if (!prev || prev[0] !== c[0] || prev[1] !== c[1]) out.push(c)
  }
  return out
}

/**
 * Опорные точки для MultiRoute.
 * drivingRouteStart: null | { kind: 'stops' } | { kind: 'point', latitude, longitude }
 */
function drivingReferencePoints(places, drivingRouteStart) {
  if (!drivingRouteStart || !places.length) return []
  const stopCoords = dedupeRouteCoords(
    places.map((p) => [Number(p.latitude), Number(p.longitude)]),
  )
  if (!stopCoords.length) return []
  if (drivingRouteStart.kind === 'stops') {
    return stopCoords.length >= 2 ? stopCoords : []
  }
  if (drivingRouteStart.kind !== 'point') return []
  const lat = Number(drivingRouteStart.latitude)
  const lon = Number(drivingRouteStart.longitude)
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return []
  const start = [lat, lon]
  const first = stopCoords[0]
  const sameAsFirst =
    first && Math.abs(first[0] - start[0]) < 1e-5 && Math.abs(first[1] - start[1]) < 1e-5
  if (sameAsFirst) return stopCoords.length >= 2 ? stopCoords : []
  return dedupeRouteCoords([start, ...stopCoords])
}

/** Параметры маршрутизатора: только автомобиль по дорогам ОД (не пешеход / не «птичка»). */
function drivingRouteParams() {
  return {
    routingMode: 'auto',
    results: 1,
    reverseGeocoding: true,
    searchCoordOrder: 'latlong',
  }
}

function multiRouteViewOptions(stroke) {
  return {
    routeActiveStrokeWidth: 4,
    routeActiveStrokeColor: stroke,
    routeStrokeWidth: 3,
    routeStrokeColor: stroke,
    wayPointVisible: false,
    viaPointVisible: false,
  }
}

/** Координаты линии активного маршрута (уже по сети дорог). */
function extractMultiRoutePathCoords(multiRoute) {
  try {
    const routes = multiRoute.model.getRoutes()
    if (!routes || routes.getLength() === 0) return null
    const r = routes.get(0)
    const paths = r.getPaths()
    const out = []
    for (let pi = 0; pi < paths.getLength(); pi++) {
      const path = paths.get(pi)
      const segments = path.getSegments()
      for (let si = 0; si < segments.getLength(); si++) {
        const seg = segments.get(si)
        const chunk = seg.getCoordinates()
        if (chunk?.length) out.push(...chunk)
      }
    }
    return out.length ? dedupeRouteCoords(out) : null
  } catch {
    return null
  }
}

function waitMultiRouteResolved(multiRoute, timeoutMs = 28000) {
  return new Promise((resolve) => {
    let settled = false
    const finish = (payload) => {
      if (settled) return
      settled = true
      window.clearTimeout(tid)
      resolve(payload)
    }
    const tid = window.setTimeout(() => finish({ ok: false, reason: 'timeout' }), timeoutMs)
    multiRoute.model.events.add('requestsuccess', () => {
      try {
        const routes = multiRoute.model.getRoutes()
        const ok = Boolean(routes && routes.getLength() > 0)
        finish({ ok, reason: ok ? 'ok' : 'empty' })
      } catch {
        finish({ ok: false, reason: 'error' })
      }
    })
    multiRoute.model.events.add('requestfail', () => finish({ ok: false, reason: 'fail' }))
  })
}

/**
 * Линия только по дорогам: один MultiRoute через все точки, иначе цепочка пар (каждая пара — авто).
 * Прямых «птичьих» линий между остановками нет.
 */
async function buildRoadOnlyRoute(ymaps, map, refPoints, stroke, cancelled) {
  if (refPoints.length < 2) return null
  await requireMultiRouter(ymaps)
  if (cancelled()) return null

  const params = drivingRouteParams()
  const visibleOpts = multiRouteViewOptions(stroke)
  const hiddenOpts = {
    ...visibleOpts,
    routeActiveStrokeOpacity: 0,
    routeStrokeOpacity: 0,
  }

  const fullMr = new ymaps.multiRouter.MultiRoute({ referencePoints: refPoints, params }, visibleOpts)
  map.geoObjects.add(fullMr)
  const fullRes = await waitMultiRouteResolved(fullMr)
  if (cancelled()) {
    try {
      map.geoObjects.remove(fullMr)
    } catch {
      /* ignore */
    }
    return null
  }
  if (fullRes.ok) {
    return { type: 'multi', geoObject: fullMr }
  }
  try {
    map.geoObjects.remove(fullMr)
  } catch {
    /* ignore */
  }

  const merged = []
  for (let i = 0; i < refPoints.length - 1; i++) {
    if (cancelled()) return null
    const segMr = new ymaps.multiRouter.MultiRoute(
      { referencePoints: [refPoints[i], refPoints[i + 1]], params },
      hiddenOpts,
    )
    map.geoObjects.add(segMr)
    const segRes = await waitMultiRouteResolved(segMr)
    if (cancelled()) {
      try {
        map.geoObjects.remove(segMr)
      } catch {
        /* ignore */
      }
      return null
    }
    const pathCoords = segRes.ok ? extractMultiRoutePathCoords(segMr) : null
    try {
      map.geoObjects.remove(segMr)
    } catch {
      /* ignore */
    }
    if (!segRes.ok || !pathCoords?.length) {
      return null
    }
    if (merged.length) {
      const last = merged[merged.length - 1]
      const first = pathCoords[0]
      if (last[0] === first[0] && last[1] === first[1]) pathCoords.shift()
    }
    merged.push(...pathCoords)
  }
  if (merged.length < 2) return null
  const polyline = new ymaps.Polyline(merged, {}, {
    strokeColor: stroke,
    strokeWidth: 3,
    strokeOpacity: 0.9,
  })
  return { type: 'polyline', geoObject: polyline }
}

/** Маршрут по дорогам (Яндекс multiRouter); прямой запасной линии нет. */
function requireMultiRouter(ymaps) {
  return new Promise((resolve, reject) => {
    try {
      if (ymaps.multiRouter?.MultiRoute) {
        resolve()
        return
      }
      ymaps.modules.require(
        ['multiRouter.multiRouter'],
        () => resolve(),
        (err) => reject(err || new Error('multiRouter')),
      )
    } catch (e) {
      reject(e)
    }
  })
}

function fitPlacesBounds(map, places) {
  if (!places.length) return
  try {
    const bounds = map.geoObjects.getBounds()
    if (bounds) {
      map.setBounds(bounds, {
        checkZoomRange: true,
        zoomMargin: [20, 24, 20, mapLeftMarginPx()],
        duration: 200,
      })
    }
  } catch {
    map.setCenter([Number(places[0].latitude), Number(places[0].longitude)], 11)
  }
}

function ensureCirclePhotoLayout(ymaps) {
  if (ymaps.__turizmCirclePhotoLayoutV5) return ymaps.__turizmCirclePhotoLayoutV5
  const Layout = ymaps.templateLayoutFactory.createClass(
    [
      `<div style="width:${MARKER_PX}px;height:${MARKER_PX}px;border-radius:50%;overflow:hidden;`,
      'border:2px solid #fff;box-shadow:0 2px 10px rgba(28,25,23,.25);',
      'background:#d6d3d1 center/cover no-repeat;',
      'background-image:url($[properties.photoUrl]);">',
      '</div>',
    ].join(''),
  )
  ymaps.__turizmCirclePhotoLayoutV5 = Layout
  return Layout
}

function fitMapViewport(map) {
  try {
    map?.container?.fitToViewport?.()
  } catch {
    /* ignore */
  }
}

export function RouteMap({
  places,
  routeColor,
  drivingRouteStart = null,
  showDrivingSetupHint = false,
  onMarkerClick,
  onMarkerHoverPreview,
  onMarkerHoverEnd,
  className = '',
}) {
  const containerRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const clickRef = useRef(onMarkerClick)
  const hoverPreviewRef = useRef(onMarkerHoverPreview)
  const hoverEndRef = useRef(onMarkerHoverEnd)

  useLayoutEffect(() => {
    clickRef.current = onMarkerClick
    hoverPreviewRef.current = onMarkerHoverPreview
    hoverEndRef.current = onMarkerHoverEnd
  })

  const [mapReady, setMapReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    let retryTimer = null
    const el = containerRef.current
    if (!el) return undefined

    const mountMap = (ymaps) => {
        if (cancelled || !containerRef.current) return
        if (mapInstanceRef.current) {
          mapInstanceRef.current.destroy()
          mapInstanceRef.current = null
        }
        const map = new ymaps.Map(containerRef.current, {
          center: [45.0355, 38.9753],
          zoom: 9,
          type: 'yandex#hybrid',
          controls: [],
        })
        map.controls.add('zoomControl', { position: { right: 16, top: 88 } })
        map.controls.add('fullscreenControl', { position: { right: 16, top: 16 } })
        map.controls.add('geolocationControl', { position: { right: 16, top: 152 } })
        mapInstanceRef.current = map
        setMapReady(true)
        bumpSommelierRootToBodyEnd()
        requestAnimationFrame(() => {
          bumpSommelierRootToBodyEnd()
          if (!cancelled) fitMapViewport(map)
        })
        setTimeout(() => {
          bumpSommelierRootToBodyEnd()
          if (!cancelled) fitMapViewport(map)
        }, 100)
        setTimeout(() => {
          if (!cancelled) bumpSommelierRootToBodyEnd()
        }, 500)
    }

    loadYandexMapsApi()
      .then(mountMap)
      .catch(() => {
        retryTimer = window.setTimeout(() => {
          loadYandexMapsApi()
            .then(mountMap)
            .catch((e) => {
              if (!cancelled) {
                const msg = e?.message || 'Карта не загрузилась'
                console.error('[RouteMap] Yandex Maps API не загрузилась:', msg, e)
              }
            })
        }, 900)
      })

    return () => {
      cancelled = true
      if (retryTimer != null) window.clearTimeout(retryTimer)
      setMapReady(false)
      if (mapInstanceRef.current) {
        mapInstanceRef.current.destroy()
        mapInstanceRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    const map = mapInstanceRef.current
    if (!mapReady || !map || !window.ymaps) return undefined

    const ymaps = window.ymaps
    let cancelled = false

    const run = async () => {
      try {
        const CircleLayout = ensureCirclePhotoLayout(ymaps)
        map.geoObjects.removeAll()

        const stroke = routeColor || '#7c2944'
        let routeGeo = null
        const refPoints = drivingReferencePoints(places, drivingRouteStart)
        if (refPoints.length >= 2) {
          try {
            const built = await buildRoadOnlyRoute(ymaps, map, refPoints, stroke, () => cancelled)
            if (cancelled) return
            routeGeo = built
            if (!built) {
              const detail = [
                'Не удалось построить маршрут по дорогам.',
                '',
                'Чаще всего:',
                '1) Ключ не попал в сборку: в .env задайте VITE_YANDEX_MAPS_API_KEY и пересоберите web (docker compose build web --no-cache).',
                '2) В кабинете developer.tech.yandex.ru для ключа добавьте HTTP Referrer для текущего origin (например http://100.78.89.35:8080/*) и localhost.',
                '3) У ключа должен быть подключён сервис «JavaScript API и HTTP Геокодер».',
              ].join('\n')
              const keySet = Boolean(String(import.meta.env.VITE_YANDEX_MAPS_API_KEY || '').trim())
              console.warn('[RouteMap]', detail, {
                origin: typeof window !== 'undefined' ? window.location?.origin : null,
                viteKeyPresent: keySet,
              })
            } else if (built.type === 'multi') {
              built.geoObject.model.events.add('requestsuccess', () => {
                if (cancelled) return
                fitPlacesBounds(map, places)
                requestAnimationFrame(() => fitMapViewport(map))
              })
            }
            if (built?.type === 'polyline' && built.geoObject) {
              map.geoObjects.add(built.geoObject)
            }
          } catch (e) {
            if (!cancelled) console.warn('[RouteMap] Маршрутизация по дорогам недоступна.', e)
          }
        }

        if (
          drivingRouteStart?.kind === 'point' &&
          Number.isFinite(Number(drivingRouteStart.latitude)) &&
          Number.isFinite(Number(drivingRouteStart.longitude))
        ) {
          const slat = Number(drivingRouteStart.latitude)
          const slon = Number(drivingRouteStart.longitude)
          const cap =
            typeof drivingRouteStart.label === 'string' && drivingRouteStart.label.trim()
              ? drivingRouteStart.label.trim()
              : 'Старт'
          const startPm = new ymaps.Placemark(
            [slat, slon],
            { iconCaption: cap },
            {
              preset: 'islands#greenCircleIcon',
              iconColor: '#166534',
            },
          )
          startPm.events.add('click', () => {
            hoverEndRef.current?.()
          })
          map.geoObjects.add(startPm)
        }

        places.forEach((p) => {
          let hoverTimer = null
          const clearHoverTimer = () => {
            if (hoverTimer != null) {
              window.clearTimeout(hoverTimer)
              hoverTimer = null
            }
          }
          const openFullscreen = () => {
            hoverEndRef.current?.()
            clickRef.current?.(p.id)
          }
          const openHoverPreview = () => {
            hoverPreviewRef.current?.(p)
          }

          const placemark = new ymaps.Placemark(
            [Number(p.latitude), Number(p.longitude)],
            {
              photoUrl: photoUrlForPlace(p),
            },
            {
              iconLayout: CircleLayout,
              iconShape: {
                type: 'Circle',
                coordinates: ICON_SHAPE_CENTER,
                radius: MARKER_RADIUS,
              },
              iconOffset: ICON_OFFSET,
              openHintOnHover: false,
              openBalloonOnClick: false,
            },
          )
          placemark.events.add('mouseenter', () => {
            clearHoverTimer()
            if (!hoverPreviewRef.current) return
            hoverTimer = window.setTimeout(() => {
              hoverTimer = null
              openHoverPreview()
            }, HOVER_OPEN_MS)
          })
          placemark.events.add('mouseleave', () => {
            clearHoverTimer()
            hoverEndRef.current?.()
          })
          placemark.events.add('click', () => {
            clearHoverTimer()
            openFullscreen()
          })
          map.geoObjects.add(placemark)
        })

        if (!routeGeo) {
          fitPlacesBounds(map, places)
          requestAnimationFrame(() => fitMapViewport(map))
        } else if (routeGeo.type === 'polyline') {
          fitPlacesBounds(map, places)
          requestAnimationFrame(() => fitMapViewport(map))
        } else {
          window.setTimeout(() => {
            if (cancelled) return
            fitPlacesBounds(map, places)
            requestAnimationFrame(() => fitMapViewport(map))
          }, 1200)
        }
      } catch (e) {
        console.error('RouteMap geoObjects:', e)
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [places, mapReady, routeColor, drivingRouteStart])

  useEffect(() => {
    const map = mapInstanceRef.current
    const el = containerRef.current
    if (!mapReady || !map || !el || typeof ResizeObserver === 'undefined') return undefined
    const ro = new ResizeObserver(() => fitMapViewport(map))
    ro.observe(el)
    return () => ro.disconnect()
  }, [mapReady])

  return (
    <div className={`relative z-0 min-h-0 ${className}`.trim()}>
      {showDrivingSetupHint && (
        <div className="pointer-events-none absolute bottom-3 left-1/2 z-[5] max-w-[min(92vw,22rem)] -translate-x-1/2 rounded-xl border border-sky-200/90 bg-sky-50/95 px-3 py-2 text-center text-[11px] font-medium text-sky-950 shadow-sm">
          Сначала в панели слева укажите отправление — затем появится маршрут по дорогам.
        </div>
      )}
      <div
        ref={containerRef}
        className="ymap-route-container h-full w-full min-h-[280px]"
        style={{ width: '100%', height: '100%', minHeight: '280px' }}
      />
    </div>
  )
}
