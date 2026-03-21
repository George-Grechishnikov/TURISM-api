import axios from 'axios'

const baseURL = import.meta.env.VITE_API_BASE ?? ''

export const api = axios.create({
  baseURL,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
})

export async function collectSignals(signals) {
  const { data } = await api.post('/api/profile/collect/', { signals })
  return data
}

export async function fetchPlaces() {
  const { data } = await api.get('/api/places/')
  return data
}

export async function fetchPlace(id) {
  const { data } = await api.get(`/api/places/${id}/`)
  return data
}

export async function buildRoute(body) {
  const { data } = await api.post('/api/routes/build/', body)
  return data
}

export async function patchRoute(routeId, body) {
  const { data } = await api.patch(`/api/routes/${routeId}/`, body)
  return data
}

/** Виртуальный сомелье: wine_type, wine_style, visit_goal */
export async function fetchSommelierRecommend(body) {
  const { data } = await api.post('/api/places/sommelier/recommend/', body)
  return data
}
