import { useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'

import { AuthModal } from './components/AuthModal'
import { SequentialAiChatCard } from './components/SequentialAiChatCard'
import { SommelierAssistant } from './components/SommelierAssistant'
import { collectSignals } from './lib/api'
import { hasSequentialAiTourSession } from './lib/sequentialAiSession'
import { useAuthStore } from './store/authStore'
import { useTripStore } from './store/tripStore'
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

/** Плавающий сомелье: не на главной и не на /quiz (макет опроса). */
const SOMMELIER_PATHS = new Set(['/route', '/places', '/routes'])

function AppRoutes() {
  const location = useLocation()
  const showSommelier = SOMMELIER_PATHS.has(location.pathname)
  const sequentialAiChatActive = useTripStore((s) => s.sequentialAiChatActive)

  /** На /quiz чат не показываем; на остальных страницах — фиксированный чип, если активен тур «последовательный AI». */
  useEffect(() => {
    if (location.pathname === '/quiz') return
    if (hasSequentialAiTourSession()) {
      useTripStore.setState({ sequentialAiChatActive: true })
    }
  }, [location.pathname])

  const showSequentialAiChat =
    location.pathname !== '/quiz' && location.pathname !== '/' && sequentialAiChatActive

  return (
    <div className="min-h-screen w-full">
      {showSequentialAiChat ? <SequentialAiChatCard /> : null}
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
