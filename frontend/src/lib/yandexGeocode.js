import { loadYandexMapsApi } from './yandexMaps'

/**
 * Прямой геокодинг (адрес/город → координаты) через загруженный JS API 2.1.
 * Нужен тот же ключ, что и для карты («JavaScript API и HTTP Геокодер»).
 */
export async function geocodeSearchQuery(query) {
  const q = String(query ?? '').trim()
  if (!q) throw new Error('Введите адрес, город или улицу')
  const ymaps = await loadYandexMapsApi()
  if (typeof ymaps.geocode !== 'function') {
    throw new Error('Геокодер недоступен — проверьте ключ API')
  }
  const res = await ymaps.geocode(q, { results: 1 })
  const first = res.geoObjects.get(0)
  if (!first) throw new Error('Ничего не нашли — уточните запрос')
  const coords = first.geometry.getCoordinates()
  const lat = Number(coords[0])
  const lon = Number(coords[1])
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    throw new Error('Не удалось прочитать координаты')
  }
  let label = q
  try {
    if (typeof first.getAddressLine === 'function') {
      const line = first.getAddressLine()
      if (line) label = line
    } else {
      const t = first.properties?.get?.('text') || first.properties?.get?.('name')
      if (t) label = String(t)
    }
  } catch {
    /* оставляем q */
  }
  return { latitude: lat, longitude: lon, label }
}
