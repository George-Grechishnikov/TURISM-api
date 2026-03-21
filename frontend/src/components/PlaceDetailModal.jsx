import { useEffect, useState } from 'react'
import { Swiper, SwiperSlide } from 'swiper/react'
import { Navigation, Pagination } from 'swiper/modules'

import { fetchPlace } from '../lib/api'

import 'swiper/css'
import 'swiper/css/navigation'
import 'swiper/css/pagination'

export function PlaceDetailModal({
  placeId,
  onClose,
  inRoute = false,
  patching = false,
  onRemoveFromRoute,
}) {
  const [data, setData] = useState(null)
  const [err, setErr] = useState(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const p = await fetchPlace(placeId)
        if (!cancelled) setData(p)
      } catch (e) {
        if (!cancelled) setErr(e.message)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [placeId])

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  if (!placeId) return null

  return (
    <div
      className="fixed inset-0 flex flex-col bg-[#faf7f2] text-left"
      style={{ zIndex: 2147483647 }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="place-detail-title"
    >
      <div className="h-1 shrink-0 bg-bar-warm" aria-hidden />
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-stone-200/80 bg-white/90 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-md">
        <h2
          id="place-detail-title"
          className="font-display min-w-0 text-xl font-semibold leading-tight text-wine-950 sm:text-2xl"
        >
          {data?.name || 'Загрузка…'}
        </h2>
        <button
          type="button"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-stone-200/80 bg-white text-xl leading-none text-stone-600 shadow-sm transition hover:border-wine-200 hover:bg-wine-50 hover:text-wine-900"
          onClick={onClose}
          aria-label="Закрыть"
        >
          ×
        </button>
      </header>

      {inRoute && typeof onRemoveFromRoute === 'function' && (
        <div className="shrink-0 border-b border-stone-200/80 bg-white/70 px-4 py-2.5 backdrop-blur-sm sm:px-6">
          <button
            type="button"
            disabled={patching}
            className="w-full rounded-xl border border-red-200/90 bg-red-50/90 py-2.5 text-sm font-semibold text-red-800 transition hover:border-red-300 hover:bg-red-100 disabled:pointer-events-none disabled:opacity-50 sm:w-auto sm:px-4"
            onClick={() => {
              void onRemoveFromRoute()
            }}
          >
            {patching ? 'Удаляем…' : 'Убрать из маршрута'}
          </button>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-6">
        {err && (
          <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{err}</p>
        )}
        {data && (
          <>
            {data.region && (
              <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-stone-500">{data.region}</p>
            )}
            {data.photo_urls?.length > 0 && (
              <Swiper
                modules={[Navigation, Pagination]}
                navigation
                pagination={{ clickable: true }}
                className="place-detail-swiper mb-6 overflow-hidden rounded-2xl border border-stone-200/60 shadow-card"
              >
                {data.photo_urls.map((url) => (
                  <SwiperSlide key={url}>
                    <img
                      src={url}
                      alt=""
                      className="h-[min(42vh,380px)] w-full bg-stone-100 object-cover"
                    />
                  </SwiperSlide>
                ))}
              </Swiper>
            )}
            {data.video_url ? (
              <div className="mb-6 aspect-video max-h-[50vh] overflow-hidden rounded-2xl border border-stone-900/10 bg-black shadow-card-lg">
                <video src={data.video_url} controls className="h-full w-full" playsInline />
              </div>
            ) : null}
            <div>
              <h3 className="font-display text-base font-semibold text-wine-900">О месте</h3>
              <p className="mt-2 text-base leading-relaxed text-stone-700 whitespace-pre-wrap">
                {data.full_description || data.short_description || 'Описание появится позже.'}
              </p>
            </div>
            {data.tags?.length > 0 && (
              <div className="mt-6 flex flex-wrap gap-2">
                {data.tags.map((t) => (
                  <span
                    key={t}
                    className="rounded-full border border-wine-200/60 bg-wine-50 px-3 py-1.5 text-xs font-medium text-wine-900"
                  >
                    {t}
                  </span>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
