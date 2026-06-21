# Sistema de Control Vehicular PVE

Repositorio de la aplicación `plantilla_vehicular`, preparado para cargarse como servicio Docker en el servidor de intranet.

## Estructura obligatoria del repo

```txt
Plantilla_vehicular_PVE_2.0/
├── Dockerfile
├── Dockerfile.frontend
├── docker-compose.service.yml
├── .env.example
├── SECURITY.md
├── README.md
├── scripts/
│   ├── deploy.sh
│   ├── migrate.sh
│   └── rollback.sh
└── nginx/
    └── app.conf
```

`Dockerfile.frontend` existe porque este repositorio entrega dos servicios del mismo sistema: backend NestJS y frontend React/Nginx. El compose no crea infraestructura compartida ni publica puertos.

## Responsabilidad del servidor

El servidor controla:

- Docker networks externas `intranet_proxy` e `intranet_db`.
- Nginx central.
- PostgreSQL central.
- `.env` real del repo.
- Secretos de base de datos en `/opt/intranet/infra/security/plantilla_vehicular.db.env`.
- Backups, firewall y seguridad SSH.

Este repo controla únicamente:

- Dockerfiles de producción.
- `docker-compose.service.yml`.
- `.env.example` sin secretos reales.
- Migraciones propias.
- Healthcheck.
- Scripts `deploy`, `migrate` y `rollback`.
- Fragmento Nginx `nginx/app.conf`.

## Ruta productiva

Entrada web por VPN:

```txt
http://100.118.154.7/plantilla-vehicular/
```

Flujo:

```txt
VPN Tailscale -> Nginx central -> intranet_proxy -> plantilla_vehicular_frontend:8080 -> backend:3101 -> postgres:5432
```

## Base de datos

El repo no crea ni levanta PostgreSQL. Usa el PostgreSQL central del servidor.

Crear la base y usuario desde infraestructura:

```bash
/opt/intranet/infra/scripts/create-app-db.sh plantilla_vehicular
```

Valores esperados:

```txt
DATABASE_HOST=postgres
DATABASE_PORT=5432
DATABASE_NAME=plantilla_vehicular_db
DATABASE_USER=plantilla_vehicular_user
```

La contraseña real debe vivir en:

```txt
/opt/intranet/infra/security/plantilla_vehicular.db.env
```

## Almacenamiento de imágenes

En producción las fotos de vehículos y adjuntos del mensajero se guardan en Cloudflare R2. El backend no debe arrancar en `NODE_ENV=production` si `STORAGE_DRIVER` no es `r2`.

Variables requeridas en `.env`:

```txt
STORAGE_DRIVER=r2
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=
```

`R2_PUBLIC_URL` es opcional. Si se define con un dominio público de R2 o un dominio propio de Cloudflare, las URLs guardadas apuntan directo a ese dominio. Si queda vacío, la app sirve los archivos desde `/api/files/*` y el backend lee el objeto desde R2.

## Deploy en servidor

Ruta del repo:

```bash
cd /opt/intranet/apps/Plantilla_vehicular_PVE_2.0
```

Preparación inicial:

```bash
cp .env.example .env
# Editar .env sin guardar secretos reales en Git.
chmod +x scripts/*.sh
```

Despliegue:

```bash
bash scripts/deploy.sh
```

Migraciones:

```bash
bash scripts/migrate.sh
```

Rollback de última migración:

```bash
bash scripts/rollback.sh
```

## Nginx central

El archivo que debe integrarse al Nginx central es:

```txt
nginx/app.conf
```

No es un `server` completo; es un fragmento por ruta para incluirse dentro del servidor principal de la intranet.

## Validación rápida

```bash
docker compose --env-file .env -f docker-compose.service.yml config
docker compose --env-file .env -f docker-compose.service.yml ps
curl -i http://100.118.154.7/plantilla-vehicular/api/health
curl -I http://100.118.154.7/plantilla-vehicular/
```

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

## Documentación

La documentación técnica y operativa complementaria vive en:

```txt
docs/
```
