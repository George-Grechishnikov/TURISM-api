import { Link, useLocation } from 'react-router-dom'

import { useAuthStore } from '../store/authStore'

function AuthControls({ variant }) {
  const username = useAuthStore((s) => s.username)
  const openModal = useAuthStore((s) => s.openModal)
  const logout = useAuthStore((s) => s.logout)

  const btnHero =
    'rounded-full border border-[#FCF3B4]/55 bg-black/25 px-4 py-1.5 text-[15px] font-semibold text-[#FCF3B4] transition hover:bg-black/40'
  const btnBar =
    'rounded-full border border-wine-300 bg-wine-50 px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-wine-900 transition hover:bg-wine-100'
  const outHero = 'text-[14px] font-semibold text-[#FCF3B4]'
  const outBar = 'max-w-[120px] truncate text-xs font-semibold text-stone-800'

  if (username) {
    return (
      <div className={`flex items-center gap-2 ${variant === 'hero' ? '' : 'flex-wrap justify-end'}`}>
        <span className={variant === 'hero' ? outHero : outBar} title={username}>
          {username}
        </span>
        <button type="button" onClick={() => logout()} className={variant === 'hero' ? btnHero : btnBar}>
          Выйти
        </button>
      </div>
    )
  }
  return (
    <button type="button" onClick={() => openModal()} className={variant === 'hero' ? btnHero : btnBar}>
      Войти
    </button>
  )
}

/**
 * @param {'hero' | 'bar'} variant
 * @param {React.ReactNode} [rightSlot] — заменить блок авторизации
 */
export function SiteHeader({ variant = 'bar', rightSlot }) {
  const location = useLocation()
  const isHome = location.pathname === '/'

  const navClassHero =
    "mt-[2px] flex gap-[70px] whitespace-nowrap text-[30px] font-medium leading-[100.79%] tracking-[0.03em]"
  const navClassBar =
    'flex flex-wrap items-center gap-4 text-sm font-medium uppercase tracking-wide text-stone-700'

  const linkHero =
    'transition hover:text-white hover:underline decoration-[#FCF3B4]/80 underline-offset-4'
  const linkBar = 'transition hover:text-wine-800'

  const NavInner = () => (
    <>
      <a href={isHome ? '#about' : '/#about'} className={variant === 'hero' ? linkHero : linkBar}>
        о нас
      </a>
      <Link to="/quiz" className={variant === 'hero' ? linkHero : linkBar}>
        маршруты
      </Link>
      <Link to="/places" className={variant === 'hero' ? linkHero : linkBar}>
        винодельни
      </Link>
      <a href={isHome ? '#contact' : '/#contact'} className={variant === 'hero' ? linkHero : linkBar}>
        контакты
      </a>
      <a href={isHome ? '#faq' : '/#faq'} className={variant === 'hero' ? linkHero : linkBar}>
        faq
      </a>
    </>
  )

  if (variant === 'hero') {
    return (
      <header className="absolute left-1/2 top-[23px] z-30 flex -translate-x-1/2 items-start gap-[83px] font-['Montserrat'] uppercase text-[#FCF3B4]">
        <Link
          to="/"
          className="text-[40px] font-bold leading-[100.79%] tracking-[0.03em] transition hover:text-white"
        >
          ЕТЕРНИУМ
        </Link>
        <nav className={navClassHero} aria-label="Основная навигация">
          <NavInner />
        </nav>
        <div className="ml-4 mt-1 shrink-0">{rightSlot !== undefined ? rightSlot : <AuthControls variant="hero" />}</div>
      </header>
    )
  }

  return (
    <header className="sticky top-0 z-[120] border-b border-stone-200/80 bg-white/95 px-4 py-3 font-['Montserrat'] shadow-sm backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
        <Link to="/" className="text-lg font-bold uppercase tracking-wide text-wine-900 transition hover:text-wine-700">
          ЕТЕРНИУМ
        </Link>
        <nav className={navClassBar} aria-label="Основная навигация">
          <NavInner />
        </nav>
        <div className="flex shrink-0 items-center gap-2">
          {rightSlot !== undefined ? rightSlot : <AuthControls variant="bar" />}
        </div>
      </div>
    </header>
  )
}
