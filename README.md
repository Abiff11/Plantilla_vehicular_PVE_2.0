# Sistema de Control Vehicular

Estructura del repositorio:

- `backend/`
- `frontend/`
- `expediente/`
- `docs/` (si no existe en tu clon actual, crearla cuando se generen artefactos documentales)
- `DEPLOY.md`
- `INSTRUCTIONS.md`
- `docker-compose.yml`
- `expediente/*.md`

## Roles del sistema

| Rol | Clave | Funcion |
|---|---|---|
| Enlace | `enlace` | Captura registros vehiculares de su delegacion |
| Director Operativo | `director_operativo` | Monitorea delegaciones de su region |
| Admin Plantilla Vehicular | `plantilla_vehicular` | Consulta operacion completa por region/delegacion |
| Director General | `director_general` | Dashboard directivo con KPIs globales |
| Superadministrador | `superadmin` | Administra usuarios y bitacora |
| Coordinacion | `coordinacion` | Administra usuarios, bitacora y consulta operacion |

## Base de datos y migraciones

El esquema se gestiona con **migraciones de TypeORM** en:

- `backend/src/database/migrations`

```bash
cd backend
npm run migration:show   # Ver estado de migraciones
npm run migration:run    # Ejecutar pendientes
npm run migration:revert # Revertir ultima
```

Al arrancar (`npm run start:dev` o `npm start`), las migraciones pendientes se ejecutan automaticamente (`migrationsRun: true`).

## Variables de entorno

Revisar:

- `backend/.env.example`
- `frontend/.env.example`

## Arranque

1. Instalar dependencias en `backend` y `frontend`.
2. Crear base de datos PostgreSQL.
3. Copiar `.env.example` a `.env` en cada proyecto.
4. `cd backend && npm run start:dev`.
5. `cd frontend && npm run dev`.

Para primer despliegue, ejecutar seed: `npm run seed:users`.

## Notas

- Soft delete habilitado en usuarios y registros vehiculares.
- Bitacora de auditoria registra creacion, edicion, traslado, baja logica y login/logout.
- Catalogo de regiones/delegaciones se gestiona como modulo con tablas `regions` y `delegations`.
- Mensajeria entre usuarios disponible para roles `enlace`, `plantilla_vehicular` y `coordinacion`.
- Fotos de vehiculos: maximo 3, formato JPG/JPEG/PNG/WEBP, maximo 5MB cada una.