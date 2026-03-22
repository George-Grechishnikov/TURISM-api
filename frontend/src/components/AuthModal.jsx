import { useState } from 'react'

import { useAuthStore } from '../store/authStore'

export function AuthModal() {
  const open = useAuthStore((s) => s.modalOpen)
  const closeModal = useAuthStore((s) => s.closeModal)
  const login = useAuthStore((s) => s.login)
  const register = useAuthStore((s) => s.register)
  const authError = useAuthStore((s) => s.authError)
  const authLoading = useAuthStore((s) => s.authLoading)

  const [tab, setTab] = useState('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  if (!open) return null

  async function onSubmit(e) {
    e.preventDefault()
    if (tab === 'login') {
      await login(username, password)
    } else {
      await register(username, password)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[2147483640] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
    >
      <div className="relative w-full max-w-md rounded-2xl border border-stone-200 bg-[#faf7f2] p-6 shadow-2xl font-['Montserrat']">
        <button
          type="button"
          onClick={closeModal}
          className="absolute right-4 top-4 rounded-full p-1 text-stone-500 transition hover:bg-stone-200 hover:text-stone-800"
          aria-label="Закрыть"
        >
          ✕
        </button>
        <h2 id="auth-modal-title" className="text-xl font-bold text-wine-950">
          {tab === 'login' ? 'Вход' : 'Регистрация'}
        </h2>
        <div className="mt-4 flex gap-2 rounded-xl bg-stone-200/60 p-1">
          <button
            type="button"
            onClick={() => setTab('login')}
            className={`flex-1 rounded-lg py-2 text-sm font-semibold transition ${
              tab === 'login' ? 'bg-white text-wine-900 shadow' : 'text-stone-600'
            }`}
          >
            Вход
          </button>
          <button
            type="button"
            onClick={() => setTab('register')}
            className={`flex-1 rounded-lg py-2 text-sm font-semibold transition ${
              tab === 'register' ? 'bg-white text-wine-900 shadow' : 'text-stone-600'
            }`}
          >
            Регистрация
          </button>
        </div>
        <form onSubmit={onSubmit} className="mt-5 space-y-4">
          <label className="block text-sm font-semibold text-stone-800">
            Имя пользователя
            <input
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="mt-1 w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-stone-900 shadow-sm"
              required
            />
          </label>
          <label className="block text-sm font-semibold text-stone-800">
            Пароль
            <input
              type="password"
              autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-stone-900 shadow-sm"
              required
              minLength={6}
            />
          </label>
          {authError && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
              {authError}
            </p>
          )}
          <button
            type="submit"
            disabled={authLoading}
            className="w-full rounded-xl bg-wine-800 py-3 text-sm font-bold uppercase tracking-wide text-white shadow transition hover:bg-wine-900 disabled:opacity-50"
          >
            {authLoading ? '…' : tab === 'login' ? 'Войти' : 'Создать аккаунт'}
          </button>
        </form>
      </div>
    </div>
  )
}
