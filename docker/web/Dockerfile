# bookworm-slim (glibc): Vite 8 / rolldown не ставит нативный биндинг под alpine-musl — сборка там падает,
# из-за чего образ web не обновляется и в браузере «вечно старый» UI.
FROM node:22-bookworm-slim AS frontend-build

WORKDIR /app

COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci

COPY frontend/ ./

ARG VITE_YANDEX_MAPS_API_KEY=
ARG VITE_API_BASE=
# Меняйте при каждой пересборке (см. rebuild-web.ps1) — уникальный CACHE_BUST сбрасывает кэш слоя RUN
ARG CACHE_BUST=0

ENV VITE_YANDEX_MAPS_API_KEY=$VITE_YANDEX_MAPS_API_KEY
ENV VITE_API_BASE=$VITE_API_BASE
ENV VITE_APP_BUILD_ID=$CACHE_BUST

RUN echo "Turizm frontend build id: ${CACHE_BUST}" && npm run build

FROM nginx:1.27-alpine

COPY docker/nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=frontend-build /app/dist /usr/share/nginx/html

EXPOSE 80
