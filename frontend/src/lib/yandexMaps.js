/**
 * Загрузка JS API Яндекс.Карт 2.1 (совместимо с React 19).
 * Ключ: https://developer.tech.yandex.ru/services/
 */
export function loadYandexMapsApi() {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('window'))
  }
  if (window.ymaps) {
    return new Promise((resolve) => {
      window.ymaps.ready(() => resolve(window.ymaps))
    })
  }

  return new Promise((resolve, reject) => {
    let settled = false
    let timeoutId = null
    const finish = (fn) => (value) => {
      if (settled) return
      settled = true
      if (timeoutId) window.clearTimeout(timeoutId)
      fn(value)
    }
    const done = finish(resolve)
    const fail = finish(reject)
    const resolveWhenReady = () => {
      if (!window.ymaps || typeof window.ymaps.ready !== 'function') {
        fail(new Error('Yandex Maps API загружен, но ymaps недоступен'))
        return
      }
      window.ymaps.ready(() => done(window.ymaps))
    }

    const existing = document.querySelector('script[data-yandex-maps-api="2.1"]')
    if (existing) {
      const onLoad = () => resolveWhenReady()
      if (window.ymaps) {
        onLoad()
        return
      }
      existing.addEventListener('load', onLoad)
      existing.addEventListener('error', () => fail(new Error('Yandex Maps script')))
      return
    }

    const key = import.meta.env.VITE_YANDEX_MAPS_API_KEY || ''
    const qs = new URLSearchParams({ lang: 'ru_RU' })
    if (key) qs.set('apikey', key)

    const script = document.createElement('script')
    script.src = `https://api-maps.yandex.ru/2.1/?${qs.toString()}`
    script.async = true
    script.dataset.yandexMapsApi = '2.1'
    script.onload = () => resolveWhenReady()
    script.onerror = () => fail(new Error('Не удалось загрузить api-maps.yandex.ru'))
    timeoutId = window.setTimeout(() => {
      fail(new Error('Таймаут загрузки карты (api-maps.yandex.ru)'))
    }, 12000)
    document.head.appendChild(script)
  })
}
