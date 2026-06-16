# Seguridad

## Estructura requerida

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
│   └── app.conf
└── SECURITY.md
```

## Responsabilidades

El servidor controla:

- Docker networks `intranet_proxy` e `intranet_db`.
- Nginx principal.
- PostgreSQL central.
- Secretos reales `.env`.
- Secretos DB en `/opt/intranet/infra/security/plantilla_vehicular.db.env`.
- Backups.
- Firewall.
- Seguridad SSH.

Este repositorio controla:

- Dockerfile backend/frontend.
- `docker-compose.service.yml`.
- `.env.example` sin secretos.
- Migraciones propias.
- Healthcheck.
- Scripts propios.
- Fragmento `nginx/app.conf`.

## Docker

- Backend con imagen multi-stage y usuario no-root.
- Frontend con Nginx no-root.
- Directorios de escritura limitados a volumenes o `tmpfs`.
- El repositorio no crea redes de infraestructura.
- `intranet_proxy` y `intranet_db` se declaran como redes externas.
- Ningun servicio de este repositorio publica puertos al host.
- No se usa `latest` como tag por defecto en las imagenes productivas del compose.

## Variables de entorno

- No versionar archivos `.env` reales.
- Usar solo `.env.example` raiz como contrato del repo.
- En produccion, `NODE_ENV` debe ser `production`.
- En produccion, `FRONTEND_ORIGINS` debe quedar limitado a `http://100.118.154.7` o a origenes HTTPS explicitamente aprobados.
- Las variables criticas se validan al arrancar el backend.
- La contraseña real de base de datos debe venir de `/opt/intranet/infra/security/plantilla_vehicular.db.env`.

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
- Para el servidor VPN actual, el origen permitido es `http://100.118.154.7`.

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

- Backend interno: `GET /api/health`.
- Ruta VPN por Nginx central: `GET /plantilla-vehicular/api/health`.
- Frontend interno: `GET /robots.txt`.

## Migraciones

- `synchronize` debe permanecer en `false`.
- En produccion, las migraciones deben ejecutarse de forma controlada.

```bash
bash scripts/migrate.sh
bash scripts/rollback.sh
```

## Puertos y redes

| Servicio | Interno | Publicado | Redes |
|---|---:|---:|---|
| Backend | `3101` | No | `intranet_proxy`, `intranet_db` |
| Frontend | `8080` | No | `intranet_proxy` |
| PostgreSQL | `5432` | No lo maneja este repo | `intranet_db` |

## Deploy

```bash
cp .env.example .env
chmod +x scripts/*.sh
bash scripts/deploy.sh
```
