import { useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'

import { SommelierAssistant } from './components/SommelierAssistant'
import { collectSignals } from './lib/api'
import { HomePage } from './pages/HomePage'
import { QuizPage } from './pages/QuizPage'
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

export default function App() {
  useClientSignals()
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  )
}

function AppRoutes() {
  const location = useLocation()
  const showSommelier = location.pathname === '/route'

  return (
    <div className="min-h-screen w-full">
      {showSommelier ? <SommelierAssistant /> : null}
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/quiz" element={<QuizPage />} />
        <Route path="/route" element={<RoutePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  )
}
