import { Link } from 'react-router-dom'

import { SiteHeader } from '../components/SiteHeader'
import { ROUTE_ENTRY_SEQUENTIAL_AI } from '../lib/routeEntry'
import { useTripStore } from '../store/tripStore'
import heroImage from '../assets/hero.png'
import homeHoverAI from '../assets/home-hover-ai.png'
import homeHoverQuiz from '../assets/home-hover-quiz.png'

export function HomePage() {
  const primeSequentialAiRoute = () => useTripStore.getState().clearRouteSession()
  const leaveSequentialAiForQuiz = () => useTripStore.getState().clearSequentialAiChat()

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-white">
      <div className="relative mx-auto h-[1080px] w-[1920px] max-w-none origin-top-left overflow-x-hidden">
        <img src={heroImage} alt="image 243" className="absolute left-0 top-0 h-[1280px] w-[1920px] object-cover" />
        <div
          className="pointer-events-none absolute left-0 top-[134px] h-[312px] w-[1882px] rounded-full bg-[#040404] blur-[250px]"
          aria-hidden
        />

        <SiteHeader variant="hero" />

        <h1 className="absolute left-1/2 top-[152.4px] w-[1086.85px] -translate-x-1/2 text-center font-['Montserrat'] text-[95px] font-bold uppercase leading-[1.0] tracking-[0.03em] text-[#FCF3B5]">
          ТВОЙ ГОТОВЫЙ
          <br />
          ТУР В 3 КЛИКА
        </h1>

        <p className="absolute left-1/2 top-[400px] w-[830px] max-w-[calc(100vw-2rem)] -translate-x-1/2 text-center font-['Montserrat'] text-[30px] font-medium leading-[100.79%] tracking-[0.03em] text-[#FCF3B4]">
          Перестаньте искать - начните чувствовать
        </p>

        <a
          href="#about"
          className="absolute left-1/2 top-[468px] z-30 max-w-[min(90vw,520px)] -translate-x-1/2 text-center font-['Montserrat'] text-[15px] font-semibold leading-snug tracking-wide text-[#FCF3B4] underline decoration-[#FCF3B4]/50 underline-offset-4 transition hover:text-white hover:decoration-white"
        >
          О нас: что умеет сервис, для кого он и как устроен маршрут — ниже по странице
        </a>

        <div className="group absolute left-[398px] top-[540px] h-[515px] w-[490px]">
          <Link
            to="/route"
            state={{ routeEntry: ROUTE_ENTRY_SEQUENTIAL_AI }}
            onClick={primeSequentialAiRoute}
            aria-label="Перейти к последовательному AI-маршруту"
            className="pointer-events-none absolute inset-0 z-40 rounded-[55px] opacity-0 transition duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:pointer-events-auto group-hover:opacity-100"
          />
          <div className="pointer-events-none absolute inset-0 rounded-[55px] bg-[#fcf3b4]/[0.9] opacity-0 transition duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:opacity-100" />
          <div className="pointer-events-none absolute left-[15px] top-[114px] h-[60px] w-[459px] translate-y-8 overflow-hidden rounded-[14px] opacity-0 transition duration-650 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:translate-y-0 group-hover:opacity-100">
            <img src={homeHoverAI} alt="" className="h-full w-full object-cover" />
          </div>
          <p className="pointer-events-none absolute left-[23px] top-[262px] w-[444px] text-center font-['Montserrat'] text-[38px] font-extrabold leading-[1.02] tracking-[0.02em] text-[#595959] opacity-0 [text-shadow:0_2px_10px_rgba(252,243,180,0.45)] group-hover:opacity-100">
            AI-ассистент
            <br />
            поможет собрать
            <br />
            последовательный
            <br />
            маршрут под вас
          </p>
          <Link
            to="/route"
            state={{ routeEntry: ROUTE_ENTRY_SEQUENTIAL_AI }}
            onClick={primeSequentialAiRoute}
            className="absolute left-0 top-[378px] flex h-[135px] w-[490px] items-center justify-center rounded-[55px] bg-[#fcf3b4]/[0.86] px-8 text-center font-['Montserrat'] text-[35px] font-bold leading-[100.79%] tracking-[0.03em] text-[#595959] hover:brightness-110 group-hover:pointer-events-none group-hover:opacity-0"
          >
            Последовательный
            <br />
            тур с AI
          </Link>
        </div>

        <div className="group absolute left-[987px] top-[538px] h-[515px] w-[490px]">
          <Link
            to="/quiz"
            onClick={leaveSequentialAiForQuiz}
            aria-label="Перейти к опросу"
            className="pointer-events-none absolute inset-0 z-40 rounded-[55px] opacity-0 transition duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:pointer-events-auto group-hover:opacity-100"
          />
          <div className="pointer-events-none absolute inset-0 rounded-[55px] bg-[#fcf3b4]/[0.9] opacity-0 transition duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:opacity-100" />
          <div className="pointer-events-none absolute left-[73px] top-[68px] h-[204px] w-[343px] translate-y-8 overflow-hidden rounded-[37px] opacity-0 transition duration-650 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:translate-y-0 group-hover:opacity-100">
            <img src={homeHoverQuiz} alt="" className="h-full w-full object-cover" />
          </div>
          <p className="pointer-events-none absolute left-[23px] top-[300px] w-[444px] text-center font-['Montserrat'] text-[38px] font-extrabold leading-[1.02] tracking-[0.02em] text-[#595959] opacity-0 [text-shadow:0_2px_10px_rgba(252,243,180,0.45)] group-hover:opacity-100">
            Короткий опрос
            <br />
            из 5 вопросов
            <br />
            подберет для вас
            <br />
            идеальный маршрут
          </p>
          <Link
            to="/quiz"
            onClick={leaveSequentialAiForQuiz}
            className="absolute left-[6px] top-[380px] flex h-[135px] w-[490px] items-center justify-center rounded-[55px] bg-[#fcf3b4]/[0.86] px-8 text-center font-['Montserrat'] text-[35px] font-bold leading-[100.79%] tracking-[0.03em] text-[#595959] hover:brightness-110 group-hover:pointer-events-none group-hover:opacity-0"
          >
            Тур на основе ваших
            <br />
            предпочтений
          </Link>
        </div>

        <a
          href="#about"
          className="absolute bottom-6 left-1/2 z-30 flex -translate-x-1/2 flex-col items-center gap-1 font-['Montserrat'] text-sm font-bold tracking-wide text-[#FCF3B4] transition hover:text-white"
        >
          <span className="rounded-full border border-[#FCF3B4]/50 bg-black/30 px-5 py-2.5 backdrop-blur-sm">
            Раздел «О нас» — прокрутите вниз или нажмите здесь
          </span>
          <span className="text-lg motion-safe:animate-bounce" aria-hidden>
            ↓
          </span>
        </a>
      </div>

      <section
        id="about"
        className="scroll-mt-24 border-t border-stone-200/80 bg-gradient-to-b from-[#faf7f2] to-white px-6 py-20 font-['Montserrat'] text-stone-800"
      >
        <div className="mx-auto max-w-4xl">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-wine-700/90">О нас</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-wine-950 md:text-4xl">
            Етерниум — сервис готовых винных маршрутов по Кубани
          </h2>
          <p className="mt-6 text-lg leading-relaxed text-stone-700">
            Мы делаем так, чтобы не тратить вечер на бесконечные вкладки и таблицы. Вы выбираете формат — короткий опрос
            или пошаговый разговор с ИИ — а мы предлагаем цепочку виноделен и сервисных точек на карте, с подсказками по
            погоде и ориентиром по бюджету. Каталог мест опирается на открытые данные и аккуратно сверённые координаты;
            окончательные цены и бронирование всегда уточняйте у самой винодельни.
          </p>

          <h3 className="mt-12 text-xl font-bold text-wine-900">Что вы можете сделать на сайте</h3>
          <ul className="mt-5 grid gap-4 sm:grid-cols-2">
            {[
              {
                t: 'Маршрут по опросу',
                d: 'Ответьте на вопросы о компании, настроении, длительности и бюджете — мы подберём винодельни с учётом ваших рамок и дат поездки.',
              },
              {
                t: 'Последовательный тур с ИИ',
                d: 'Соберите маршрут шаг за шагом: сначала первая точка, затем добавляйте остановки с карты или из подсказок ассистента.',
              },
              {
                t: 'Карта и навигация',
                d: 'Все остановки на Яндекс.Картах, линия по дорогам от выбранной точки «откуда едем», ссылки в навигатор по отрезкам.',
              },
              {
                t: 'ИИ-сомелье',
                d: 'Три коротких вопроса о вине и цели визита — и подборка виноделен с объяснением; понравившееся можно сразу добавить в маршрут.',
              },
              {
                t: 'Каталог винодельен',
                d: 'Раздел «Винодельни» — список точек с фото и ориентиром по типичной стоимости визита (оценка для фильтра, не оферта).',
              },
              {
                t: 'Сохранить и вернуться',
                d: 'После сборки маршрута в адресе появляется ссылка с ?route=… — откройте её в том же браузере, чтобы продолжить с того же плана.',
              },
            ].map((item) => (
              <li
                key={item.t}
                className="rounded-2xl border border-stone-200/90 bg-white/80 p-5 shadow-sm ring-1 ring-stone-100/80"
              >
                <p className="font-bold text-wine-950">{item.t}</p>
                <p className="mt-2 text-sm leading-relaxed text-stone-600">{item.d}</p>
              </li>
            ))}
          </ul>

          <h3 className="mt-12 text-xl font-bold text-wine-900">Для кого это</h3>
          <p className="mt-4 leading-relaxed text-stone-700">
            Для путешественников, которые хотят за один вечер спланировать выходные или отпуск по винным точкам Краснодарского
            края и соседних регионов, не разбираясь в десятках сайтов вручную. Для команд и друзей, которым важно согласовать
            ритм поездки — от спокойной дегустации до насыщенного маршрута.
          </p>

          <p className="mt-10 rounded-2xl border border-wine-200/60 bg-wine-50/50 px-5 py-4 text-sm leading-relaxed text-wine-950/90">
            <strong className="font-semibold">Честно о продукте.</strong> Сервис развивается как демонстрационная платформа
            (хакатон / прототип): расстояния между точками считаются по прямой для подбора порядка остановок, тексты маршрута
            и сомелье могут идти через облачные модели или запасной сценарий без них. Мы улучшаем логику и контент по мере
            развития проекта.
          </p>

          <div className="mt-10 flex flex-wrap gap-3">
            <Link
              to="/quiz"
              onClick={leaveSequentialAiForQuiz}
              className="inline-flex items-center justify-center rounded-full bg-wine-800 px-6 py-3 text-sm font-bold uppercase tracking-wide text-white shadow-md transition hover:bg-wine-900"
            >
              Собрать маршрут
            </Link>
            <Link
              to="/places"
              className="inline-flex items-center justify-center rounded-full border border-wine-300 bg-white px-6 py-3 text-sm font-bold uppercase tracking-wide text-wine-900 transition hover:bg-wine-50"
            >
              Каталог винодельен
            </Link>
          </div>
        </div>
      </section>
      <section id="contact" className="border-t border-stone-200 bg-stone-50 px-6 py-16 scroll-mt-24">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-2xl font-bold text-wine-900">Контакты</h2>
          <p className="mt-4 text-stone-700">
            Вопросы по сервису — через форму обратной связи (демо). Для бронирований обращайтесь напрямую в
            выбранную винодельню.
          </p>
        </div>
      </section>
      <section id="faq" className="mx-auto max-w-3xl scroll-mt-24 px-6 py-16">
        <h2 className="text-2xl font-bold text-wine-900">FAQ</h2>
        <dl className="mt-6 space-y-6">
          <div>
            <dt className="font-semibold text-wine-950">Нужен ли ключ Яндекс.Карт?</dt>
            <dd className="mt-2 text-stone-600">
              Для отображения карты в режиме разработки задайте <code className="rounded bg-stone-100 px-1">VITE_YANDEX_MAPS_API_KEY</code> в{' '}
              <code className="rounded bg-stone-100 px-1">frontend/.env</code>.
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-wine-950">Как сохранить маршрут?</dt>
            <dd className="mt-2 text-stone-600">
              После сборки маршрута скопируйте адрес страницы с параметром <code className="rounded bg-stone-100 px-1">?route=…</code> — при
              открытии в том же браузере маршрут подтянется снова.
            </dd>
          </div>
        </dl>
      </section>
    </div>
  )
}
