# Sistema de Control Vehicular PVE

Repositorio separado del monorepo de intranet, con historial Git propio.

## Estructura

- `backend/`
- `frontend/`
- `docs/`

## Despliegue en servidor / intranet

Este repositorio no debe orquestar toda la infraestructura.

La orquestación principal debe vivir en el servidor o en el repositorio de intranet.

Este repo solo expone las imágenes de la aplicación:

- `Dockerfile.backend`
- `Dockerfile.frontend`

## Build de imágenes

Backend:

```bash
docker build -f Dockerfile.backend -t plantilla-vehicular-backend .
```

Frontend:

```bash
docker build -f Dockerfile.frontend -t plantilla-vehicular-frontend .
```

## Variables de entorno

Las credenciales reales no se versionan.

- Usa `backend/.env.example` para backend.
- Usa `frontend/.env.example` para frontend.
- Crea tus archivos locales `.env` según el entorno.

## Base de datos

La aplicación usa PostgreSQL configurado por variables de entorno.

En producción no deben versionarse credenciales ni secretos.

## Desarrollo local

Backend:

```bash
cd backend
npm install
npm run build
npm run start:dev
npm run test
```

Frontend:

```bash
cd frontend
npm install
npm run build
npm run dev
```

## Validación rápida

```bash
cd backend
npm run build
npm run lint
npm run test

cd ../frontend
npm run build
```

## Documentación

La documentación técnica y operativa vive en:

```txt
docs/
```

Documentos principales:

- `docs/DEPLOY.md`
- `docs/INSTRUCTIONS.md`
- `docs/PROJECT_STRUCTURE.md`
- `docs/expediente/`
