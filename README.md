# Sistema de Control Vehicular

Aplicacion web full-stack para registro, seguimiento, validacion y consulta de plantilla vehicular institucional.

## Estructura del repositorio

```txt
.
├── backend/              # API NestJS, TypeORM, migraciones, WebSocket y tests
├── frontend/             # App React + Vite y Nginx de frontend
├── docs/                 # Documentacion funcional, tecnica y de operacion
├── .github/              # Workflows de CI
├── .env.example          # Plantilla de variables para docker-compose.yml
├── docker-compose.yml    # Orquestacion standalone/local
├── DEPLOY.md             # Guia de despliegue y checklist operacional
├── INSTRUCTIONS.md       # Reglas de trabajo para asistentes/codex
└── README.md             # Vista general del repositorio
```

## Regla de organizacion

La raiz del repositorio queda reservada para configuracion de despliegue, dockerizacion, documentacion principal, CI y archivos globales del repositorio.

El codigo de aplicacion vive exclusivamente en:

- `backend/`
- `frontend/`

## Backend

Ruta oficial:

```bash
backend/
```

Responsabilidades:

- API REST NestJS;
- autenticacion y autorizacion;
- WebSocket/Socket.IO;
- entidades TypeORM;
- migraciones de base de datos;
- almacenamiento de archivos;
- pruebas unitarias.

## Frontend

Ruta oficial:

```bash
frontend/
```

Responsabilidades:

- aplicacion React + Vite;
- vistas por rol;
- consumo de API;
- conexion WebSocket;
- build estatico servido por Nginx.

## Docker standalone

```bash
cp .env.example .env
# editar .env con valores reales

docker compose up -d --build
```

## Documentacion

La documentacion extendida vive en:

```txt
docs/
```

El expediente funcional/tecnico se ubica en:

```txt
docs/expediente/
```

## Seguridad

La rama de hardening incorpora:

- JWT en cookie HttpOnly;
- CSRF por cookie/header;
- revocacion de sesiones por `sessionVersion`;
- WebSocket validado contra estado vivo del usuario;
- entrega autenticada de archivos por `/api/files/*`;
- bloqueo de `/uploads` publico;
- validacion de firma real de imagenes;
- metricas protegidas por rol `superadmin`;
- backend Docker con usuario no-root.

## Validacion CI

El workflow principal corre backend typecheck/build/tests y frontend build.

## Notas operativas

- No comitar archivos `.env` reales.
- Usar `.env.example` raiz solo como contrato de variables para Docker Compose.
- Usar `backend/.env.example` y `frontend/.env.example` para desarrollo por separado.
- Revisar `DEPLOY.md` antes de desplegar.
