/** Первый URL фото места из ответа API (не из статических ассетов Vite). */
export function primaryPhotoUrl(place) {
  const u = place?.photo_urls?.[0]
  if (u == null || typeof u !== 'string') return null
  const t = u.trim()
  return t.length ? t : null
}
