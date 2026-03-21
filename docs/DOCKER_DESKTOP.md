# Проект и Docker Desktop

Стек описан в `docker-compose.yml` в **корне репозитория**. Docker Desktop использует тот же **Docker Engine**, что и команда `docker compose` в терминале: достаточно один раз настроить Desktop и запускать compose из папки проекта.

## 1. Установка и запуск Docker Desktop

1. Установите [Docker Desktop for Windows](https://docs.docker.com/desktop/install/windows-install/) (или macOS/Linux по аналогии).
2. Запустите **Docker Desktop** и дождитесь статуса **Running** (кит зелёный / «Engine running»).
3. На Windows рекомендуется бэкенд **WSL 2**: *Settings → General → Use the WSL 2 based engine*.

## 2. Доступ к файлам проекта

- **Settings → Resources → File sharing** (или *Resources → Advanced* в новых версиях): должен быть доступен диск, где лежит репозиторий (часто `C:`).
- Проект в **OneDrive** (`Рабочий стол`, синхронизация) иногда даёт медленную сборку или блокировки файлов. Если Compose падает или зависает — склонируйте репозиторий в обычную папку, например `C:\dev\TURIZM`, и работайте оттуда.

## 3. Запуск стека Turizm

Поднимайте **весь compose** (`db`, `backend`, `web`), а не образ `turizm-web` кнопкой «Run» в Docker Desktop в отрыве от сети: у Nginx прокси на хост `backend` есть только внутри сети compose.

В терминале **из корня репозитория** (там же, где `docker-compose.yml`):

```powershell
cd "C:\путь\к\TURIZM"
copy .env.docker.example .env
docker compose up --build
```

Или в фоне:

```powershell
docker compose up --build -d
```

Сайт: **http://localhost:8080** (порт меняется переменной `WEB_PORT` в `.env`).

Демо-данные после первого старта:

```powershell
docker compose exec backend python manage.py seed_demo
```

## 4. Где это видно в Docker Desktop

- **Containers** — группа **`turizm`** (или с префиксом имени папки, если не задан `name:` в compose; у нас задано `name: turizm`).
- Внутри: контейнеры **db**, **backend**, **web** — логи, старт/стоп, перезапуск из UI.
- **Volumes** — `turizm_postgres_data` (данные БД сохраняются между перезапусками).

## 5. Cursor / VS Code

В репозитории есть задачи **Docker Compose: Up** и **Docker Compose: Down** (`.vscode/tasks.json`):  
*Terminal → Run Task…* — команды выполняются тем же Docker Engine, что и Docker Desktop.

## 6. Ключ карт при сборке

`VITE_YANDEX_MAPS_API_KEY` читается из `.env` при **`docker compose build`**. После изменения ключа:

```powershell
docker compose build web --no-cache
docker compose up -d
```

Любые правки **исходников фронтенда** (React, стили) попадают в контейнер только после **пересборки образа `web`** — иначе в браузере остаётся старый бандл. После `git pull` или правок в `frontend/` выполните `docker compose build web` (или `up --build`) и перезапустите стек.

## 6.1. Сборка backend (Go)

Образ `backend` собирается из `server/` (`golang:alpine` + `go mod tidy`). PyPI и `PIP_INDEX_URL` относятся только к **legacy Django** в каталоге `backend/`, если вы собираете его вручную.

При ошибках сети при `docker compose build backend` повторите сборку или проверьте прокси/VPN.

## 7. Остановка

```powershell
docker compose down
```

Полное удаление данных БД (осторожно):

```powershell
docker compose down -v
```
