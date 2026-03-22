import { create } from 'zustand'

import { api } from '../lib/api'
import { setAuthTokenGetter } from '../lib/authHeader'

const STORAGE_KEY = 'turizm.auth.v1'

function readStored() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const o = JSON.parse(raw)
    if (!o || typeof o !== 'object') return null
    return o
  } catch {
    return null
  }
}

function writeStored(access, refresh, username) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ access, refresh, username }))
  } catch {
    /* ignore */
  }
}

const initial = typeof sessionStorage !== 'undefined' ? readStored() : null

export const useAuthStore = create((set, get) => ({
  access: initial?.access ?? null,
  refresh: initial?.refresh ?? null,
  username: initial?.username ?? null,
  modalOpen: false,
  authError: null,
  authLoading: false,

  openModal: () => set({ modalOpen: true, authError: null }),
  closeModal: () => set({ modalOpen: false, authError: null }),

  setSession: (access, refresh, username) => {
    set({ access, refresh, username: username ?? get().username })
    writeStored(access, refresh, username ?? get().username)
  },

  logout: () => {
    set({ access: null, refresh: null, username: null })
    try {
      sessionStorage.removeItem(STORAGE_KEY)
    } catch {
      /* ignore */
    }
  },

  fetchMe: async () => {
    const token = get().access
    if (!token) return
    try {
      const { data } = await api.get('/api/profile/me/')
      const name = data?.username ?? get().username
      set({ username: name })
      writeStored(get().access, get().refresh, name)
    } catch {
      get().logout()
    }
  },

  login: async (username, password) => {
    set({ authLoading: true, authError: null })
    try {
      const { data } = await api.post('/api/token/', { username: username.trim(), password })
      get().setSession(data.access, data.refresh, username.trim())
      await get().fetchMe()
      set({ modalOpen: false, authLoading: false })
    } catch (e) {
      const msg = e.response?.data?.detail || e.message || 'Ошибка входа'
      set({ authError: String(msg), authLoading: false })
      throw e
    }
  },

  register: async (username, password) => {
    set({ authLoading: true, authError: null })
    try {
      const { data } = await api.post('/api/profile/register/', { username: username.trim(), password })
      get().setSession(data.access, data.refresh, data.username ?? username.trim())
      set({ modalOpen: false, authLoading: false })
    } catch (e) {
      const msg = e.response?.data?.detail || e.message || 'Ошибка регистрации'
      set({ authError: String(msg), authLoading: false })
      throw e
    }
  },
}))

setAuthTokenGetter(() => useAuthStore.getState().access)
