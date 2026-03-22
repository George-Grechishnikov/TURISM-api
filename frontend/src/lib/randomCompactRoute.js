import { fetchPlaces } from './api'

const MIN_STOPS = 5
const MAX_STOPS = 10
const PREFERRED_MAX_LEG_KM = 22

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371
  const p1 = (lat1 * Math.PI) / 180
  const p2 = (lat2 * Math.PI) / 180
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(p1) * Math.cos(p2) * Math.sin(dLon / 2) * Math.sin(dLon / 2)
  return 2 * R * Math.asin(Math.sqrt(Math.min(1, a)))
}

function normTags(p) {
  const raw = p.tags
  if (Array.isArray(raw)) return raw.map((x) => String(x).toLowerCase())
  if (raw && typeof raw === 'object') return []
  return []
}

export function isFoodPlace(p) {
  if (p.category === 'food') return true
  return normTags(p).some((t) =>
    ['питание', 'обед', 'кафе', 'ресторан', 'кухня', 'гастрономия', 'ланч'].some((k) => t.includes(k)),
  )
}

function validCoordPlace(p) {
  const la = Number(p.latitude)
  const lo = Number(p.longitude)
  return Number.isFinite(la) && Number.isFinite(lo) ? { ...p, latitude: la, longitude: lo } : null
}

/**
 * Цепочка из 5–10 точек: старт с питания, шаги с короткими переездами (жадно к ближайшим).
 * @returns {Promise<string[]>} id мест в порядке посещения
 */
export async function buildRandomCompactPlaceIds() {
  const raw = await fetchPlaces()
  const list = Array.isArray(raw) ? raw : []
  const pool = list.map(validCoordPlace).filter(Boolean)
  if (pool.length === 0) throw new Error('Нет доступных мест для маршрута')

  const foodCandidates = pool.filter(isFoodPlace)
  const foodPool = foodCandidates.length > 0 ? foodCandidates : pool

  const target = Math.min(pool.length, MIN_STOPS + Math.floor(Math.random() * (MAX_STOPS - MIN_STOPS + 1)))

  const start = foodPool[Math.floor(Math.random() * foodPool.length)]
  const route = [start]
  const used = new Set([String(start.id)])

  while (route.length < target) {
    const last = route[route.length - 1]
    const scored = []
    for (const p of pool) {
      const id = String(p.id)
      if (used.has(id)) continue
      const d = haversineKm(last.latitude, last.longitude, p.latitude, p.longitude)
      scored.push({ p, d })
    }
    if (scored.length === 0) break
    scored.sort((a, b) => a.d - b.d)
    const close = scored.filter((x) => x.d <= PREFERRED_MAX_LEG_KM)
    const bucket = close.length ? close : scored
    const k = Math.min(4, bucket.length)
    const pick = bucket[Math.floor(Math.random() * k)].p
    route.push(pick)
    used.add(String(pick.id))
  }

  if (!route.some(isFoodPlace) && foodCandidates.length > 0) {
    const f = foodCandidates[Math.floor(Math.random() * foodCandidates.length)]
    const fid = String(f.id)
    if (!used.has(fid)) {
      route.splice(1, 0, f)
      used.add(fid)
    }
  }

  return route.map((p) => String(p.id))
}
