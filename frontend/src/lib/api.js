import axios from 'axios'

import { getAuthToken } from './authHeader'

const baseURL = import.meta.env.VITE_API_BASE ?? ''

export const api = axios.create({
  baseURL,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const t = getAuthToken()
  if (t) {
    config.headers.Authorization = `Bearer ${t}`
  }
  return config
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

/** ИИ-чат последовательного маршрута: message, route_place_ids, history [{role,text}] */
export async function postSequentialChat(body) {
  const { data } = await api.post('/api/routes/sequential-chat/', body)
  return data
}

export async function patchRoute(routeId, body) {
  const { data } = await api.patch(`/api/routes/${routeId}/`, body)
  return data
}

export async function fetchRoute(routeId) {
  const { data } = await api.get(`/api/routes/${routeId}/`)
  return data
}

/** Виртуальный сомелье: wine_type, wine_style, visit_goal */
export async function fetchSommelierRecommend(body) {
  const { data } = await api.post('/api/places/sommelier/recommend/', body)
  return data
}
