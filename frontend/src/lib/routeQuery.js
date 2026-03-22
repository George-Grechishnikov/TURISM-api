const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isRouteIdString(s) {
  return typeof s === 'string' && UUID_RE.test(s.trim())
}

/** Сравнение id маршрута из URL и из store (регистр / пробелы). */
export function normRouteId(s) {
  if (s == null || s === '') return ''
  return String(s).trim().toLowerCase()
}

/** Синхронизировать ?route=uuid с текущим маршрутом (без перезагрузки). */
export function replaceRouteQueryParam(routeId) {
  if (typeof window === 'undefined' || !routeId) return
  const u = new URL(window.location.href)
  u.searchParams.set('route', String(routeId).trim().toLowerCase())
  const q = u.searchParams.toString()
  window.history.replaceState(null, '', q ? `${u.pathname}?${q}` : u.pathname)
}

export function clearRouteQueryParam() {
  if (typeof window === 'undefined') return
  const u = new URL(window.location.href)
  u.searchParams.delete('route')
  const q = u.searchParams.toString()
  window.history.replaceState(null, '', q ? `${u.pathname}?${q}` : u.pathname)
}
