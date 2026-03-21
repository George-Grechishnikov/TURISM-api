import { create } from 'zustand'

import { buildRoute as buildRouteApi, patchRoute as patchRouteApi } from '../lib/api'

/** PATCH идут строго по одному — иначе два запроса читают одно состояние БД и затирают друг друга. */
let patchQueue = Promise.resolve()

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

  route: null,
  places: [],
  loading: false,
  /** PATCH маршрута (добавить/убрать точку) — отдельно от loading сборки */
  patching: false,
  error: null,

  toggleTag: (field, tag) => {
    const cur = get()[field]
    const next = cur.includes(tag) ? cur.filter((t) => t !== tag) : [...cur, tag]
    set({ [field]: next })
  },

  setTags: (field, tags) => set({ [field]: tags }),

  buildRoute: async () => {
    set({ loading: true, error: null })
    try {
      const { companionsTags, moodTags, durationTags, extraTags } = get()
      const data = await buildRouteApi({
        companions_tags: companionsTags,
        mood_tags: moodTags,
        duration_tags: durationTags,
        extra_tags: extraTags,
        max_stops: 6,
      })
      set({
        route: data.route,
        places: data.places,
        loading: false,
      })
      return data
    } catch (e) {
      const msg = e.response?.data?.detail || e.message || 'Ошибка маршрута'
      set({ error: String(msg), loading: false })
      throw e
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
        const msg = e.response?.data?.detail || e.message
        set({ error: String(msg), patching: false })
        throw e
      }
    }),

  removeStop: (placeId) => get().patchRoute([], [placeId]),

  addStop: (placeId) => get().patchRoute([placeId], []),
}))
