const CATEGORY_LABEL = {
  winery: 'Винодельня',
  lodging: 'Жильё',
  food: 'Питание',
  transfer: 'Трансфер',
}

/** Компактная подсказка на карте при наведении на маркер (не полноэкранная). */
export function PlaceHoverCard({ place }) {
  if (!place) return null
  const photo = place.photo_urls?.[0]

  return (
    <div
      className="pointer-events-none absolute bottom-6 right-4 z-[25] max-w-[min(19rem,calc(100vw-8rem))] overflow-hidden rounded-2xl border border-white/50 bg-white/92 shadow-card-lg backdrop-blur-xl"
      role="status"
    >
      <div className="absolute left-0 top-0 h-full w-1 bg-gradient-to-b from-wine-600 via-amber-600 to-wine-700" aria-hidden />
      <div className="flex gap-3 pl-4 pr-3 py-3">
        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-stone-200/80 bg-stone-100 shadow-inner">
          {photo ? (
            <img src={photo} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-lg text-wine-700/50">◆</div>
          )}
        </div>
        <div className="min-w-0 flex-1 text-left">
          <p className="font-display text-sm font-semibold leading-tight text-wine-950">{place.name}</p>
          {place.category && (
            <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-800/90">
              {CATEGORY_LABEL[place.category] || place.category}
            </p>
          )}
          {(place.short_description || place.region) && (
            <p className="mt-1.5 line-clamp-3 text-xs leading-snug text-stone-600">
              {place.short_description || place.region}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
