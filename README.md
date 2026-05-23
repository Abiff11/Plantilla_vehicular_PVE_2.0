# Sistema de Control Vehicular PVE

Repositorio separado del monorepo de intranet, con historial Git propio.

## Estructura

- `backend/`
- `frontend/`
- `docs/`

## Variables de entorno

Las credenciales reales no se versionan.

- Usa `backend/.env.example` para backend.
- Usa `frontend/.env.example` para frontend.
- Usa `.env.example` solo cuando ejecutes `docker-compose.yml` desde la raiz.
- Crea tus archivos locales `.env` segun el entorno.

## Base de datos

La aplicacion usa PostgreSQL configurado por variables de entorno.

Variables principales del backend:

```env
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USER=postgres
DATABASE_PASSWORD=
DATABASE_NAME=vehicle_control
DATABASE_SSL=false
```

En produccion no deben versionarse credenciales ni secretos.

## Backend

```bash
cd backend
npm install
npm run build
npm run start:dev
npm run test
```

## Frontend

```bash
cd frontend
npm install
npm run build
npm run dev
```

## Validacion rapida

```bash
cd backend
npm run build
npm run lint
npm run test

cd ../frontend
npm run build
```

## Documentacion

La documentacion tecnica y operativa vive en:

```txt
docs/
```

Documentos principales:

- `docs/DEPLOY.md`
- `docs/INSTRUCTIONS.md`
- `docs/PROJECT_STRUCTURE.md`
- `docs/expediente/`
