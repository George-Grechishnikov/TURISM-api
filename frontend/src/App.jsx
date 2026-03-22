import { useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'

import { AuthModal } from './components/AuthModal'
import { SommelierAssistant } from './components/SommelierAssistant'
import { collectSignals } from './lib/api'
import { useAuthStore } from './store/authStore'
import { HomePage } from './pages/HomePage'
import { PlacesPage } from './pages/PlacesPage'
import { QuizPage } from './pages/QuizPage'
import { ReadyRoutesPage } from './pages/ReadyRoutesPage'
import { RoutePage } from './pages/RoutePage'

function useClientSignals() {
  useEffect(() => {
    const signals = {
      language: navigator.language,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      screen: `${window.screen?.width}x${window.screen?.height}`,
      referrer: document.referrer || null,
    }
    collectSignals(signals).catch(() => {})
  }, [])
}

function useAuthBootstrap() {
  useEffect(() => {
    const { access, fetchMe } = useAuthStore.getState()
    if (access) {
      fetchMe().catch(() => {})
    }
  }, [])
}

export default function App() {
  useClientSignals()
  useAuthBootstrap()
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  )
}

const SOMMELIER_PATHS = new Set(['/', '/quiz', '/route', '/places', '/routes'])

function AppRoutes() {
  const location = useLocation()
  const showSommelier = SOMMELIER_PATHS.has(location.pathname)

  return (
    <div className="min-h-screen w-full">
      {showSommelier ? <SommelierAssistant /> : null}
      <AuthModal />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/quiz" element={<QuizPage />} />
        <Route path="/route" element={<RoutePage />} />
        <Route path="/places" element={<PlacesPage />} />
        <Route path="/routes" element={<ReadyRoutesPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  )
}
