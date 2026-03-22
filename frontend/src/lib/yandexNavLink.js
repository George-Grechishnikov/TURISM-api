/**
 * Ссылка на автомаршрут в Яндекс.Картах (как в навигаторе: пошагово в приложении/на сайте).
 * rtext: широта,долгота~широта,долгота (как в примерах Яндекса для РФ).
 */
export function yandexMapsDrivingUrl(fromLat, fromLon, toLat, toLon) {
  const rtext = `${Number(fromLat)},${Number(fromLon)}~${Number(toLat)},${Number(toLon)}`
  const qs = new URLSearchParams({
    mode: 'routes',
    rtext,
    rtt: 'auto',
    ruri: '~',
  })
  return `https://yandex.ru/maps/?${qs.toString()}`
}

/** Все точки подряд: старт (если есть) + остановки — для одной ссылки на весь путь. */
export function buildDrivingRouteCoordsOrdered(drivingRouteStart, places) {
  const legs = buildDrivingNavLegs(drivingRouteStart, places)
  if (!legs.length) return []
  const out = [{ lat: legs[0].fromLat, lon: legs[0].fromLon }]
  for (const leg of legs) {
    out.push({ lat: leg.toLat, lon: leg.toLon })
  }
  return out
}

/**
 * Одна ссылка на маршрут через все точки (как ручная сборка в Яндекс.Картах).
 * Параметр ll — долгота,широта (центр кадра).
 */
export function yandexMapsFullRouteUrl(coords) {
  if (!coords || coords.length < 2) return null
  const rtext = coords.map((c) => `${Number(c.lat)},${Number(c.lon)}`).join('~')
  const lats = coords.map((c) => c.lat)
  const lons = coords.map((c) => c.lon)
  const llLon = (Math.min(...lons) + Math.max(...lons)) / 2
  const llLat = (Math.min(...lats) + Math.max(...lats)) / 2
  const qs = new URLSearchParams({
    ll: `${llLon},${llLat}`,
    mode: 'routes',
    rtext,
    rtt: 'auto',
    ruri: '~',
    z: '9',
  })
  return `https://yandex.ru/maps/?${qs.toString()}`
}

/** Сегменты «откуда → куда» для внешних ссылок на навигатор. */
export function buildDrivingNavLegs(drivingRouteStart, places) {
  if (!places?.length) return []
  const list = places.map((p) => ({
    lat: Number(p.latitude),
    lon: Number(p.longitude),
    label: p.name || 'Остановка',
  }))
  const legs = []
  if (drivingRouteStart?.kind === 'point') {
    const slat = Number(drivingRouteStart.latitude)
    const slon = Number(drivingRouteStart.longitude)
    if (Number.isFinite(slat) && Number.isFinite(slon) && list[0]) {
      legs.push({
        fromLat: slat,
        fromLon: slon,
        toLat: list[0].lat,
        toLon: list[0].lon,
        toLabel: list[0].label,
      })
    }
    for (let i = 0; i < list.length - 1; i++) {
      legs.push({
        fromLat: list[i].lat,
        fromLon: list[i].lon,
        toLat: list[i + 1].lat,
        toLon: list[i + 1].lon,
        toLabel: list[i + 1].label,
      })
    }
    return legs
  }
  if (drivingRouteStart?.kind === 'stops') {
    for (let i = 0; i < list.length - 1; i++) {
      legs.push({
        fromLat: list[i].lat,
        fromLon: list[i].lon,
        toLat: list[i + 1].lat,
        toLon: list[i + 1].lon,
        toLabel: list[i + 1].label,
      })
    }
  }
  return legs
}
