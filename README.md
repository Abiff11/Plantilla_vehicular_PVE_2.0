# Sistema de Control Vehicular PVE

Repositorio separado del monorepo de intranet, con historial Git propio.

## Estructura

- `backend/`
- `frontend/`
- `docs/`
- `scripts/`
- `nginx/`
- `Dockerfile`
- `Dockerfile.frontend`
- `docker-compose.prod.yml`
- `.env.example`
- `SECURITY.md`

## Despliegue en servidor / intranet

Este repositorio contiene la configuracion minima necesaria para desplegar el sistema como servicio independiente detras del Nginx central.

La entrada publica recomendada es:

```txt
Cloudflare / Internet -> Nginx central -> 127.0.0.1:8087 -> frontend -> backend:3101
```

## Build de imagenes

Backend:

```bash
docker build -f Dockerfile -t plantilla-vehicular-backend .
```

Frontend:

```bash
docker build -f Dockerfile.frontend -t plantilla-vehicular-frontend .
```

## Deploy productivo

```bash
cp .env.example .env
# Edita .env con valores reales
chmod +x scripts/*.sh
bash scripts/deploy.sh
```

## Variables de entorno

Las credenciales reales no se versionan.

- Usa `.env.example` para Docker Compose productivo.
- Usa `backend/.env.example` para backend aislado/local.
- Usa `frontend/.env.example` para frontend aislado/local.

## Base de datos

La aplicacion usa PostgreSQL configurado por variables de entorno.

- `synchronize` debe permanecer en `false`.
- Las migraciones productivas se ejecutan con `bash scripts/migrate.sh`.
- El rollback de una migracion se ejecuta con `bash scripts/rollback.sh`.

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
- `SECURITY.md`
