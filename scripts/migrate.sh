#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

ENV_FILE="${ENV_FILE:-.env}"
COMPOSE=(docker compose --env-file "$ENV_FILE" -f docker-compose.service.yml)

if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: missing $ENV_FILE. Copy .env.example to .env and set real values." >&2
  exit 1
fi

"${COMPOSE[@]}" config >/dev/null
"${COMPOSE[@]}" run --rm backend npm run migration:show:prod
"${COMPOSE[@]}" run --rm backend npm run migration:run:prod
