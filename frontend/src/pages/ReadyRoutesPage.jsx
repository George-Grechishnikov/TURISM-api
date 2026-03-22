import { Link, useNavigate } from 'react-router-dom'

import { SiteHeader } from '../components/SiteHeader'
import { READY_ROUTES } from '../data/readyRoutes'
import { useTripStore } from '../store/tripStore'

function List({ title, items }) {
  if (!items?.length) return null
  return (
    <div className="mt-3">
      <p className="text-xs font-bold uppercase tracking-wide text-wine-800/80">{title}</p>
      <ul className="mt-1.5 list-inside list-disc text-sm text-stone-600">
        {items.map((x) => (
          <li key={x}>{x}</li>
        ))}
      </ul>
    </div>
  )
}

export function ReadyRoutesPage() {
  const navigate = useNavigate()
  const applyPreset = useTripStore((s) => s.applyReadyRoutePreset)

  function goQuizWithPreset(presetId) {
    applyPreset(presetId)
    navigate('/quiz')
  }

  return (
    <div className="min-h-screen bg-[#faf7f2] font-['Montserrat'] text-stone-800">
      <SiteHeader variant="bar" />
      <main className="mx-auto max-w-5xl px-4 py-10">
        <h1 className="text-3xl font-bold text-wine-950 md:text-4xl">Готовые маршруты</h1>
        <p className="mt-4 max-w-3xl text-lg leading-relaxed text-stone-600">
          Ниже — типовые сценарии по Краснодарскому краю: какие винодельни логично совместить, где искать ночёвку и
          обед (ориентиры из каталога сервиса). Нажмите «Заполнить опрос» — мы подставим теги в анкету, дальше
          останется проверить ответы и нажать «Поехали». Или           откройте{' '}
          <Link to="/quiz" className="font-semibold text-wine-800 underline">
            опрос
          </Link>{' '}
          с нуля.
        </p>
        <p className="mt-3 text-sm text-stone-500">
          Отели и кафе в базе — вручную размеченные точки рядом с кластерами виноделен, не автоматический парсинг
          бронирований. Бронируйте жильё и столы у отельеров и рестораторов.
        </p>

        <div className="mt-10 flex flex-wrap gap-3">
          <Link
            to="/quiz"
            className="inline-flex rounded-full border border-wine-300 bg-white px-5 py-2.5 text-sm font-bold text-wine-900 shadow-sm transition hover:bg-wine-50"
          >
            Пустой опрос
          </Link>
          <Link
            to="/route"
            className="inline-flex rounded-full bg-wine-800 px-5 py-2.5 text-sm font-bold text-white shadow transition hover:bg-wine-900"
          >
            Карта маршрута
          </Link>
        </div>

        <ul className="mt-12 grid gap-8 md:grid-cols-2">
          {READY_ROUTES.map((r) => (
            <li
              key={r.presetId}
              className="flex flex-col rounded-2xl border border-stone-200/90 bg-white p-6 shadow-card-lg ring-1 ring-stone-100/80"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h2 className="text-xl font-bold text-wine-950">{r.title}</h2>
                <span className="shrink-0 rounded-full bg-wine-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-wine-900">
                  {r.badge}
                </span>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-stone-700">{r.lead}</p>
              <List title="Винодельни в фокусе" items={r.wineries} />
              <List title="Где остановиться (ориентиры)" items={r.stay} />
              <List title="Поесть рядом (ориентиры)" items={r.eat} />
              <p className="mt-4 text-xs leading-relaxed text-stone-500">{r.tips}</p>
              <button
                type="button"
                onClick={() => goQuizWithPreset(r.presetId)}
                className="mt-6 w-full rounded-xl bg-wine-800 py-3 text-sm font-bold uppercase tracking-wide text-white transition hover:bg-wine-900"
              >
                Заполнить опрос под этот маршрут
              </button>
            </li>
          ))}
        </ul>
      </main>
    </div>
  )
}
