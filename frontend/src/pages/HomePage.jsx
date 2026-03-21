import { Link } from 'react-router-dom'

export function HomePage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#faf7f2] bg-mesh-hero">
      <div
        className="pointer-events-none absolute -right-32 top-1/4 h-[420px] w-[420px] rounded-full bg-wine-200/30 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -left-24 bottom-0 h-[320px] w-[320px] rounded-full bg-amber-200/25 blur-3xl"
        aria-hidden
      />

      <div className="relative z-10 mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-6 py-20 text-center">
        <p
          className="mb-3 text-[11px] font-semibold uppercase tracking-[0.28em] text-wine-700/90 opacity-0 animate-fade-up"
          style={{ animationDelay: '0.05s' }}
        >
          Краснодарский край
        </p>
        <h1
          className="font-display text-[2.35rem] font-semibold leading-[1.12] text-wine-950 sm:text-5xl sm:leading-[1.08] opacity-0 animate-fade-up"
          style={{ animationDelay: '0.12s' }}
        >
          Винные маршруты
          <span className="mt-1 block bg-gradient-to-r from-wine-800 via-amber-800 to-wine-700 bg-clip-text text-transparent sm:mt-0 sm:inline sm:pl-2">
            под ваше настроение
          </span>
        </h1>
        <p
          className="mt-6 max-w-md text-base leading-relaxed text-stone-600 opacity-0 animate-fade-up"
          style={{ animationDelay: '0.22s' }}
        >
          Три вопроса, теги и карта: погода и пожелания учитываются, чтобы собрать день по винодельням без лишней суеты.
        </p>
        <div
          className="mt-4 h-px w-16 bg-gradient-to-r from-transparent via-wine-400/60 to-transparent opacity-0 animate-fade-up"
          style={{ animationDelay: '0.28s' }}
          aria-hidden
        />
        <div className="mt-10 opacity-0 animate-fade-up" style={{ animationDelay: '0.35s' }}>
          <Link to="/quiz" className="btn-primary px-10 py-3.5">
            Собрать маршрут
          </Link>
        </div>
        <p
          className="mt-8 text-xs text-stone-500 opacity-0 animate-fade-up"
          style={{ animationDelay: '0.45s' }}
        >
          Бесплатно · без регистрации
        </p>
      </div>
    </div>
  )
}
