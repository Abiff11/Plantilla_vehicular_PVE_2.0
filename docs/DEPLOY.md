# Guia de Despliegue

## Requisitos minimos

- Docker 24+
- Docker Compose v2
- Nginx central en el servidor
- PostgreSQL por contenedor incluido o servicio compatible

## Estructura productiva

```txt
Plantilla_vehicular_PVE_2.0/
├── Dockerfile
├── Dockerfile.frontend
├── docker-compose.prod.yml
├── .env.example
├── scripts/
│   ├── deploy.sh
│   ├── migrate.sh
│   └── rollback.sh
├── nginx/
│   └── plantilla-vehicular.conf
└── SECURITY.md
```

## Puertos

| Servicio | Puerto interno | Publicado al host | Nota |
|---|---:|---:|---|
| Backend | `3101` | No | Solo red interna Docker |
| Frontend | `8080` | `127.0.0.1:8087` | Entrada para Nginx central |
| PostgreSQL | `5432` | No | Solo red interna Docker |

Flujo esperado:

```txt
Internet / Cloudflare -> Nginx central -> 127.0.0.1:8087 -> frontend -> backend:3101
```

## Primer despliegue

```bash
cp .env.example .env
# Editar .env con valores reales
chmod +x scripts/*.sh
bash scripts/deploy.sh
```

El deploy hace:

1. Valida `docker-compose.prod.yml`.
2. Construye imagenes.
3. Levanta PostgreSQL.
4. Ejecuta migraciones.
5. Levanta backend y frontend.

## Variables obligatorias en produccion

| Variable | Uso |
|---|---|
| `NODE_ENV=production` | Activa validacion estricta |
| `DATABASE_HOST` | Host PostgreSQL |
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

Backend:

```bash
curl http://127.0.0.1:8087/api/health
```

Frontend:

```bash
curl http://127.0.0.1:8087/robots.txt
```

## Logs

```bash
docker compose --env-file .env -f docker-compose.prod.yml logs -f backend
docker compose --env-file .env -f docker-compose.prod.yml logs -f frontend
```

## Nginx central

Copiar o enlazar la configuracion:

```bash
sudo cp nginx/plantilla-vehicular.conf /etc/nginx/conf.d/plantilla-vehicular.conf
sudo nginx -t
sudo systemctl reload nginx
```

Antes de usarla, ajustar:

```nginx
server_name plantilla.sisoaxaca.com;
```

Si cambias `FRONTEND_PORT`, tambien ajusta el upstream:

```nginx
server 127.0.0.1:8087;
```

## Validacion rapida post-deploy

```bash
docker compose --env-file .env -f docker-compose.prod.yml ps
curl -I http://127.0.0.1:8087/
curl -i http://127.0.0.1:8087/api/health
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

## Detener stack productivo

```bash
docker compose --env-file .env -f docker-compose.prod.yml down
```

## Backup basico antes de cambios grandes

```bash
docker compose --env-file .env -f docker-compose.prod.yml exec -T postgres \
  pg_dump -U "$DATABASE_USER" "$DATABASE_NAME" > "backup_$(date +%Y%m%d_%H%M%S).sql"
```
