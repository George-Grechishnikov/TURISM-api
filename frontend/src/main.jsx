import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

/** Совпадает с Vite-сборкой и с полем buildId в /build.json на сервере */
const CLIENT_BUILD = String(import.meta.env.VITE_APP_BUILD_ID ?? 'dev')
const RELOAD_ONCE_KEY = 'turizm.reloadOnceForBuild'
/** Не блокировать первый кадр UI, если /build.json долго не отвечает (Docker, сеть) */
const BUILD_JSON_TIMEOUT_MS = 5000

/**
 * Запрос /build.json без кэша (с таймаутом).
 * Если на сервере другая сборка, чем в уже загруженном бандле — один раз перезагружаем страницу (подтягивается новый index + ассеты).
 * @returns {Promise<boolean>} false — ушли в location.reload(), не трогать дерево
 */
async function syncBuildWithServer() {
  if (import.meta.env.DEV) return true
  if (typeof window === 'undefined') return true

  try {
    const controller = new AbortController()
    const timer = window.setTimeout(() => controller.abort(), BUILD_JSON_TIMEOUT_MS)
    const res = await fetch('/build.json', {
      cache: 'no-store',
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'Cache-Control': 'no-cache',
      },
    })
    window.clearTimeout(timer)
    if (!res.ok) return true

    const data = await res.json()
    const serverBuild = String(data.buildId ?? '')

    if (serverBuild && CLIENT_BUILD !== 'dev' && serverBuild !== CLIENT_BUILD) {
      if (!sessionStorage.getItem(RELOAD_ONCE_KEY)) {
        sessionStorage.setItem(RELOAD_ONCE_KEY, '1')
        window.location.reload()
        return false
      }
    }

    if (serverBuild === CLIENT_BUILD || CLIENT_BUILD === 'dev') {
      sessionStorage.removeItem(RELOAD_ONCE_KEY)
    }
  } catch {
    /* офлайн, нет build.json, таймаут — продолжаем с текущим бандлом */
  }
  return true
}

function mountApp() {
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

async function boot() {
  mountApp()

  if (typeof window !== 'undefined') {
    window.__TURIZM_BUILD__ = CLIENT_BUILD
    if (!import.meta.env.DEV) {
      console.info(
        '[Turizm] сборка фронта:',
        CLIENT_BUILD,
        '— при деплое проверяется /build.json; если UI старый, пересоберите образ web',
      )
    }
  }

  if (import.meta.env.DEV || typeof window === 'undefined') return

  const ok = await syncBuildWithServer()
  if (!ok) {
    /* reload() уже вызван */
  }
}

boot()
