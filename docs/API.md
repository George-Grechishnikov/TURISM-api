# API документация TURIZM

Актуально для Go backend из `server/` (роуты из `server/internal/api/router.go`).

## База

- Dev: `http://127.0.0.1:8000`
- Docker (через nginx): `http://localhost:8080`
- Формат: `application/json`
- Версия API: без префикса версии, все пути начинаются с `/api/...`

## Общие правила

- Большинство ответов возвращают JSON-объекты или массивы.
- Ошибки отдаются в формате:

```json
{ "detail": "текст ошибки" }
```

- Middleware автоматически ставит cookie посетителя (`turizm_vid` по умолчанию).
  Это важно для маршрутов и сбора сигналов.

## Аутентификация

- JWT используется для пользовательских сценариев (регистрация/логин/refresh).
- В текущем API большинство эндпоинтов не требуют `Authorization` заголовок.
- Токены выдаются через:
  - `POST /api/profile/register/`
  - `POST /api/token/`
  - `POST /api/token/refresh/`

## Health-check

### `GET /health`

Проверка, что backend поднят.

**Ответ 200**

```json
{ "status": "ok" }
```

---

## Places

### `GET /api/places/`

Список опубликованных мест.

**Ответ 200** (массив)

```json
[
  {
    "id": "uuid",
    "name": "Название",
    "slug": "slug",
    "latitude": 45.0,
    "longitude": 38.9,
    "region": "Краснодарский край",
    "category": "winery",
    "is_winery": true,
    "short_description": "Короткое описание",
    "tags": ["tag1", "tag2"],
    "photo_urls": ["https://..."],
    "video_url": null
  }
]
```

### `GET /api/places/{id}/`

Детали опубликованного места.

**Параметры**
- `id` — UUID места

**Ответ 200**

```json
{
  "id": "uuid",
  "name": "Название",
  "slug": "slug",
  "latitude": 45.0,
  "longitude": 38.9,
  "region": "Краснодарский край",
  "category": "winery",
  "is_winery": true,
  "short_description": "Короткое описание",
  "full_description": "Полное описание",
  "tags": ["tag1", "tag2"],
  "photo_urls": ["https://..."],
  "video_url": null,
  "created_at": "2026-03-21T10:00:00Z",
  "updated_at": "2026-03-21T10:00:00Z"
}
```

**Ошибки**
- `400` — некорректный UUID
- `404` — место не найдено

### `POST /api/places/sommelier/recommend/`

Виртуальный сомелье: подбирает винодельни по предпочтениям.

**Body**

```json
{
  "wine_type": "red",
  "wine_style": "dry",
  "visit_goal": "tasting"
}
```

**Допустимые значения**
- `wine_type`: `red`, `white`, `sparkling`
- `wine_style`: `fruity`, `aged`, `dry`
- `visit_goal`: `tasting`, `tour`, `purchase`

**Ответ 200**

```json
{
  "explanation": "Под ваш запрос ...",
  "recommendations": [
    {
      "place_id": "uuid",
      "name": "Винодельня",
      "reason": "Почему подходит"
    }
  ],
  "used_ai": true
}
```

`used_ai` показывает, сработал ли Yandex LLM, либо использован fallback.

---

## Routes

### `POST /api/routes/build/`

Строит маршрут и сохраняет его за текущим visitor (по cookie).

**Body**

```json
{
  "companions_tags": ["friends"],
  "mood_tags": ["relax"],
  "duration_tags": ["weekend"],
  "extra_tags": ["tasting"],
  "include_place_ids": ["uuid"],
  "exclude_place_ids": ["uuid"],
  "max_stops": 6,
  "route_radius_km": 55,
  "max_leg_km": 22,
  "start_date": "2026-03-22",
  "end_date": "2026-03-24"
}
```

**Важные ограничения**
- `max_stops`: от `1` до `20` (иначе дефолт `6`)
- `route_radius_km`: от `10` до `200` (иначе дефолт `55`)
- `max_leg_km`: от `5` до `120` (иначе дефолт `22`)

**Ответ 201**

```json
{
  "route": {
    "id": "uuid",
    "visitor_id": "uuid",
    "companions_tags": ["friends"],
    "mood_tags": ["relax"],
    "duration_tags": ["weekend"],
    "extra_tags": ["tasting"],
    "ordered_place_ids": ["uuid1", "uuid2"],
    "legs": [
      { "from_place_id": "uuid1", "to_place_id": "uuid2", "distance_km": 12.3 }
    ],
    "llm_narrative": "Текст маршрута ...",
    "weather_snapshot": {
      "weather_mode": "good",
      "is_bad_outdoor": false
    },
    "created_at": "2026-03-21T10:00:00Z",
    "updated_at": "2026-03-21T10:00:00Z"
  },
  "places": [
    {
      "id": "uuid",
      "name": "Винодельня",
      "category": "winery",
      "weather_fit": 0.92
    }
  ]
}
```

**Ошибки**
- `400` — неверный JSON или невозможно собрать маршрут
- `500` — ошибка БД

### `PATCH /api/routes/{routeID}/`

Редактирует существующий маршрут: добавление/удаление мест, пересчет порядка,
legs и narrative.

**Body**

```json
{
  "add_place_ids": ["uuid_to_add"],
  "remove_place_ids": ["uuid_to_remove"]
}
```

**Ответ 200**  
Формат такой же, как у `POST /api/routes/build/` (`route` + `places`).

**Ошибки**
- `400` — некорректный `routeID` или JSON
- `404` — маршрут не найден для текущего visitor

---

## Profile

### `POST /api/profile/collect/`

Сбор и объединение клиентских сигналов в профиль visitor.

Можно передавать либо объект `signals`, либо произвольный JSON напрямую.

**Вариант 1**

```json
{
  "signals": {
    "language": "ru-RU",
    "timezone": "Europe/Moscow",
    "screen": "1920x1080",
    "referrer": null
  }
}
```

**Вариант 2**

```json
{
  "language": "ru-RU",
  "timezone": "Europe/Moscow"
}
```

**Ответ 200**

```json
{
  "visitor_id": "uuid",
  "signals": {
    "language": "ru-RU",
    "timezone": "Europe/Moscow"
  }
}
```

### `POST /api/profile/register/`

Регистрация пользователя + выдача пары JWT.

**Body**

```json
{
  "username": "demo",
  "password": "secret123"
}
```

**Условия**
- `username` обязателен
- `password` минимум 6 символов

**Ответ 201**

```json
{
  "user_id": "uuid",
  "username": "demo",
  "access": "jwt_access_token",
  "refresh": "jwt_refresh_token"
}
```

---

## Auth

### `POST /api/token/`

Логин по username/password.

**Body**

```json
{
  "username": "demo",
  "password": "secret123"
}
```

**Ответ 200**

```json
{
  "access": "jwt_access_token",
  "refresh": "jwt_refresh_token"
}
```

**Ошибки**
- `401` — неверные учетные данные

### `POST /api/token/refresh/`

Обновление access токена по refresh токену.

**Body**

```json
{
  "refresh": "jwt_refresh_token"
}
```

**Ответ 200**

```json
{
  "access": "jwt_access_token"
}
```

**Ошибки**
- `401` — refresh невалиден

---

## Примеры curl

### Получить места

```bash
curl http://127.0.0.1:8000/api/places/
```

### Построить маршрут

```bash
curl -X POST http://127.0.0.1:8000/api/routes/build/ \
  -H "Content-Type: application/json" \
  -d '{"companions_tags":["friends"],"mood_tags":["relax"],"duration_tags":["weekend"],"extra_tags":["tasting"]}'
```

### Логин

```bash
curl -X POST http://127.0.0.1:8000/api/token/ \
  -H "Content-Type: application/json" \
  -d '{"username":"demo","password":"secret123"}'
```

