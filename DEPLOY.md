# Guia de Despliegue

## Requisitos minimos

- **Node.js 20.x** (para desarrollo local)
- **PostgreSQL 15+** (para desarrollo local)
- **Docker 24+** y **Docker Compose v2** (para despliegue reproducible)

## Desarrollo local

### 1. Base de datos

Asegurate de tener PostgreSQL corriendo y crear la base de datos:

```bash
createdb vehicle_control
```

O configura las credenciales en `backend/.env`:

```bash
cp backend/.env.example backend/.env
# Edita backend/.env con tus credenciales reales
```

### 2. Backend

```bash
cd backend
npm install
npm run build          # Compilar
npm run start:dev      # Desarrollo con hot-reload (migraciones automáticas)
npm run seed:users     # Crear cuenta superadmin (primera vez)
npm run test           # Ejecutar tests
```

Las migraciones se ejecutan automáticamente al arrancar (`migrationsRun: true` en `typeorm.config.ts`).
Para ejecutarlas manualmente sin arrancar la app: `npm run migration:run`.

El backend queda en `http://localhost:3000`.

### 3. Frontend

```bash
cd frontend
npm install
npm run dev            # Desarrollo con hot-reload
```

El frontend queda en `http://localhost:5173`.

### 4. Health check

```bash
curl http://localhost:3000/api/health
```

Respuesta esperada:

```json
{
  "status": "ok",
  "timestamp": "2026-04-24T17:00:00.000Z",
  "uptime": 12.34
}
```

## Despliegue con Docker

> `docker-compose.yml` en este repositorio es para uso **standalone/local**.
> En el despliegue integrado de la intranet, la entrada HTTP/HTTPS pasa por el **Nginx central**.
> Si Nginx central ya ocupa `80/443`, no expongas `80:80` en este servicio; ajusta puertos internos o usa red interna sin publicar ese puerto.

### Build y arranque

```bash
# Variables obligatorias (o usa los defaults de docker-compose.yml)
export DATABASE_PASSWORD="un_secreto_largo_y_aleatorio"
export JWT_SECRET="otro_secreto_largo_y_aleatorio"

docker compose up -d --build
```

Los servicios quedan en:
- **Frontend**: `http://localhost:80`
- **Backend API**: `http://localhost:3000`
- **PostgreSQL**: `localhost:5432` (solo accesible internamente entre containers)

### Primer despliegue

Despues de `docker compose up -d`, ejecuta el seed dentro del container (las migraciones corren automáticamente al arrancar):

```bash
docker compose exec backend npm run seed:users
```

Si necesitas ejecutar migraciones manualmente:

```bash
docker compose exec backend npm run migration:show
docker compose exec backend npm run migration:run
```

### Logs

```bash
docker compose logs -f backend
docker compose logs -f frontend
```

### Detener

```bash
docker compose down
```

## Variables de entorno productivas

### Backend

| Variable | Default | Descripcion |
|---|---|---|
| `PORT` | `3000` | Puerto del servidor |
| `HOST` | `0.0.0.0` | Interfaz de escucha |
| `TRUST_PROXY` | `false` | `true` si hay reverse proxy (nginx, ALB, etc.) |
| `DATABASE_HOST` | `localhost` | Host de PostgreSQL |
| `DATABASE_PORT` | `5432` | Puerto de PostgreSQL |
| `DATABASE_NAME` | `vehicle_control` | Nombre de la base de datos |
| `DATABASE_USER` | `postgres` | Usuario de PostgreSQL |
| `DATABASE_PASSWORD` | *(requerido)* | Contraseña de PostgreSQL |
| `JWT_SECRET` | *(requerido)* | Secreto largo y aleatorio para firmar tokens |
| `JWT_EXPIRES_IN` | `8h` | Duracion del token JWT |
| `RATE_LIMIT_WINDOW_MS` | `60000` | Ventana de rate limit en milisegundos |
| `RATE_LIMIT_MAX_REQUESTS` | `100` | Maximo de requests por ventana por IP |
| `FRONTEND_ORIGINS` | *(requerido en prod)* | Origenes CORS separados por coma |

### Frontend (build-time)

| Variable | Default | Descripcion |
|---|---|---|
| `VITE_API_URL` | `/api` | URL base de la API (relativa si usa mismo dominio) |
| `VITE_SOCKET_URL` | `/` | URL base de Socket.IO (relativa si usa mismo dominio) |

## Notas de seguridad

- **Nunca comitas `.env` reales**. Los archivos `.env` estan en `.gitignore`.
- **`JWT_SECRET`** debe ser una cadena larga y aleatoria (minimo 32 caracteres).
- **`DATABASE_PASSWORD`** debe ser unica y no reutilizada.
- **`SUPERADMIN_PASSWORD`** debe cambiarse inmediatamente despues del primer despliegue.
- En produccion, configura `TRUST_PROXY=true` si hay un reverse proxy delante.
- Configura `FRONTEND_ORIGINS` con los dominios reales de tu frontend.

---

# Checklist de Release

## Pre-Deploy

### Variables de entorno obligatorias

| Variable | Estado | Notas |
|---|---|---|
| `JWT_SECRET` | [ ] | Min 16 chars, generado con `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"` |
| `DATABASE_PASSWORD` | [ ] | No usar `change_me` |
| `FRONTEND_ORIGINS` | [ ] | Dominios reales de produccion separados por coma |
| `SUPERADMIN_EMAIL` | [ ] | Email real del superadmin |
| `SUPERADMIN_PASSWORD` | [ ] | Cumple politica: 8+ chars, mayuscula, minuscula, numero, especial |
| `SEED_USERS_PASSWORD` | [ ] | Si se van a crear usuarios de prueba |
| `TRUST_PROXY` | [ ] | `true` si hay reverse proxy (nginx, ALB, Cloudflare) |

### Backups

- [ ] Backup de la base de datos actual (si existe): `pg_dump vehicle_control > backup_$(date +%Y%m%d_%H%M%S).sql`
- [ ] Copia de `.env` actual en lugar seguro (fuera del repo)
- [ ] Verificar que `pg_restore` funciona con el backup

### Migraciones

- [ ] Ejecutar `npm run migration:show` y verificar migraciones pendientes
- [ ] Ejecutar `npm run migration:run` en staging primero
- [ ] Si hay datos existentes, verificar que no haya duplicados en `plates`, `engineNumber`, `serialNumber` activos:
  ```sql
  SELECT plates, COUNT(*) FROM records WHERE "deletedAt" IS NULL GROUP BY plates HAVING COUNT(*) > 1;
  SELECT "engineNumber", COUNT(*) FROM records WHERE "deletedAt" IS NULL GROUP BY "engineNumber" HAVING COUNT(*) > 1;
  SELECT "serialNumber", COUNT(*) FROM records WHERE "deletedAt" IS NULL GROUP BY "serialNumber" HAVING COUNT(*) > 1;
  ```

### Seed de datos

- [ ] Ejecutar `npm run seed:users` (si es primer despliegue o se necesitan usuarios de prueba)
- [ ] Verificar que el superadmin se creo con `npm run validate:release`
- [ ] Si es ambiente de produccion, NO ejecutar `seed:vehicles` (solo para desarrollo/testing)

## Deploy

### Con Docker Compose

```bash
export DATABASE_PASSWORD="secreto_real"
export JWT_SECRET="secreto_largo_generado"
export FRONTEND_ORIGINS="https://tu-dominio.com"

docker compose up -d --build

# Primer despliegue (seed de usuarios, las migraciones corren al arrancar):
docker compose exec backend npm run seed:users  # solo si es necesario
```

### Sin Docker

```bash
cd backend
npm install
npm run build
npm start &  # Las migraciones corren automáticamente al arrancar

npm run seed:users  # solo si es necesario (primer despliegue)

cd ../frontend
npm install
npm run build
# Servir dist/ con nginx o similar
```

## Post-Deploy

### Health Checks

```bash
# Liveness: el proceso esta vivo
curl -f http://localhost:3000/api/health

# Readiness: la BD esta conectada
curl -f http://localhost:3000/api/health/ready

# Metrics: diagnostico basico
curl -s http://localhost:3000/api/health/metrics | jq
```

### Validaciones funcionales

- [ ] Login con superadmin funciona
- [ ] Login con usuario seed funciona (si se creo)
- [ ] Crear un usuario desde SuperAdmin funciona
- [ ] Crear un registro vehicular desde Capturista funciona
- [ ] Logout registra evento en bitacora
- [ ] Ejecutar `npm run validate:release` en el backend y verificar todo en pass/warn

### Rollback

Si algo falla despues del deploy:

```bash
# Docker Compose
docker compose down
docker compose up -d --build  # con la version anterior del codigo

# Sin Docker
# 1. Detener el proceso actual
# 2. Restaurar la version anterior del codigo
# 3. npm run build
# 4. npm start

# Si las migraciones fallaron:
npm run migration:revert  # revertir ultima migracion
```

## Riesgos Remanentes Conocidos

| Riesgo | Impacto | Mitigacion actual | Mitigacion futura |
|---|---|---|---|
| JWT no se puede revocar antes de expiracion | Un token comprometido es valido hasta 8h | `logoutWithApi` registra evento, 401 limpia sesion local | Implementar refresh tokens + blacklist |
| Rate limit es in-memory por instancia | No funciona en multi-instance | Suficiente para single-instance | Redis para rate limit distribuido |
| No hay HTTPS en desarrollo local | Tokens viajan en texto plano en red local | Solo para desarrollo, no produccion | Certificado TLS en produccion |
| Frontend valida password con regex local | Si cambia la politica del backend, puede desincronizarse | Misma regex en ambos lados | Endpoint de validacion de politica |
| No hay monitoreo externo | No se detecta caida automaticamente | Health endpoint disponible | Uptime robot, Pingdom, etc. |
| Logs van a stdout solo | Se pierden al reiniciar container | `docker compose logs -f` los recupera | Log aggregation (ELK, Loki) |
| No hay tests E2E reales con browser | Solo tests unitarios de backend | Tests de servicio cubren logica critica | Playwright/Cypress para flujos completos |
