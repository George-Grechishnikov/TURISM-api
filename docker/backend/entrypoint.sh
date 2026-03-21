#!/bin/sh
set -e

host="${DB_HOST:-db}"
port="${DB_PORT:-5432}"

echo "Waiting for PostgreSQL..."
i=0
while [ "$i" -lt 60 ]; do
  if nc -z "$host" "$port" 2>/dev/null; then
    echo "PostgreSQL is up"
    break
  fi
  i=$((i + 1))
  if [ "$i" -eq 60 ]; then
    echo "PostgreSQL not reachable" >&2
    exit 1
  fi
  sleep 1
done

exec /turizm
