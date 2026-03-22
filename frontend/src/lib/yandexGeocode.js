import { loadYandexMapsApi } from './yandexMaps'

function normalizeErrMsg(err) {
  if (err == null) return ''
  if (typeof err === 'string') return err
  if (typeof err?.message === 'string') return err.message
  try {
    if (typeof err?.toString === 'function') {
      const s = err.toString()
      if (s && s !== '[object Object]') return s
    }
  } catch {
    /* ignore */
  }
  try {
    return JSON.stringify(err)
  } catch {
    return String(err)
  }
}

/** Яндекс часто отдаёт scriptError при неверном ключе или HTTP Referrer. */
function humanizeGeocodeFailure(err) {
  const raw = normalizeErrMsg(err)
  const lower = raw.toLowerCase()
  if (lower.includes('scripterror') || lower === 'script error') {
    return (
      'Геокодер не отвечает (часто ключ API или список сайтов в кабинете Яндекса). ' +
      'В developer.tech.yandex.ru для ключа включите «JavaScript API и HTTP Геокодер» и добавьте в HTTP Referrer ' +
      'точный адрес этой страницы (например http://100.78.89.35:8080/*). Затем пересоберите фронт с VITE_YANDEX_MAPS_API_KEY. ' +
      'Подробности — в консоли (F12).'
    )
  }
  return raw || 'Не удалось найти адрес'
}

/**
 * Прямой геокодинг (адрес/город → координаты) через загруженный JS API 2.1.
 * Нужен тот же ключ, что и для карты («JavaScript API и HTTP Геокодер»).
 */
export async function geocodeSearchQuery(query) {
  const q = String(query ?? '').trim()
  if (!q) throw new Error('Введите адрес, город или улицу')
  const key = String(import.meta.env.VITE_YANDEX_MAPS_API_KEY ?? '')
    .trim()
    .replace(/^['"]|['"]$/g, '')
  if (!key) {
    throw new Error(
      'В сборке не задан VITE_YANDEX_MAPS_API_KEY — геокодер и карта без ключа не работают. Задайте ключ и пересоберите образ / npm run build.',
    )
  }
  const ymaps = await loadYandexMapsApi()
  if (typeof ymaps.geocode !== 'function') {
    throw new Error('Геокодер недоступен — проверьте ключ API')
  }
  let res
  try {
    res = await ymaps.geocode(q, { results: 1 })
  } catch (err) {
    console.warn('[Turizm geocode] запрос отклонён:', err, { query: q, origin: typeof window !== 'undefined' ? window.location?.origin : null })
    throw new Error(humanizeGeocodeFailure(err))
  }
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
