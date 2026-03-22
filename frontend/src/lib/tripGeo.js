/** Геолокация для старта маршрута / погоды (если пользователь согласился в опросе). */
export function resolveTripGeoIfAsked(want) {
  if (!want || typeof navigator === 'undefined' || !navigator.geolocation) {
    return Promise.resolve(null)
  }
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          start_lat: pos.coords.latitude,
          start_lon: pos.coords.longitude,
        }),
      () => resolve(null),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    )
  })
}
