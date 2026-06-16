# Guia de Despliegue

## Requisitos minimos

- Docker 24+
- Docker Compose v2
- Nginx central ya conectado a `intranet_proxy`
- PostgreSQL central ya conectado a `intranet_db`
- Redes Docker creadas previamente por el servidor:
  - `intranet_proxy`
  - `intranet_db`

## Regla de infraestructura

El servidor controla:

- Docker networks
- Nginx principal
- PostgreSQL central
- secretos reales `.env`
- backups
- firewall
- seguridad SSH

Este repositorio controla:

- Dockerfile backend/frontend
- `docker-compose.service.yml`
- `.env.example`
- migraciones
- healthcheck
- scripts propios

## Estructura productiva

```txt
Plantilla_vehicular_PVE_2.0/
├── Dockerfile
├── Dockerfile.frontend
├── docker-compose.service.yml
├── .env.example
├── scripts/
│   ├── deploy.sh
│   ├── migrate.sh
│   └── rollback.sh
├── nginx/
│   └── plantilla-vehicular.conf
└── SECURITY.md
```

## Puertos y redes

| Servicio | Puerto interno | Puerto publicado | Redes |
|---|---:|---:|---|
| Backend | `3101` | No | `intranet_proxy`, `intranet_db` |
| Frontend | `8080` | No | `intranet_proxy` |
| PostgreSQL | `5432` | No lo maneja este repo | `intranet_db` |

Flujo esperado:

```txt
Internet / Cloudflare -> Nginx central -> intranet_proxy -> plantilla_vehicular_frontend:8080 -> backend:3101
```

## Primer despliegue

```bash
cp .env.example .env
# Editar .env con valores reales del servidor
chmod +x scripts/*.sh
bash scripts/deploy.sh
```

El deploy hace:

1. Valida `docker-compose.service.yml`.
2. Construye imagenes.
3. Ejecuta migraciones contra PostgreSQL central.
4. Levanta backend y frontend.

## Variables obligatorias en produccion

| Variable | Uso |
|---|---|
| `NODE_ENV=production` | Activa validacion estricta |
| `DATABASE_HOST` | Host PostgreSQL central |
| `DATABASE_PORT` | Puerto PostgreSQL |
| `DATABASE_NAME` | Base de datos |
| `DATABASE_USER` | Usuario DB |
| `DATABASE_PASSWORD` | Credencial DB real |
| `JWT_SECRET` | Firma JWT |
| `FRONTEND_ORIGINS` | CORS productivo HTTPS |

## Migraciones

En produccion las migraciones son explicitas.

Ver y ejecutar migraciones:

```bash
bash scripts/migrate.sh
```

Rollback de una migracion:

```bash
bash scripts/rollback.sh
```

Reglas:

- `synchronize` debe permanecer en `false`.
- `DATABASE_MIGRATIONS_RUN=false` por defecto.
- No ejecutar seeds productivos sin validacion previa.

## Healthcheck

Desde la red Docker:

```bash
docker exec plantilla_vehicular_backend wget -qO- http://127.0.0.1:3101/api/health
docker exec plantilla_vehicular_frontend wget -qO- http://127.0.0.1:8080/robots.txt
```

Desde Nginx central o dominio:

```bash
curl -i https://plantilla.sisoaxaca.com/api/health
curl -I https://plantilla.sisoaxaca.com/favicon.ico
```

## Logs

```bash
docker compose --env-file .env -f docker-compose.service.yml logs -f backend
docker compose --env-file .env -f docker-compose.service.yml logs -f frontend
```

## Nginx central

Copiar o enlazar la configuracion en el servidor donde vive el Nginx principal:

```bash
sudo cp nginx/plantilla-vehicular.conf /etc/nginx/conf.d/plantilla-vehicular.conf
sudo nginx -t
sudo systemctl reload nginx
```

Antes de usarla, ajustar:

```nginx
server_name plantilla.sisoaxaca.com;
```

El upstream debe apuntar al frontend dentro de `intranet_proxy`:

```nginx
server plantilla_vehicular_frontend:8080;
```

## Validacion rapida post-deploy

```bash
docker compose --env-file .env -f docker-compose.service.yml ps
curl -i https://plantilla.sisoaxaca.com/api/health
curl -I https://plantilla.sisoaxaca.com/favicon.ico
```

Headers esperados:

- `X-Frame-Options`
- `X-Content-Type-Options`
- `Referrer-Policy`
- `Cross-Origin-Opener-Policy`
- `Permissions-Policy`
- `Cache-Control`

## Desarrollo local sin Docker

Backend:

```bash
cd backend
cp .env.example .env
npm install
npm run build
npm run start:dev
```

Frontend:

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

## Detener servicio

```bash
docker compose --env-file .env -f docker-compose.service.yml down
```

## Backup

El backup lo controla el servidor central de PostgreSQL, no este repositorio.
