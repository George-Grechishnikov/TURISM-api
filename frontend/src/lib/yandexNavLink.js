/**
 * Ссылка на автомаршрут в Яндекс.Картах (как в навигаторе: пошагово в приложении/на сайте).
 * Формат rtext: широта,долгота~широта,долгота (как в примерах Яндекса для Москвы/РФ).
 */
export function yandexMapsDrivingUrl(fromLat, fromLon, toLat, toLon) {
  const a = `${Number(fromLat)},${Number(fromLon)}`
  const b = `${Number(toLat)},${Number(toLon)}`
  return `https://yandex.ru/maps/?rtext=${a}~${b}&rtt=auto`
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
