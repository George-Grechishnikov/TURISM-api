import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { SiteHeader } from '../components/SiteHeader'
import { fetchPlaces } from '../lib/api'
import { primaryPhotoUrl } from '../lib/placePhoto'

export function PlacesPage() {
  const [places, setPlaces] = useState([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(null)

  useEffect(() => {
    let c = false
    ;(async () => {
      try {
        const data = await fetchPlaces()
        if (!c) setPlaces(Array.isArray(data) ? data : [])
      } catch (e) {
        if (!c) setErr(e?.message || 'Не удалось загрузить места')
      } finally {
        if (!c) setLoading(false)
      }
    })()
    return () => {
      c = true
    }
  }, [])

  const wineries = places.filter((p) => p.is_winery || p.category === 'winery')

  return (
    <div className="min-h-screen bg-[#faf7f2] font-['Montserrat']">
      <SiteHeader variant="bar" />
      <main className="mx-auto max-w-6xl px-4 py-10">
        <h1 className="mb-2 text-3xl font-bold text-wine-950">Винодельни и точки маршрута</h1>
        <p className="mb-8 max-w-2xl text-stone-600">
          Ориентировочная стоимость визита указана там, где есть в базе — при подборе маршрута учитывается ваш
          бюджет из опроса.
        </p>
        <div className="mb-6 flex flex-wrap gap-3">
          <Link
            to="/quiz"
            className="rounded-full bg-wine-800 px-5 py-2.5 text-sm font-semibold text-white shadow transition hover:bg-wine-900"
          >
            Подобрать маршрут
          </Link>
          <Link
            to="/route"
            className="rounded-full border border-wine-300 bg-white px-5 py-2.5 text-sm font-semibold text-wine-900 transition hover:bg-wine-50"
          >
            Открыть карту
          </Link>
        </div>

        {loading && <p className="text-stone-500">Загрузка…</p>}
        {err && (
          <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-800" role="alert">
            {err}
          </p>
        )}

        {!loading && !err && (
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {wineries.map((p) => {
              const photo = primaryPhotoUrl(p)
              return (
                <li
                  key={p.id}
                  className="overflow-hidden rounded-2xl border border-stone-200/90 bg-white shadow-card-lg transition hover:border-wine-200"
                >
                  <Link to="/route" className="block">
                    <div className="aspect-[16/10] bg-stone-100">
                      {photo ? (
                        <img src={photo} alt="" className="h-full w-full object-cover" loading="lazy" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-stone-400">Нет фото</div>
                      )}
                    </div>
                    <div className="p-4">
                      <h2 className="text-lg font-semibold text-wine-950">{p.name}</h2>
                      <p className="mt-1 line-clamp-2 text-sm text-stone-600">{p.short_description}</p>
                      {p.typical_visit_cost_rub != null && (
                        <p className="mt-2 text-xs font-medium text-stone-500">
                          от ~{Number(p.typical_visit_cost_rub).toLocaleString('ru-RU')} ₽ / визит
                        </p>
                      )}
                    </div>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </main>
    </div>
  )
}
