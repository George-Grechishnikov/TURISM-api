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
    <div className="relative min-h-screen overflow-hidden bg-white">
      <div className="relative mx-auto h-[1080px] w-[1920px] max-w-none origin-top-left overflow-hidden">
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

        <p className="absolute left-1/2 top-[400px] w-[830px] -translate-x-1/2 text-center font-['Montserrat'] text-[30px] font-medium leading-[100.79%] tracking-[0.03em] text-[#FCF3B4]">
          Перестаньте искать - начните чувствовать
        </p>

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
      </div>

      <section id="about" className="mx-auto max-w-3xl scroll-mt-24 px-6 py-16 text-stone-800">
        <h2 className="text-2xl font-bold text-wine-900">О нас</h2>
        <p className="mt-4 leading-relaxed">
          Етерниум помогает собрать винный маршрут по Краснодарскому краю: короткий опрос, карта с остановками и
          подсказки с учётом погоды. Данные о точках обновляются из каталога виноделен.
        </p>
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
