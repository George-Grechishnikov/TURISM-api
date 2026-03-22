import { create } from 'zustand'

import { buildRoute as buildRouteApi, patchRoute as patchRouteApi } from '../lib/api'
import { clearSequentialAiTourSession, markSequentialAiTourSession } from '../lib/sequentialAiSession'

/** PATCH идут строго по одному — иначе два запроса читают одно состояние БД и затирают друг друга. */
let patchQueue = Promise.resolve()

/** Не даём параллельно дергать build на первую остановку (двойной клик → несколько маршрутов). */
let startRouteWithPlaceInFlight = false

function enqueuePatch(task) {
  const run = patchQueue.then(task, task)
  patchQueue = run.catch(() => {})
  return run
}

export const useTripStore = create((set, get) => ({
  companionsTags: [],
  moodTags: [],
  durationTags: [],
  extraTags: [],
  budgetMin: 5000,
  budgetMax: 1000000,

  route: null,
  places: [],
  loading: false,
  /** PATCH маршрута (добавить/убрать точку) — отдельно от loading сборки */
  patching: false,
  error: null,
  /** Вход с «Последовательный тур с AI»: первое добавление — только выбранное место, без автосборки */
  sequentialAiMode: false,
  /** Показать карточку «AI-Чат» на /route после входа с главной (последовательный тур) */
  sequentialAiChatActive: false,
  /**
   * Точка «откуда едем» для линии по дорогам на карте (Яндекс MultiRoute).
   * Пока null — линию не строим (только метки остановок).
   */
  drivingRouteStart: null,

  setDrivingRouteStart: (point) => set({ drivingRouteStart: point }),
  clearDrivingRouteStart: () => set({ drivingRouteStart: null }),

  toggleTag: (field, tag) => {
    const cur = get()[field]
    const next = cur.includes(tag) ? cur.filter((t) => t !== tag) : [...cur, tag]
    set({ [field]: next })
  },

  setTags: (field, tags) => set({ [field]: tags }),
  setBudget: (min, max) => set({ budgetMin: min, budgetMax: max }),

  clearSequentialAiChat: () => {
    clearSequentialAiTourSession()
    set({ sequentialAiChatActive: false })
  },

  buildRoute: async () => {
    get().clearSequentialAiChat()
    set({ loading: true, error: null, sequentialAiMode: false })
    try {
      const { companionsTags, moodTags, durationTags, extraTags, budgetMin, budgetMax } = get()
      const data = await buildRouteApi({
        companions_tags: companionsTags,
        mood_tags: moodTags,
        duration_tags: durationTags,
        extra_tags: extraTags,
        budget_min: budgetMin,
        budget_max: budgetMax,
        max_stops: 6,
      })
      set({
        route: data.route,
        places: data.places,
        loading: false,
        drivingRouteStart: null,
      })
      return data
    } catch (e) {
      const msg = e.response?.data?.detail || e.message || 'Ошибка маршрута'
      set({ error: String(msg), loading: false })
      throw e
    }
  },

  startRouteWithPlace: async (placeId) => {
    if (startRouteWithPlaceInFlight || get().loading) return undefined
    startRouteWithPlaceInFlight = true
    const manualSequential = get().sequentialAiMode
    set({ loading: true, error: null })
    try {
      const data = await buildRouteApi({
        companions_tags: [],
        mood_tags: [],
        duration_tags: [],
        extra_tags: [],
        include_place_ids: [placeId],
        budget_min: get().budgetMin,
        budget_max: get().budgetMax,
        max_stops: 6,
        manual_sequential: manualSequential,
      })
      set({
        route: data.route,
        places: data.places,
        loading: false,
        sequentialAiMode: false,
        drivingRouteStart: null,
      })
      return data
    } catch (e) {
      const msg = e.response?.data?.detail || e.message || 'Ошибка маршрута'
      set({ error: String(msg), loading: false })
      throw e
    } finally {
      startRouteWithPlaceInFlight = false
    }
  },

  patchRoute: async (addIds, removeIds) =>
    enqueuePatch(async () => {
      const routeId = get().route?.id
      if (!routeId) return undefined
      set({ patching: true, error: null })
      try {
        const data = await patchRouteApi(routeId, {
          add_place_ids: addIds || [],
          remove_place_ids: removeIds || [],
        })
        set({
          route: data.route,
          places: data.places,
          patching: false,
        })
        return data
      } catch (e) {
        if (e.response?.status === 404) {
          set({
            route: null,
            places: [],
            error: null,
            patching: false,
            drivingRouteStart: null,
          })
          return null
        }
        const msg = e.response?.data?.detail || e.message
        set({ error: String(msg), patching: false })
        throw e
      }
    }),

  removeStop: (placeId) => get().patchRoute([], [placeId]),

  addStop: (placeId) => get().patchRoute([placeId], []),

  /** Пустой маршрут: все места в «Добавить», остановок нет (последовательная сборка с AI) */
  clearRouteSession: () => {
    markSequentialAiTourSession()
    set({
      route: null,
      places: [],
      error: null,
      loading: false,
      patching: false,
      sequentialAiMode: true,
      sequentialAiChatActive: true,
      drivingRouteStart: null,
    })
  },
}))
