# Estructura del proyecto

## Objetivo

Mantener el repositorio ordenado para cargarse en el servidor como servicio Docker de intranet.

## Raiz del repositorio

La raiz queda reservada para contratos de despliegue, documentacion y carpetas principales:

```txt
Dockerfile
Dockerfile.frontend
docker-compose.service.yml
.env.example
README.md
SECURITY.md
.gitignore
backend/
frontend/
scripts/
nginx/
docs/
.github/
```

## Estructura minima de despliegue

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

## Backend

Ruta oficial:

```txt
backend/
```

Contiene la aplicacion NestJS, entidades, DTOs, migraciones, modulos y pruebas. La imagen productiva del backend se construye desde el `Dockerfile` de la raiz.

## Frontend

Ruta oficial:

```txt
frontend/
```

Contiene la aplicacion React/Vite y su `nginx.conf` interno. La imagen productiva del frontend se construye desde `Dockerfile.frontend`.

## Scripts

Ruta oficial:

```txt
scripts/
```

Contenido obligatorio:

- `deploy.sh`
- `migrate.sh`
- `rollback.sh`

## Nginx central

Ruta oficial:

```txt
nginx/app.conf
```

Este archivo es un fragmento por ruta para el Nginx central del servidor. No debe ser un `server` completo ni una configuracion por dominio.

## Docker y servidor

- `docker-compose.service.yml` define solo servicios de este repo.
- El repositorio no crea redes Docker propias de infraestructura.
- `intranet_proxy` y `intranet_db` se declaran como redes externas.
- El backend usa `expose: 3101` y no publica puertos.
- El frontend usa `expose: 8080` y no publica puertos.
- PostgreSQL central lo controla el servidor, no este repositorio.
- El host DB interno debe ser `postgres`.

## Variables de entorno

- Solo `.env.example` raiz es contrato versionado.
- `.env` real vive fuera de Git en el directorio del repo dentro del servidor.
- Secretos DB viven en `/opt/intranet/infra/security/plantilla_vehicular.db.env`.
- Nunca se deben versionar archivos `.env` reales.
