#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="/opt/intranet/apps/Plantilla_vehicular_PVE_2.0"
COMPOSE_FILE="docker-compose.service.yml"
ENV_FILE=".env"
TARGET_REF="${1:-origin/main}"

cd "$APP_DIR"

echo "== Validando archivos requeridos =="
test -f "$COMPOSE_FILE"
test -f "$ENV_FILE"

echo "== Estado Git antes del deploy =="
git status -sb

echo "== Sincronizando código =="
git fetch origin
git reset --hard "$TARGET_REF"
git clean -fd -e .env

echo "== Commit desplegado =="
git log --oneline -1

echo "== Construyendo imágenes =="
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" build backend frontend

echo "== Levantando servicios =="
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d backend frontend

echo "== Recargando Nginx central =="
if docker ps --format '{{.Names}}' | grep -qx 'intranet_nginx'; then
  docker exec intranet_nginx nginx -t
  docker exec intranet_nginx nginx -s reload
else
  echo "WARN: intranet_nginx no esta corriendo; omito recarga de Nginx central."
fi

echo "== Estado Docker Compose =="
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" ps

echo "== Validando backend health interno =="
docker exec plantilla_vehicular_backend wget -qO- http://127.0.0.1:3101/api/health
echo

echo "== Validando frontend interno =="
docker exec plantilla_vehicular_frontend wget -qO- http://127.0.0.1:8080/robots.txt >/dev/null
echo "frontend ok"

echo "== Validando Nginx central con Host publico =="
if docker ps --format '{{.Names}}' | grep -qx 'intranet_nginx'; then
  docker exec intranet_nginx wget -qO- --header='Host: plantilla.sisoaxaca.com' http://127.0.0.1/ >/dev/null
  echo "nginx central ok"
fi

echo "== Validando protección pública Cloudflare Access =="
curl -sI https://plantilla.sisoaxaca.com | grep -Ei 'HTTP/|location:|www-authenticate:|server:' || true

echo "== Deploy terminado correctamente =="
