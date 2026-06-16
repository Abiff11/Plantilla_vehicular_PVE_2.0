#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

ENV_FILE="${ENV_FILE:-.env}"
COMPOSE=(docker compose --env-file "$ENV_FILE" -f docker-compose.prod.yml)

if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: missing $ENV_FILE. Copy .env.example to .env and set real values." >&2
  exit 1
fi

"${COMPOSE[@]}" up -d postgres

for attempt in {1..30}; do
  if "${COMPOSE[@]}" exec -T postgres sh -c 'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"' >/dev/null 2>&1; then
    break
  fi

  if [[ "$attempt" -eq 30 ]]; then
    echo "ERROR: PostgreSQL is not ready after waiting." >&2
    exit 1
  fi

  sleep 2
done

"${COMPOSE[@]}" run --rm --no-deps backend npm run migration:show:prod
"${COMPOSE[@]}" run --rm --no-deps backend npm run migration:run:prod
