import { Link, useNavigate } from 'react-router-dom'

import { TagCloud } from '../components/TagCloud'
import { useTripStore } from '../store/tripStore'

const COMPANIONS = ['Семья', 'Пара', 'Друзья', 'Соло', 'Коллеги']
const MOOD = ['Спокойно', 'Романтика', 'Активно', 'Гастрономия', 'Исследование']
const DURATION = ['На день', 'Выходные', 'Неделя', 'Только вечер']
const EXTRA = [
  'Развлечения для детей',
  'Подальше от города',
  'Ближе к горам',
  'Ближе к морю',
  'Бюджетно',
  'Премиум',
  'Экскурсии с гидом',
  'Без алкоголя за рулём',
]

export function QuizPage() {
  const navigate = useNavigate()
  const {
    companionsTags,
    moodTags,
    durationTags,
    extraTags,
    toggleTag,
    buildRoute,
    loading,
    error,
  } = useTripStore()

  const canSubmit = companionsTags.length && moodTags.length && durationTags.length

  async function onSubmit(e) {
    e.preventDefault()
    if (!canSubmit) return
    try {
      await buildRoute()
      navigate('/route')
    } catch {
      /* store держит error */
    }
  }

  return (
    <div className="min-h-screen bg-[#faf7f2] bg-mesh-quiz">
      <header className="sticky top-0 z-20 border-b border-stone-200/60 bg-[#fdfcfa]/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-4 px-4 py-3.5">
          <Link
            to="/"
            className="text-sm font-medium text-stone-500 transition hover:text-wine-800"
          >
            ← На главную
          </Link>
          <span className="font-display text-sm font-semibold tracking-tight text-wine-900">Turizm</span>
          <span className="w-[5.5rem]" aria-hidden />
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 pb-16 pt-8 sm:px-6">
        <div className="rounded-3xl border border-stone-200/80 bg-white/70 p-6 shadow-card sm:p-8">
          <h1 className="font-display text-2xl font-semibold text-wine-950 sm:text-3xl">
            Ваш идеальный день
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-stone-600">
            Отметьте теги в каждом блоке — так мы поймём ритм поездки. Дополнительные пожелания по желанию.
          </p>

          <form onSubmit={onSubmit} className="mt-8 space-y-9">
            <TagCloud
              label="С кем едете?"
              tags={COMPANIONS}
              selected={companionsTags}
              onToggle={(t) => toggleTag('companionsTags', t)}
            />
            <TagCloud
              label="Настроение?"
              tags={MOOD}
              selected={moodTags}
              onToggle={(t) => toggleTag('moodTags', t)}
            />
            <TagCloud
              label="Срок?"
              tags={DURATION}
              selected={durationTags}
              onToggle={(t) => toggleTag('durationTags', t)}
            />
            <TagCloud
              label="Дополнительно"
              hint="по желанию"
              tags={EXTRA}
              selected={extraTags}
              onToggle={(t) => toggleTag('extraTags', t)}
            />

            {error && (
              <p className="rounded-2xl border border-red-200/80 bg-red-50/90 px-4 py-3 text-sm text-red-800" role="alert">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={!canSubmit || loading}
              className="btn-primary w-full py-4 text-[15px] disabled:pointer-events-none disabled:opacity-45"
            >
              {loading ? 'Строим маршрут…' : 'Показать маршрут на карте'}
            </button>
          </form>
        </div>
      </main>
    </div>
  )
}
