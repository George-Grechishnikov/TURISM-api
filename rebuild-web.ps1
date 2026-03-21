# Пересборка только фронта в Docker (Nginx + статический Vite build).
# Без этого http://localhost:8080 показывает СТАРЫЙ UI после изменений в frontend/.
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

# Уникальное значение на каждый запуск → Vite кладёт его в бандл → точно не «старый» JS
$env:CACHE_BUST = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds().ToString()
Write-Host "CACHE_BUST=$($env:CACHE_BUST) (попадёт в VITE_APP_BUILD_ID)"

Write-Host 'docker compose build web --no-cache ...'
docker compose build web --no-cache
if ($LASTEXITCODE -ne 0) {
  Write-Host ''
  Write-Host 'ОШИБКА: сборка образа web не прошла — контейнер остался со СТАРЫМ фронтом.' -ForegroundColor Red
  Write-Host 'Частая причина: Vite 8 + Alpine (musl). В Dockerfile должен быть node:*-bookworm-slim.' -ForegroundColor Yellow
  exit $LASTEXITCODE
}

Write-Host 'docker compose up -d web --force-recreate ...'
docker compose up -d web --force-recreate

Write-Host ''
Write-Host 'Готово. Откройте http://localhost:8080 и обновите страницу с очисткой кэша (Ctrl+F5).'
Write-Host 'Проверка: в DevTools у кнопки сомелье должен быть атрибут data-turizm-sommelier-fab.'
