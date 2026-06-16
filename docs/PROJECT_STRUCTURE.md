# Estructura del Proyecto

## Objetivo

Mantener el repositorio ordenado, separando codigo de aplicacion, documentacion y configuracion de despliegue seguro.

## Regla principal

La raiz del repositorio no debe contener codigo de negocio.

La raiz queda reservada para:

- `README.md`
- `.env.example`
- `.gitignore`
- `Dockerfile`
- `Dockerfile.frontend`
- `docker-compose.prod.yml`
- `SECURITY.md`
- `.github/`
- `docs/`
- `backend/`
- `frontend/`
- `scripts/`
- `nginx/`

## Backend

Ruta oficial:

```txt
backend/
```

Contenido esperado:

- `src/`
- `package.json`
- `package-lock.json`
- `tsconfig*.json`
- `nest-cli.json`
- `.env.example`

La imagen productiva del backend se construye desde el `Dockerfile` de la raiz.

## Frontend

Ruta oficial:

```txt
frontend/
```

Contenido esperado:

- `src/`
- `public/` si aplica
- `package.json`
- `package-lock.json`
- `vite.config.*`
- `nginx.conf`
- `.env.example`

La imagen productiva del frontend se construye desde `Dockerfile.frontend`.

## Scripts

Ruta oficial:

```txt
scripts/
```

Contenido esperado:

- `deploy.sh`
- `migrate.sh`
- `rollback.sh`

## Nginx central

Ruta oficial:

```txt
nginx/
```

Contenido esperado:

- `plantilla-vehicular.conf`

Este archivo es la referencia para conectar el Nginx central del servidor con el contenedor frontend publicado en `127.0.0.1:8087`.

## Documentacion

Ruta oficial:

```txt
docs/
```

El expediente funcional y tecnico vive en:

```txt
docs/expediente/
```

## Docker y servidor

- `docker-compose.prod.yml` es la configuracion productiva del repositorio.
- El backend expone `3101` solo en red interna Docker.
- El frontend expone `8080` internamente y publica `127.0.0.1:8087` por defecto.
- PostgreSQL no publica `5432` al host.

## Variables de entorno

- `.env.example` raiz: contrato para `docker-compose.prod.yml`.
- `backend/.env.example`: contrato del backend aislado.
- `frontend/.env.example`: contrato del frontend aislado.

Nunca se deben versionar archivos `.env` reales.
