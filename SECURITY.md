# Seguridad

## Estructura requerida

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

## Docker

- Backend con imagen multi-stage y usuario no-root.
- Frontend con Nginx no-root.
- Directorios de escritura limitados a volumenes o `tmpfs`.
- Backend expuesto solo en la red interna Docker.
- Frontend publicado por defecto en `127.0.0.1:8087` para Nginx central.

## Variables de entorno

- No versionar archivos `.env` reales.
- Usar `.env.example` como contrato.
- En produccion, `NODE_ENV` debe ser `production`.
- En produccion, CORS debe declarar dominios HTTPS reales.
- Las variables criticas se validan al arrancar el backend.

## Headers HTTP

Backend, frontend y Nginx central aplican headers defensivos:

- `X-Frame-Options`
- `X-Content-Type-Options`
- `Referrer-Policy`
- `Cross-Origin-Opener-Policy`
- `Cross-Origin-Resource-Policy`
- `Permissions-Policy`
- `Strict-Transport-Security` cuando aplica HTTPS.

## CORS

- Desarrollo permite origenes locales.
- Produccion exige origenes explicitos.
- Produccion no debe aceptar `localhost`.

## Rate limit

El backend aplica limites por politica:

| Politica | Variable |
|---|---|
| General | `RATE_LIMIT_MAX_REQUESTS` |
| Auth | `RATE_LIMIT_AUTH_MAX_REQUESTS` |
| Escritura | `RATE_LIMIT_WRITE_MAX_REQUESTS` |
| Importacion / upload | `RATE_LIMIT_IMPORT_MAX_REQUESTS` |

La ventana se controla con `RATE_LIMIT_WINDOW_MS`.

## Healthcheck

- Backend: `GET /api/health`
- Frontend: `GET /robots.txt`

## Migraciones

- `synchronize` debe permanecer en `false`.
- En produccion, las migraciones deben ejecutarse de forma controlada.

```bash
bash scripts/migrate.sh
bash scripts/rollback.sh
```

## Puertos

| Servicio | Interno | Publicado por defecto |
|---|---:|---:|
| Backend | `3101` | No publicado |
| Frontend | `8080` | `127.0.0.1:8087` |
| PostgreSQL | `5432` | No publicado |

## Deploy

```bash
cp .env.example .env
chmod +x scripts/*.sh
bash scripts/deploy.sh
```
