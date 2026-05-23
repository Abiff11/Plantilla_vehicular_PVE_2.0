# Estructura del Proyecto

## Objetivo

Mantener el repositorio ordenado y separando claramente codigo de aplicacion, documentacion y configuracion de despliegue.

## Regla principal

La raiz del repositorio no debe contener codigo de negocio.

La raiz queda reservada para:

- `README.md`
- `DEPLOY.md`
- `INSTRUCTIONS.md`
- `.env.example`
- `.gitignore`
- `docker-compose.yml`
- `.github/`
- `docs/`
- `backend/`
- `frontend/`

## Backend

Ruta oficial:

```txt
backend/
```

Contenido esperado:

- `src/`
- `package.json`
- `package-lock.json`
- `Dockerfile`
- `tsconfig*.json`
- `nest-cli.json`
- `.env.example`

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
- `Dockerfile`
- `nginx.conf`
- `vite.config.*`
- `.env.example`

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

La raiz puede contener configuracion de orquestacion o despliegue, pero no codigo fuente de aplicacion.

El archivo `docker-compose.yml` debe tratarse como configuracion standalone/local. Para despliegue integrado con una intranet o Nginx central, ajustar puertos/redes desde infraestructura.

## Variables de entorno

- `.env.example` raiz: contrato para `docker-compose.yml`.
- `backend/.env.example`: contrato del backend aislado.
- `frontend/.env.example`: contrato del frontend aislado.

Nunca se deben versionar archivos `.env` reales.
