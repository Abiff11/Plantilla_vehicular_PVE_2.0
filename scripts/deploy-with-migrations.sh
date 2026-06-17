#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="/opt/intranet/apps/Plantilla_vehicular_PVE_2.0"
COMPOSE_FILE="docker-compose.service.yml"
ENV_FILE=".env"
TARGET_REF="${1:-origin/main}"
MIGRATION_CMD="${MIGRATION_CMD:-npm run migration:run:prod}"

cd "$APP_DIR"

echo "== Validando archivos requeridos =="
test -f "$COMPOSE_FILE"
test -f "$ENV_FILE"

echo "== Backup PostgreSQL antes de migraciones =="
if systemctl list-unit-files | grep -q '^intranet-postgres-backup.service'; then
  sudo systemctl start intranet-postgres-backup.service
  systemctl status intranet-postgres-backup.service --no-pager -l | tail -20
elif test -x /opt/intranet/infra/scripts/backup-postgres.sh; then
  /opt/intranet/infra/scripts/backup-postgres.sh
else
  echo "ERROR: No encontré servicio ni script de backup PostgreSQL."
  exit 1
fi

echo "== Estado Git antes del deploy con migraciones =="
git status -sb

echo "== Sincronizando código =="
git fetch origin
git reset --hard "$TARGET_REF"
git clean -fd -e .env

echo "== Commit desplegado =="
git log --oneline -1

echo "== Construyendo imágenes =="
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" build backend frontend

echo "== Ejecutando migraciones =="
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" run --rm backend sh -lc "$MIGRATION_CMD"

echo "== Levantando servicios =="
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d backend frontend

echo "== Estado Docker Compose =="
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" ps

echo "== Validando backend health interno =="
docker exec plantilla_vehicular_backend wget -qO- http://127.0.0.1:3101/api/health
echo

echo "== Validando frontend interno =="
docker exec plantilla_vehicular_frontend wget -qO- http://127.0.0.1:8080/robots.txt >/dev/null
echo "frontend ok"

echo "== Validando protección pública Cloudflare Access =="
curl -sI https://plantilla.sisoaxaca.com | grep -Ei 'HTTP/|location:|www-authenticate:|server:' || true

echo "== Deploy con migraciones terminado correctamente =="
