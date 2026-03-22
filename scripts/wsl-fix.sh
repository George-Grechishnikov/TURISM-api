#!/usr/bin/env bash
# Подготовка репозитория под WSL (Ubuntu): git на /mnt/c, .env, напоминания.
# Запуск из корня репо: bash scripts/wsl-fix.sh

set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "== Turizm: WSL fix / setup =="

if [[ -f /proc/version ]] && grep -qi microsoft /proc/version 2>/dev/null; then
  echo "[WSL] Окружение: Windows Subsystem for Linux"
else
  echo "[?] Не похоже на WSL — скрипт всё равно безопасен для обычного Linux."
fi

# Репозиторий на диске Windows → права «ломают» git diff; стандартный обходной путь.
if [[ "$(pwd)" == /mnt/* ]]; then
  git config core.fileMode false
  echo "[fix] git config core.fileMode false (репо под /mnt/...)"
else
  echo "[ok] Репозиторий на родной FS Linux — core.fileMode не трогаем."
fi

if [[ ! -f frontend/.env ]]; then
  cp frontend/.env.example frontend/.env
  echo "[fix] Создан frontend/.env из .env.example"
else
  echo "[ok] frontend/.env уже есть"
fi

if [[ ! -f .env ]] && [[ -f .env.docker.example ]]; then
  cp .env.docker.example .env
  echo "[fix] Создан .env из .env.docker.example (для docker compose)"
elif [[ -f .env ]]; then
  echo "[ok] .env в корне уже есть"
fi

# Подсказка по ключу карт (без вывода секрета)
_k="$(grep -m1 -E '^VITE_YANDEX_MAPS_API_KEY=' frontend/.env 2>/dev/null || true)"
_pref="VITE_YANDEX_MAPS_API_KEY="
_v="${_k#"$_pref"}"
_v_trim="${_v#"${_v%%[![:space:]]*}"}"; _v_trim="${_v_trim%"${_v_trim##*[![:space:]]}"}"
if [[ -z "$_k" ]] || [[ -z "$_v_trim" ]]; then
  echo "[!] В frontend/.env задайте VITE_YANDEX_MAPS_API_KEY=... (без пробелов и без кавычек вокруг значения)"
fi
unset _k _pref _v _v_trim

if command -v docker >/dev/null 2>&1; then
  if docker info >/dev/null 2>&1; then
    echo "[ok] docker доступен"
  else
    echo "[!] docker установлен, но демон недоступен (запустите Docker Desktop / sudo service docker start, добавьте пользователя в группу docker)"
  fi
else
  echo "[!] docker не найден в PATH"
fi

echo
echo "Дальше:"
echo "  • Vite:  cd \"$ROOT/frontend\" && npm ci && npm run dev"
echo "  • API:   cd \"$ROOT/server\" && go run ./cmd/turizm   (нужен Go 1.22+ и PostgreSQL)"
echo "  • Всё в Docker: cd \"$ROOT\" && docker compose up --build"
echo "  • После смены ключа в .env для образа web: docker compose build web --no-cache"
echo "  • Открывайте сайт всегда с одного хоста: localhost ИЛИ 127.0.0.1 (иначе разные cookie → 404 маршрута)"
echo "Готово."
