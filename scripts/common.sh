#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ENV_FILE:-.env}"
APP_NAME="${APP_NAME:-plantilla_vehicular}"
DB_SECRET_FILE="${DB_SECRET_FILE:-/opt/intranet/infra/security/${APP_NAME}.db.env}"
COMPOSE=(docker compose --env-file "$ENV_FILE" -f docker-compose.service.yml)

cd "$ROOT_DIR"

require_runtime_files() {
  if [[ ! -f "$ENV_FILE" ]]; then
    echo "ERROR: missing $ENV_FILE. Copy .env.example to .env and set real values outside Git." >&2
    exit 1
  fi

  if [[ ! -f "$DB_SECRET_FILE" ]]; then
    echo "ERROR: missing database secret file: $DB_SECRET_FILE" >&2
    echo "Create it from /opt/intranet/infra after running create-app-db.sh $APP_NAME." >&2
    exit 1
  fi
}

validate_compose_config() {
  require_runtime_files
  "${COMPOSE[@]}" config >/dev/null
}
