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

umask 077
mkdir -p .volumes/backups
chmod 700 .volumes .volumes/backups 2>/dev/null || true

"${COMPOSE[@]}" config >/dev/null
"${COMPOSE[@]}" build --pull
"${COMPOSE[@]}" up -d postgres

bash ./scripts/migrate.sh

"${COMPOSE[@]}" up -d backend frontend
"${COMPOSE[@]}" ps
