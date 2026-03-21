export function TagCloud({ label, hint, tags, selected, onToggle, className = '' }) {
  return (
    <section className={`text-left ${className}`}>
      <h2 className="flex flex-wrap items-baseline gap-2 font-display text-lg font-semibold text-wine-950">
        {label}
        {hint && (
          <span className="text-xs font-normal font-sans text-stone-400">({hint})</span>
        )}
      </h2>
      <div className="mt-3.5 flex flex-wrap gap-2">
        {tags.map((t) => {
          const active = selected.includes(t)
          return (
            <button
              key={t}
              type="button"
              onClick={() => onToggle(t)}
              className={[
                'rounded-2xl border px-4 py-2.5 text-sm font-medium transition duration-200',
                active
                  ? 'border-wine-600/30 bg-gradient-to-br from-wine-700 to-wine-800 text-white shadow-soft ring-2 ring-wine-500/25 ring-offset-2 ring-offset-white/80'
                  : 'border-stone-200/90 bg-white/90 text-stone-700 shadow-sm hover:border-wine-300 hover:bg-wine-50/50 hover:text-wine-900',
              ].join(' ')}
            >
              {t}
            </button>
          )
        })}
      </div>
    </section>
  )
}
