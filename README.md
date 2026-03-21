# Turizm — маршруты по винодельням Краснодарского края

Каркас сервиса для хакатона: сбор предпочтений (теги + сигналы с клиента), построение маршрута с учётом погоды, текст от Yandex LLM (или локальный fallback), **карта Яндекс.Карт** (подсказка при наведении, клик открывает карточку места в Swiper).

## Стек

| Слой | Технологии |
|------|------------|
| Backend | **Go 1.22+** (chi, pgx, JWT, bcrypt), HTTP API совместим с прежним контрактом |
| DB | PostgreSQL 16 в Docker; схема таблиц совместима с миграциями Django (`places_place`, `trips_routeplan`, …) |
| Frontend | React (Vite), React Router, Tailwind, Zustand, Яндекс.Карты API 2.1, Swiper |

## Быстрый старт

### Backend (Go)

Нужен установленный [Go 1.22+](https://go.dev/dl/) и PostgreSQL (или только Docker для БД).

```bash
cd server
go run ./cmd/turizm
```

Переменные: `DATABASE_URL` или `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`; `JWT_SECRET` (или `DJANGO_SECRET_KEY` как запасной секрет); `CORS_ALLOWED_ORIGINS`; опционально `YANDEX_CLOUD_FOLDER_ID`, `YANDEX_IAM_TOKEN`.

При старте выполняется SQL-миграция `internal/store/sql_migrations/`; если нет опубликованных виноделен — автоматический `seed`.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Откройте `http://localhost:5173` — запросы к API проксируются на `http://127.0.0.1:8000` (см. `frontend/vite.config.js`). Для cookie `turizm_vid` важно ходить на API **с того же хоста**, что и фронт (через proxy в dev это так).

**Яндекс.Карты:** в [кабинете разработчика](https://developer.tech.yandex.ru/services/) создайте ключ для *JavaScript API и HTTP Геокодер*, скопируйте в `frontend/.env` как `VITE_YANDEX_MAPS_API_KEY=...` и перезапустите `npm run dev`. Без ключа скрипт карт может не загрузиться (зависит от квот и политики Яндекса).

## Docker (весь стек)

Поднимаются **PostgreSQL 16**, **Go backend**, **Nginx** (отдаёт собранный React и проксирует `/api/` на бэкенд).  
Имя стека в **Docker Desktop**: `turizm`. Подробно: [docs/DOCKER_DESKTOP.md](docs/DOCKER_DESKTOP.md).

```bash
# из корня репозитория (рядом с docker-compose.yml)
copy .env.docker.example .env   # Windows; на Linux: cp — и при необходимости отредактируйте
docker compose up --build
```

Откройте **http://localhost:8080** — фронт и API с **одного origin** (как в dev через Vite proxy), cookie `turizm_vid` работает штатно.

Переменные (см. `.env.docker.example`): `VITE_YANDEX_MAPS_API_KEY` подставляется **на этапе сборки** образа `web`; после смены ключа выполните `docker compose build web --no-cache`. После любых изменений в коде `frontend/` тоже нужна пересборка `web`, иначе откроется старая версия UI (например, без обновлённых виджетов).

**Если в браузере «ничего не изменилось» после правок UI:** вы смотрите **старый билд внутри образа `web`**, либо **`docker compose build web` падал с ошибкой** (тогда Docker оставляет предыдущий образ — UI не меняется). На **Alpine** у Vite 8 бывает ошибка `Cannot find module '@rolldown/binding-linux-x64-musl'`; в этом проекте стадия сборки фронта в `docker/web/Dockerfile` использует **`node:22-bookworm-slim`**. Пошагово: [docs/ЕСЛИ_UI_НЕ_МЕНЯЕТСЯ.md](docs/ЕСЛИ_UI_НЕ_МЕНЯЕТСЯ.md).

Из корня репозитория:

- **Windows (PowerShell):** `.\rebuild-web.ps1`
- **Вручную:** `docker compose build web --no-cache` затем `docker compose up -d web --force-recreate`

После этого — жёсткое обновление страницы (**Ctrl+F5**). Для проверки: в инспекторе у плавающей кнопки сомелье на `/route` есть атрибут `data-turizm-sommelier-fab`.

При первом старте Go-backend сам наполняет демо-точками БД, если нет опубликованных виноделен.

Полезно: `docker compose logs -f backend`, проверка API: `curl http://localhost:8080/api/places/`, остановка — `docker compose down` (том `postgres_data` сохраняет БД).

## API (черновик)

Подробная документация с примерами: [docs/API.md](docs/API.md).

| Метод | Путь | Назначение |
|--------|------|------------|
| POST | `/api/places/sommelier/recommend/` | Виртуальный сомелье: `wine_type`, `wine_style`, `visit_goal` → подбор виноделен (Yandex AI или fallback) |
| GET | `/api/places/` | Список опубликованных мест |
| GET | `/api/places/<uuid>/` | Детали места |
| POST | `/api/profile/collect/` | Слияние сигналов в профиль по cookie |
| POST | `/api/profile/register/` | Регистрация пользователя + JWT |
| POST | `/api/token/` | Получение JWT |
| POST | `/api/routes/build/` | Построение маршрута по тегам |
| PATCH | `/api/routes/<uuid>/` | `add_place_ids` / `remove_place_ids`, пересчёт порядка и текста |

Тело `build`: `companions_tags`, `mood_tags`, `duration_tags`, `extra_tags`, опционально `include_place_ids`, `exclude_place_ids`, `max_stops`.

## Логика маршрута

- **Радиус пула** `route_radius_km` (по умолчанию 55): в маршрут попадают только винодельни не дальше этого расстояния от старта (Краснодар). Если в радиусе пусто, радиус временно удваивается.
- **Короткие переезды** `max_leg_km` (по умолчанию 22): после первой винодельни каждая следующая — не дальше `max_leg_km` от предыдущей (жадный ближайший сосед среди допустимых). Первый выезд из города до первой винодельни **без** этого ограничения — только ближайшая из пула.
- **Винодельни** внутри пула: минимальное расстояние, при равенстве — бонус за теги и погоду.
- **Жильё / питание / трансфер** выбираются среди точек **рядом с центром кластера** виноделен (не из другого конца края). Демо: встроенный seed в Go — компактный кластер; старые «дальние» демо помечаются `published=false`.
- В ответе API поле `route.legs` — расстояния по прямой между соседними точками.
- Категории точек: `winery`, `lodging`, `food`, `transfer` (модель `Place`).

Параметры тела `POST /api/routes/build/`: при необходимости передайте `route_radius_km` и `max_leg_km`.

## Погода и LLM

- Погода (Go): `server/internal/weather/weather.go` — Open-Meteo.
- Текст маршрута и сомелье (Go): `server/internal/llm/` — Yandex Foundation Models или fallback.

## Подключение вашей PostgreSQL + PostGIS

Go backend использует обычный PostgreSQL-драйвер (`pgx`) и не зависит от Django GIS.  
Для своей БД достаточно настроить `DB_*` или `DATABASE_URL`; при старте сервис сам применит SQL-схему.

## Публикация контента винодельнями

Сейчас демо-данные наполняются встроенным seed'ом. Для прод-сценария можно добавить JWT-защищённый CRUD в Go API.

## Юридическое

Сбор данных через cookie и `collect` — заложите в политику конфиденциальности согласие пользователя (хакатон/прод).
