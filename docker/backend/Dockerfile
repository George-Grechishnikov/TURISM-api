# API на Go (замена Django)
FROM golang:1.22-alpine AS build
# При зависании загрузки модулей (WSL/сеть): docker compose build --build-arg GOPROXY=https://goproxy.io,direct backend
ARG GOPROXY=https://proxy.golang.org,direct
ENV GOPROXY=${GOPROXY}
WORKDIR /src
# go.sum в репо может отсутствовать — tidy создаёт его в образе до копирования кода
COPY server/go.mod ./
RUN go mod tidy
COPY server/ ./
RUN CGO_ENABLED=0 go build -ldflags="-s -w" -o /turizm ./cmd/turizm/

FROM alpine:3.20
RUN apk add --no-cache ca-certificates netcat-openbsd
COPY --from=build /turizm /turizm
COPY docker/backend/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh && sed -i 's/\r$//' /entrypoint.sh
WORKDIR /
ENV PORT=8000
EXPOSE 8000
HEALTHCHECK --interval=5s --timeout=3s --retries=12 --start-period=15s \
  CMD wget -qO- http://127.0.0.1:8000/health || exit 1
ENTRYPOINT ["/entrypoint.sh"]
