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

/** Простая полилиния по точкам — запасной вариант, если multiRouter недоступен или маршрут не построился. */
function createRoutePolyline(ymaps, places, routeColor) {
  const coords = dedupeRouteCoords(places.map((p) => [Number(p.latitude), Number(p.longitude)]))
  if (coords.length < 2) return null
  return new ymaps.Polyline(
    coords,
    {},
    {
      strokeColor: routeColor || '#7c2944',
      strokeWidth: 3,
      strokeOpacity: 0.9,
    },
  )
}

/** Маршрут по дорогам (Яндекс multiRouter); при ошибке — полилиния по прямой. */
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

export function RouteMap({ places, routeColor, onMarkerClick, onMarkerHoverPreview, onMarkerHoverEnd, className = '' }) {
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

  const [error, setError] = useState(null)
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
        setError(null)
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
              if (!cancelled) setError(e?.message || 'Карта не загрузилась')
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
        let multiRoute = null
        if (places.length >= 2) {
          try {
            await requireMultiRouter(ymaps)
            if (cancelled) return
            const refPoints = dedupeRouteCoords(
              places.map((p) => [Number(p.latitude), Number(p.longitude)]),
            )
            multiRoute = new ymaps.multiRouter.MultiRoute(
              {
                referencePoints: refPoints,
                params: { routingMode: 'auto', results: 1 },
              },
              {
                routeActiveStrokeWidth: 4,
                routeActiveStrokeColor: stroke,
                routeStrokeWidth: 3,
                routeStrokeColor: stroke,
                wayPointVisible: false,
                viaPointVisible: false,
              },
            )
            multiRoute.model.events.add('requestsuccess', () => {
              if (cancelled) return
              fitPlacesBounds(map, places)
              requestAnimationFrame(() => fitMapViewport(map))
            })
            multiRoute.model.events.add('requestfail', () => {
              if (cancelled) return
              try {
                map.geoObjects.remove(multiRoute)
              } catch {
                /* ignore */
              }
              const line = createRoutePolyline(ymaps, places, routeColor)
              if (line) map.geoObjects.add(line)
              fitPlacesBounds(map, places)
              requestAnimationFrame(() => fitMapViewport(map))
            })
            map.geoObjects.add(multiRoute)
          } catch {
            const routeLine = createRoutePolyline(ymaps, places, routeColor)
            if (routeLine) map.geoObjects.add(routeLine)
          }
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

        if (!multiRoute) {
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
  }, [places, mapReady, routeColor])

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
      {error && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#faf7f2]/95 px-4 text-center backdrop-blur-sm">
          <div className="max-w-sm rounded-2xl border border-stone-200/80 bg-white/90 p-6 shadow-card text-sm text-stone-600">
            <p className="font-medium text-wine-900">{error}</p>
            {!import.meta.env.VITE_YANDEX_MAPS_API_KEY && (
              <p className="mt-3 text-xs leading-relaxed text-stone-500">
                Добавьте <code className="rounded bg-stone-100 px-1 py-0.5 text-[11px]">VITE_YANDEX_MAPS_API_KEY</code> в .env
                (см. README).
              </p>
            )}
          </div>
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
