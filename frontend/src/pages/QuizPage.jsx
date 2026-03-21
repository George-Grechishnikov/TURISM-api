import { useEffect, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTripStore } from '../store/tripStore'

const COMPANIONS = ['Семья', 'Один', 'Пара', 'Коллеги', 'Друзья']
const MOOD = ['Романтика', 'Гастрономия', 'Активно', 'Спокойно', 'Исследование']
const DURATION = ['День', 'Два дня', 'Неделя', 'Три дня', 'Выходные']
const EXTRA = [
  'Дегустации',
  'Фотостопы',
  'Живописно',
  'Без спешки',
  'Уютные места',
  'Локальная кухня',
  'С детьми',
  'Трансфер',
]

export function QuizPage() {
  const navigate = useNavigate()
  const {
    companionsTags,
    moodTags,
    durationTags,
    extraTags,
    budgetMin,
    budgetMax,
    toggleTag,
    setTags,
    setBudget,
    buildRoute,
    loading,
    error,
  } = useTripStore()

  const canSubmit = companionsTags.length && moodTags.length && durationTags.length
  const budgetReady = budgetMin <= budgetMax
  const leftSliderMax = Math.max(5000, budgetMax - 5000)
  const rightSliderMin = Math.min(1000000, budgetMin + 5000)

  const extraRows = useMemo(() => {
    const chunked = []
    for (let i = 0; i < EXTRA.length; i += 3) chunked.push(EXTRA.slice(i, i + 3))
    return chunked
  }, [])

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [])

  async function onSubmit(e) {
    e.preventDefault()
    if (!canSubmit || !budgetReady) return
    try {
      await buildRoute()
      navigate('/route')
    } catch {
      /* store держит error */
    }
  }

  function toggleSingle(field, selected, tag) {
    if (selected.includes(tag)) {
      setTags(field, [])
      return
    }
    setTags(field, [tag])
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-white p-2 font-['Montserrat']">
      <main className="relative mx-auto h-[1658px] w-[1920px] rounded-[77px] bg-white">
        <h1 className="absolute left-[115px] top-[40px] w-[1166px] text-[110px] font-bold leading-[89%] tracking-[0.03em] text-black">
          Собери тур
          <br />
          за 3 шага
        </h1>

        <div className="absolute left-[1393px] top-[62px] h-[86px] w-[86px] rounded-full bg-black" />
        <p className="absolute left-[1490px] top-[88px] text-[35px] font-semibold leading-[89%] tracking-[0.03em] text-black">Профиль</p>
        <div className="absolute left-[1393px] top-[158px] h-0 w-[397px] border-[4px] border-[#343631]" />

        <form onSubmit={onSubmit}>
          <section className="absolute left-[calc(50%_-_860px)] top-[275px] h-[467px] w-[786px] rounded-[75px] border border-white/55 bg-[linear-gradient(180deg,#ffd2d7_0%,#ffc4c9_100%)] shadow-[0_20px_45px_rgba(177,32,47,0.12)]">
            <h2 className="absolute left-[62px] top-[56px] text-[50px] font-semibold leading-[89%] tracking-[0.03em] text-black">С кем</h2>
            <p className="absolute left-[62px] top-[119px] w-[470px] text-[30px] font-medium leading-[89%] tracking-[0.03em] text-black">
              Выберите формат компании для поездки
            </p>
            <div className="absolute left-[47px] top-[263px] flex w-[690px] flex-wrap gap-[18px]">
              {COMPANIONS.map((tag) => (
                <TagChip
                  key={tag}
                  selected={companionsTags.includes(tag)}
                  onClick={() => toggleSingle('companionsTags', companionsTags, tag)}
                  label={tag}
                  fixed
                />
              ))}
            </div>
          </section>

          <section className="absolute left-[calc(50%_-_6px)] top-[275px] h-[467px] w-[786px] rounded-[75px] border border-white/55 bg-[linear-gradient(180deg,#ffd2d7_0%,#ffc4c9_100%)] shadow-[0_20px_45px_rgba(177,32,47,0.12)]">
            <h2 className="absolute left-[42px] top-[54px] text-[50px] font-semibold leading-[89%] tracking-[0.03em] text-black">Настроение</h2>
            <p className="absolute left-[42px] top-[106px] w-[560px] text-[30px] font-medium leading-[89%] tracking-[0.03em] text-black">
              Отметьте желаемый ритм и стиль впечатлений
            </p>
            <div className="absolute left-[42px] top-[260px] flex w-[720px] flex-wrap gap-[19px]">
              {MOOD.map((tag) => (
                <TagChip
                  key={tag}
                  selected={moodTags.includes(tag)}
                  onClick={() => toggleSingle('moodTags', moodTags, tag)}
                  label={tag}
                  fixed
                />
              ))}
            </div>
          </section>

          <section className="absolute left-[calc(50%_-_860px)] top-[781px] h-[467px] w-[786px] rounded-[75px] border border-white/55 bg-[linear-gradient(180deg,#ffd2d7_0%,#ffc4c9_100%)] shadow-[0_20px_45px_rgba(177,32,47,0.12)]">
            <h2 className="absolute left-[62px] top-[51px] text-[50px] font-semibold leading-[89%] tracking-[0.03em] text-black">Срок</h2>
            <p className="absolute left-[62px] top-[95px] w-[470px] text-[30px] font-medium leading-[89%] tracking-[0.03em] text-black">
              Выберите длительность вашего маршрута
            </p>
            <div className="absolute left-[41px] top-[234px] flex w-[690px] flex-wrap gap-[18px]">
              {DURATION.map((tag) => (
                <TagChip
                  key={tag}
                  selected={durationTags.includes(tag)}
                  onClick={() => toggleSingle('durationTags', durationTags, tag)}
                  label={tag}
                  fixed
                />
              ))}
            </div>
          </section>

          <section className="absolute left-[calc(50%_-_6px)] top-[781px] h-[467px] w-[786px] rounded-[75px] border border-white/65 bg-[linear-gradient(180deg,#fff0f2_0%,#ffe7e9_100%)] shadow-[0_20px_45px_rgba(177,32,47,0.08)]">
            <h2 className="absolute left-[42px] top-[54px] text-[50px] font-semibold leading-[89%] tracking-[0.03em] text-black">Дополнительно</h2>
            <div className="absolute left-[30px] top-[153px] w-[730px] space-y-[11px]">
              {extraRows.map((row, idx) => (
                <div key={idx} className="flex gap-[12px]">
                  {row.map((tag) => (
                    <TagChip
                      key={tag}
                      selected={extraTags.includes(tag)}
                      onClick={() => toggleTag('extraTags', tag)}
                      label={tag}
                      fixed
                      extra
                    />
                  ))}
                </div>
              ))}
            </div>
          </section>

          <div className="absolute left-[151px] top-[1354px] flex h-[64px] w-[209px] items-center justify-center rounded-[27px] bg-[#B1202F] text-[20px] font-bold leading-[100.79%] tracking-[0.03em] text-white">
            От {budgetMin.toLocaleString('ru-RU')} руб
          </div>
          <div className="absolute left-[608px] top-[1354px] flex h-[64px] w-[209px] items-center justify-center rounded-[27px] bg-[#B1202F] text-[20px] font-bold leading-[100.79%] tracking-[0.03em] text-white">
            До {budgetMax.toLocaleString('ru-RU')}
          </div>

          <div className="absolute left-[152px] top-[1461px] h-[30px] w-[712px] rounded-[15px] bg-[#FFC4C9]" />
          <input
            type="range"
            min={5000}
            max={leftSliderMax}
            step={5000}
            value={budgetMin}
            onChange={(e) => setBudget(Number(e.target.value), budgetMax)}
            className="absolute left-[152px] top-[1476px] z-20 h-0 w-[712px] -translate-y-1/2 appearance-none bg-transparent [&::-webkit-slider-thumb]:h-[66px] [&::-webkit-slider-thumb]:w-[66px] [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-[11px] [&::-webkit-slider-thumb]:border-[#B12030] [&::-webkit-slider-thumb]:bg-white"
          />
          <input
            type="range"
            min={rightSliderMin}
            max={1000000}
            step={5000}
            value={budgetMax}
            onChange={(e) => setBudget(budgetMin, Number(e.target.value))}
            className="absolute left-[152px] top-[1476px] z-30 h-0 w-[712px] -translate-y-1/2 appearance-none bg-transparent [&::-webkit-slider-thumb]:h-[66px] [&::-webkit-slider-thumb]:w-[66px] [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-[11px] [&::-webkit-slider-thumb]:border-[#B12030] [&::-webkit-slider-thumb]:bg-white"
          />
          <p className="absolute left-[166px] top-[1499px] text-[20px] font-bold leading-[100.79%] tracking-[0.03em] text-black">min</p>
          <p className="absolute left-[807px] top-[1499px] text-[20px] font-bold leading-[100.79%] tracking-[0.03em] text-black">max</p>

          <button
            type="submit"
            disabled={!canSubmit || !budgetReady || loading}
            className="absolute left-[1153px] top-[1431px] h-[106px] w-[671px] rounded-[53px] bg-[linear-gradient(180deg,#1f2328_0%,#07090c_100%)] text-[50px] font-semibold uppercase leading-[100.79%] tracking-[0.03em] text-white shadow-[0_18px_40px_rgba(0,0,0,0.32)] transition hover:brightness-110 disabled:pointer-events-none disabled:opacity-40"
          >
            {loading ? 'Строим...' : 'Поехали'}
          </button>

          {error && (
            <p className="absolute left-[132px] top-[1575px] rounded-2xl border border-red-300 bg-red-50 px-5 py-3 text-[18px] text-red-800" role="alert">
              {error}
            </p>
          )}

          {!budgetReady && (
            <p className="absolute left-[132px] top-[1575px] text-[18px] font-semibold text-red-700">
              Минимальный бюджет не может быть больше максимального.
            </p>
          )}
        </form>

        <Link to="/" className="absolute left-[132px] top-[1615px] text-base font-medium text-stone-500 transition hover:text-black">
          ← На главную
        </Link>
      </main>
    </div>
  )
}

function TagChip({ selected, onClick, label, fixed, extra }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-[61px] rounded-[53px] px-9 text-[22px] font-bold leading-[89%] tracking-[0.03em] transition duration-200 hover:-translate-y-[1px] ${
        fixed ? (extra ? 'w-[230px] px-4' : 'min-w-[159px]') : 'min-w-[159px]'
      } ${
        selected
          ? 'bg-[#C2000D]/[0.86] text-[#FFF7F7] shadow-[0_10px_22px_rgba(194,0,13,0.28)]'
          : 'bg-white/90 text-black shadow-[0_6px_14px_rgba(0,0,0,0.08)]'
      }`}
    >
      {label}
    </button>
  )
}
