# Documentación Técnica

## Tabla de Contenidos
1. [Arquitectura del Sistema](#1-arquitectura-del-sistema)
2. [Base de Datos](#2-base-de-datos)
3. [API REST](#3-api-rest)
4. [WebSocket](#4-websocket)
5. [Frontend](#5-frontend)
6. [Seguridad](#6-seguridad)
7. [Despliegue](#7-despliegue)
8. [Configuración de Entorno](#8-configuración-de-entorno)

---

## 1. Arquitectura del Sistema

### 1.1 Patrón Arquitectónico

El sistema sigue una arquitectura **Cliente-Servidor** con patrón **MVC** en el backend y **Component-Based** en el frontend.

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENTE                               │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │                    React (SPA)                           │ │
│  │  ┌──────────┐  ┌───────────┐  ┌──────────┐  ┌────────┐ │ │
│  │  │  Pages   │  │Components │  │ Contexts │  │ Hooks  │ │ │
│  │  └──────────┘  └───────────┘  └──────────┘  └────────┘ │ │
│  │       │              │              │            │       │ │
│  │  ┌────┴──────────────┴──────────────┴────────────┴────┐ │ │
│  │  │              API Client (lib/api.ts)                │ │ │
│  │  │              Socket Client (lib/socket.ts)          │ │ │
│  │  └────────────────────────────────────────────────────┘ │ │
│  └─────────────────────────────────────────────────────────┘ │
└──────────────────────────┬───────────────────────────────────┘
                           │ HTTP + WebSocket
┌──────────────────────────┴───────────────────────────────────┐
│                        SERVIDOR                               │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │                  NestJS (REST + WS)                      │ │
│  │  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐        │ │
│  │  │ Auth   │  │Catalog │  │Records │  │ Users  │        │ │
│  │  │ Module │  │ Module │  │ Module │  │ Module │        │ │
│  │  └────────┘  └────────┘  └────────┘  └────────┘        │ │
│  │  ┌────────┐  ┌────────┐                                 │ │
│  │  │ Audit  │  │Realtime│                                 │ │
│  │  │ Module │  │ Module │                                 │ │
│  │  └────────┘  └────────┘                                 │ │
│  │                                                         │ │
│  │  ┌─────────────────────────────────────────────────────┐│ │
│  │  │              TypeORM (ORM)                           ││ │
│  │  └─────────────────────────────────────────────────────┘│ │
│  └─────────────────────────────────────────────────────────┘ │
└──────────────────────────┬───────────────────────────────────┘
                           │
┌──────────────────────────┴───────────────────────────────────┐
│                    PostgreSQL                                 │
│  Tables: regions, delegations, users, records,               │
│  audit_logs, vehicle_roster_reports, vehicle_transfers       │
└──────────────────────────────────────────────────────────────┘
```

### 1.2 Módulos del Backend

| Módulo | Responsabilidad |
|--------|----------------|
| **AuthModule** | Login, validación JWT, guards |
| **CatalogModule** | Regiones, delegaciones, catálogos de formulario |
| **RecordsModule** | CRUD de vehículos, transferencias, reportes de padrón |
| **UsersModule** | Gestión de usuarios, bootstrap de superadmin |
| **AuditLogsModule** | Registro y consulta de auditoría |
| **RealtimeModule** | Gateway WebSocket con Socket.IO |

### 1.3 Estructura de Directorios Backend

```
backend/src/
├── app.module.ts                 # Módulo raíz
├── main.ts                       # Entry point
├── common/
│   ├── auth/
│   │   ├── roles.decorator.ts    # @RequireRoles()
│   │   ├── roles.guard.ts        # Guard de autorización
│   │   └── current-user.decorator.ts  # @CurrentUser()
│   ├── entities/
│   │   └── base.entity.ts        # BaseEntity (id, createdAt, updatedAt, deletedAt)
│   └── enums/
│       └── role.enum.ts          # Role enum
├── config/
│   └── typeorm.config.ts         # Configuración de TypeORM
├── database/
│   └── migrations/
│       └── 1761140000000-init-schema.ts  # Migración inicial
├── modules/
│   ├── audit-logs/
│   │   ├── audit-logs.module.ts
│   │   ├── audit-logs.controller.ts
│   │   ├── audit-logs.service.ts
│   │   └── entities/audit-log.entity.ts
│   ├── auth/
│   │   ├── auth.module.ts
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   ├── jwt.strategy.ts
│   │   ├── jwt-auth.guard.ts
│   │   └── jwt-payload.type.ts
│   ├── catalog/
│   │   ├── catalog.module.ts
│   │   ├── catalog.controller.ts
│   │   ├── catalog.service.ts
│   │   ├── catalog.seed.ts              # Seed de regiones/delegaciones
│   │   ├── record-field-catalog.ts      # Catálogos de formulario
│   │   └── entities/
│   │       ├── region.entity.ts
│   │       └── delegation.entity.ts
│   ├── realtime/
│   │   ├── realtime.module.ts
│   │   └── realtime.gateway.ts
│   ├── records/
│   │   ├── records.module.ts
│   │   ├── records.controller.ts
│   │   ├── records.service.ts
│   │   └── entities/
│   │       ├── record.entity.ts
│   │       ├── vehicle-roster-report.entity.ts
│   │       └── vehicle-transfer.entity.ts
│   └── users/
│       ├── users.module.ts
│       ├── users.controller.ts
│       ├── users.service.ts
│       ├── superadmin-bootstrap.service.ts
│       └── entities/user.entity.ts
└── scripts/
    ├── seed-users.ts        # Script de usuarios de prueba
    └── seed-vehicles.ts     # Script de vehículos de prueba
```

### 1.4 Entry Point (main.ts)

El archivo `main.ts` configura:
- **Global prefix**: `api`
- **CORS**: Orígenes configurables via FRONTEND_ORIGINS (default: localhost:5173)
- **Security Headers**:
  - `X-Frame-Options: DENY`
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Cross-Origin-Opener-Policy: same-origin`
  - `Cross-Origin-Resource-Policy: same-origin`
  - `Strict-Transport-Security` (solo HTTPS)
- **ValidationPipe**: whitelist, forbidNonWhitelisted, transform
- **Trust proxy**: configurable via TRUST_PROXY

---

## 2. Base de Datos

### 2.1 Entidades y Relaciones

```
┌──────────────┐       ┌──────────────┐
│   regions    │1     N│ delegations  │
│              │◄──────│              │
│ id (UUID)    │       │ id (UUID)    │
│ name         │       │ name         │
│ code         │       │ regionId (FK)│
│ sortOrder    │       │ sortOrder    │
└──────────────┘       └──────┬───────┘
                              │
                    ┌─────────┼──────────┐
                    │         │          │
              ┌─────▼─────┐ ┌─▼────────┐│
              │   users   │ │ records  ││
              │           │ │          ││
              │ id (UUID) │ │ id (UUID)││
              │ firstName │ │ plates   ││
              │ lastName  │ │ brand    ││
              │ grade     │ │ ...      ││
              │ phone     │ │ delegationId│
              │ email     │ │ createdById│
              │ password  │ │          ││
              │ role      │ └──┬───────┘│
              │ isActive  │    │        │
              │ regionId? │    │        │
              │ delegationId?│   │        │
              └───────────┘    │        │
                    │          │        │
              ┌─────▼─────┐ ┌──▼────────┴──┐
              │audit_logs │ │vehicle_transfers│
              │           │ │              │
              │ id        │ │ id (UUID)    │
              │ action    │ │ reason       │
              │ entityType│ │ movedAt      │
              │ entityId  │ │ recordId (FK)│
              │ metadata  │ │ fromDelegId  │
              │ actorId   │ │ toDelegId    │
              └───────────┘ │ movedBy (FK) │
                            └──────────────┘

              ┌──────────────────────────┐
              │vehicle_roster_reports    │
              │                          │
              │ id (UUID)                │
              │ reportScope              │
              │ hasChanges               │
              │ changesSinceLastReport   │
              │ confirmedDelegationReports│
              │ notes                    │
              │ submittedAt              │
              │ delegationId? (FK)       │
              │ regionId? (FK)           │
              │ submittedBy (FK)         │
              └──────────────────────────┘
```

### 2.2 BaseEntity

Todas las entidades heredan de `BaseEntity`:

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID (uuid_generate_v4) | Identificador único |
| createdAt | timestamp | Fecha de creación (DEFAULT NOW()) |
| updatedAt | timestamp | Fecha de última actualización |
| deletedAt | timestamp (nullable) | Fecha de eliminación suave |

### 2.3 Role Enum

```typescript
enum Role {
  CAPTURIST = 'capturist',
  REGIONAL_MANAGER = 'regional_manager',
  ADMIN = 'admin',
  DIRECTOR = 'director',
  SUPERADMIN = 'superadmin',
}
```

### 2.4 Índices de Base de Datos

| Índice | Tabla | Columnas |
|--------|-------|----------|
| IDX_regions_sort_order | regions | sortOrder |
| IDX_delegations_sort_order | delegations | sortOrder |
| IDX_vehicle_roster_reports_delegation_submitted | vehicle_roster_reports | delegationId, submittedAt |
| IDX_vehicle_roster_reports_region_submitted | vehicle_roster_reports | regionId, submittedAt |
| IDX_vehicle_transfers_record_moved | vehicle_transfers | recordId, movedAt |

### 2.5 Foreign Keys

| FK | De | A |
|----|---|---|
| FK_delegations_region | delegations.regionId | regions.id |
| FK_users_region | users.regionId | regions.id |
| FK_users_delegation | users.delegationId | delegations.id |
| FK_records_delegation | records.delegationId | delegations.id |
| FK_records_created_by | records.createdById | users.id |
| FK_audit_logs_actor | audit_logs.actorId | users.id (SET NULL) |
| FK_vehicle_roster_reports_delegation | vehicle_roster_reports.delegationId | delegations.id |
| FK_vehicle_roster_reports_region | vehicle_roster_reports.regionId | regions.id |
| FK_vehicle_roster_reports_submitted_by | vehicle_roster_reports.submittedById | users.id |
| FK_vehicle_transfers_record | vehicle_transfers.recordId | records.id |
| FK_vehicle_transfers_from_delegation | vehicle_transfers.fromDelegationId | delegations.id |
| FK_vehicle_transfers_to_delegation | vehicle_transfers.toDelegationId | delegations.id |
| FK_vehicle_transfers_moved_by | vehicle_transfers.movedById | users.id |

### 2.6 Catálogos de Regiones y Delegaciones

| Región | Delegaciones |
|--------|-------------|
| VALLES CENTRALES ZONA NORTE | TLACOLULA, MITLA, EL RETIRO, IXTLAN DE JUAREZ, ETLA |
| VALLES CENTRALES ZONA SUR | MIAHUATLAN DE P.D., ZAACHILA, OCOTLAN, EJUTLA DE CRESPO, ZIMATLAN, SOLA DE VEGA |
| COSTA ZONA ORIENTE | HUATULCO, PUERTO ESCONDIDO, POCHUTLA, SANTOS REYES NOPALA |
| COSTA ZONA PONIENTE | PINOTEPA NACIONAL, JUQUILA, RIO GRANDE, JAMILTEPEC, CACAHUATEPEC |
| ISTMO ZONA NORTE | MATIAS ROMERO, TAPANATEPEC, MA. LOMBARDO, SAN JUAN GUICHICOVI |
| ISTMO ZONA SUR | SALINA CRUZ, CIUDAD IXTEPEC, JUCHITAN, TEHUANTEPEC |
| MIXTECA | HUAJUAPAN DE LEON, NOCHIXTLAN, TAMAZULAPAN, TLAXIACO, S.P. Y S.P. TEPOSCOLULA, PUTLA DE GRO., JUXTLAHUACA |
| CUENCA | TUXTEPEC, TEMASCAL, COSOLAPA |
| CENTRO | JEFE OPERATIVO, COORDINACION |

### 2.7 Catálogos de Formulario de Vehículo

| Campo | Opciones | Permite personalizado |
|-------|----------|----------------------|
| useType | PATRULLA, PARTICULAR, OTRO | Sí |
| vehicleClass | SEDAN, PICK UP, MOTOCICLETA, GRUA, BICICLETA, MICROBUS | No |
| physicalStatus | BUENO, REGULAR, MALO | No |
| status | ACTIVO, INACTIVO, SINIESTRADO, PARA BAJA, OTRO | Sí |
| assetClassification | PATRIMONIAL, ARRENDAMIENTO, OTRO | Sí |

---

## 3. API REST

### 3.1 Autenticación

| Método | Ruta | Guard | Descripción |
|--------|------|-------|-------------|
| POST | `/api/auth/login` | Public | Login (email, password) |
| GET | `/api/auth/me` | JwtAuthGuard | Obtener usuario actual |

### 3.2 Catálogos

| Método | Ruta | Guard | Descripción |
|--------|------|-------|-------------|
| GET | `/api/catalog/regions` | JwtAuthGuard | Regiones con delegaciones |
| GET | `/api/catalog/record-fields` | JwtAuthGuard | Campos de formulario de vehículo |

### 3.3 Registros (Records)

| Método | Ruta | Roles | Descripción |
|--------|------|-------|-------------|
| POST | `/api/records` | Capturist | Crear registro de vehículo |
| GET | `/api/records/my` | Capturist | Mis registros |
| GET | `/api/records/reports/my` | Capturist | Reportes de mi delegación |
| GET | `/api/records/reports/region/my` | RegionalManager | Reportes regionales propios |
| POST | `/api/records/reports` | Capturist | Enviar reporte de delegación |
| POST | `/api/records/reports/region` | RegionalManager | Enviar reporte regional |
| GET | `/api/records/reports/overview` | Admin, SuperAdmin, Director | Overview global de reportes |
| GET | `/api/records/reports/region/overview` | RegionalManager | Overview regional |
| GET | `/api/records/region/live` | RegionalManager | Vista en vivo de la región |
| GET | `/api/records/admin/overview` | Admin, SuperAdmin | Overview admin (con filtros) |
| GET | `/api/records/director/overview` | Director, Admin, SuperAdmin | Dashboard directivo |
| PATCH | `/api/records/:id` | Capturist, Admin, SuperAdmin | Editar registro |
| DELETE | `/api/records/:id` | Admin, SuperAdmin | Soft delete de registro |
| POST | `/api/records/:id/transfer` | Capturist, RegionalManager, Admin, SuperAdmin | Transferir vehículo |

### 3.4 Usuarios

| Método | Ruta | Roles | Descripción |
|--------|------|-------|-------------|
| POST | `/api/users` | SuperAdmin | Crear usuario |
| GET | `/api/users` | SuperAdmin | Listar usuarios |
| PATCH | `/api/users/:id` | SuperAdmin | Editar usuario |
| DELETE | `/api/users/:id` | SuperAdmin | Soft delete de usuario |

### 3.5 Auditoría

| Método | Ruta | Roles | Descripción |
|--------|------|-------|-------------|
| GET | `/api/audit-logs/live` | SuperAdmin | Logs de auditoría recientes |

### 3.4 Autenticación JWT

#### JWT Payload
```typescript
interface JwtPayload {
  sub: string;          // User ID
  email: string;        // Email del usuario
  role: Role;           // Rol del usuario
  regionId: string | null;      // ID de región (si aplica)
  delegationId: string | null;  // ID de delegación (si aplica)
}
```

#### Guards
| Guard | Función |
|-------|---------|
| **JwtAuthGuard** | Valida token JWT en header `Authorization: Bearer <token>` |
| **RolesGuard** | Verifica que el rol del usuario esté en `@RequireRoles(...)` |

#### Decoradores
| Decorador | Función |
|-----------|---------|
| `@RequireRoles(...roles)` | Define roles requeridos para el endpoint |
| `@CurrentUser()` | Extrae el usuario del request (JwtPayload) |

---

## 4. WebSocket

### 4.1 Configuración

- **Gateway**: Socket.IO en el mismo puerto del servidor NestJS
- **Autenticación**: Token JWT via `socket.auth.token` o header `Authorization`
- **Protocolo**: WebSocket sobre HTTP/HTTPS

### 4.2 Salas (Rooms)

| Sala | Miembros | Propósito |
|------|----------|-----------|
| `user:{userId}` | Usuario específico | Notificaciones directas |
| `region:{regionId}` | RegionalManager de esa región | Actividad regional |
| `role:superadmin` | SuperAdmin | Auditoría en tiempo real |
| `records:oversight` | Admin, Director, SuperAdmin | Supervisión global |

### 4.3 Eventos Emitidos

| Evento | Trigger | Payload |
|--------|---------|---------|
| `records.created` | Nuevo vehículo | Datos del registro |
| `records.changed` | Edición/eliminación/transferencia | Datos actualizados |
| `reports.submitted` | Reporte enviado | Datos del reporte |
| `audit.created` | Acción auditada | Datos del log |

### 4.4 Conexión del Cliente

```typescript
// Frontend: lib/socket.ts
const socket = io(socketUrl, {
  auth: { token: getAccessToken() }
});

// Suscribirse a eventos
socket.on('records.created', (data) => { ... });
socket.on('records.changed', (data) => { ... });
socket.on('reports.submitted', (data) => { ... });
socket.on('audit.created', (data) => { ... });
```

---

## 5. Frontend

### 5.1 Estructura de Rutas

| Ruta | Componente | Roles |
|------|-----------|-------|
| `/portal` | LoginPage | Público |
| `/` | HomePage | Todos |
| `/workspace` | CapturistPage | capturist |
| `/archive` | CapturistRecordsPage | capturist |
| `/monitor` | RegionalPage | regional_manager |
| `/overview` | AdminPage | admin, superadmin |
| `/insights` | DirectorPage | director, admin, superadmin |
| `/insights/map` | DirectorMapPage | director, admin, superadmin |
| `/control` | SuperAdminPage | superadmin |
| `/control/activity` | SuperAdminAuditPage | superadmin |

### 5.2 Contexto de Autenticación

```typescript
// modules/auth/auth-context.tsx
interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}
```

- **Almacenamiento**: sessionStorage para el token de acceso
- **Hidratación**: Al cargar, verifica token y obtiene perfil via `/api/auth/me`

### 5.3 Componentes Principales

| Componente | Propósito |
|------------|-----------|
| AppShell | Layout con sidebar colapsable, navegación por rol |
| ProtectedRoute | Guard de ruta basado en roles |
| RecordForm | Formulario de vehículo con validación Zod |
| GroupedRecords | Vista de registros agrupados por región/delegación |
| DirectorOaxacaMap | Mapa Leaflet con marcadores de delegaciones |
| StatsGrid | Grid de 4 columnas para estadísticas |
| PageIntro | Encabezado de página con acciones |
| EmptyState | Placeholder para estados vacíos |

### 5.4 Servicios API

El archivo `lib/api.ts` contiene un cliente completo con:
- Interceptor de token en headers
- Manejo de errores centralizado
- Tipado completo con TypeScript
- Endpoints para todos los recursos

### 5.5 CSS

- **Metodología**: CSS personalizado con variables CSS (custom properties)
- **Paleta**: Slate color system
- **Breakpoints**: 1200px, 768px, 480px
- **Sidebar**: Dark theme
- **Content**: Light theme
- **Mapa**: Marcadores con conic-gradient para distribución de clases

---

## 6. Seguridad

### 6.1 Autenticación

| Aspecto | Implementación |
|---------|---------------|
| **Método** | JWT (JSON Web Tokens) |
| **Hash** | bcryptjs con 10 rounds |
| **Expiración** | Configurable (default: 8h) |
| **Almacenamiento** | sessionStorage (frontend) |
| **Rate Limiting** | 5 intentos por IP + email en 10 minutos |

### 6.2 Autorización

| Aspecto | Implementación |
|---------|---------------|
| **Modelo** | RBAC (Role-Based Access Control) |
| **Niveles** | Endpoint-level via Guards |
| **Data-level** | Filtro por delegación/región según rol |
| **Protección especial** | SuperAdmin no puede ser editado/eliminado |

### 6.3 Headers de Seguridad

| Header | Valor | Propósito |
|--------|-------|-----------|
| X-Frame-Options | DENY | Prevenir clickjacking |
| X-Content-Type-Options | nosniff | Prevenir MIME sniffing |
| Referrer-Policy | strict-origin-when-cross-origin | Controlar referrer |
| Cross-Origin-Opener-Policy | same-origin | Aislar contexto de navegación |
| Cross-Origin-Resource-Policy | same-origin | Restringir carga de recursos |
| Strict-Transport-Security | max-age=... | Forzar HTTPS |

### 6.4 CORS

| Aspecto | Configuración |
|---------|--------------|
| **Orígenes** | Configurables via FRONTEND_ORIGINS |
| **Default** | http://localhost:5173 |
| **Credentials** | true |
| **Methods** | GET, POST, PATCH, DELETE, OPTIONS |
| **Headers** | Content-Type, Authorization |

### 6.5 Validación de Datos

| Nivel | Herramienta |
|-------|------------|
| **Backend** | class-validator + class-transformer |
| **Frontend** | Zod + react-hook-form |
| **Pipe** | ValidationPipe con whitelist y forbidNonWhitelisted |

### 6.6 Soft Delete

- Todos los entities tienen `deletedAt` (nullable)
- Eliminación lógica, no física
- Permite recuperación de datos
- Auditoría mantiene trazabilidad

### 6.7 Auditoría

- **Registro completo** de acciones sensibles
- **Actor tracking** con SET NULL on delete del usuario
- **Metadata JSONB** para contexto adicional
- **Broadcast en tiempo real** a superadmin

### 6.8 Consideraciones de Seguridad

| Aspecto | Estado |
|---------|--------|
| Credenciales en código | ✅ No hardcodeadas (env vars) |
| Secretos en repositorio | ✅ .env en .gitignore |
| Validación de entrada | ✅ Backend + Frontend |
| CSRF | ⚠️ No implementado (JWT en header, no cookie) |
| XSS | ⚠️ Depende de React escaping + CSP headers |
| SQL Injection | ✅ Prevenido por TypeORM (parameterized queries) |
| Rate limiting | ✅ Solo en login |
| Logging de errores | ✅ Archivos .codex-backend.log/.err |

---

## 7. Despliegue

### 7.1 Requisitos

| Componente | Requisito |
|------------|-----------|
| Node.js | v18+ |
| PostgreSQL | v14+ |
| npm | v9+ |

### 7.2 Backend

```bash
# Instalar dependencias
npm install

# Configurar entorno
cp .env.example .env
# Editar .env con valores de producción

# Compilar
npm run build

# Ejecutar migraciones
npm run typeorm migration:run

# Ejecutar seed (opcional)
npm run seed:users
npm run seed:vehicles

# Iniciar en producción
npm run start:prod
```

### 7.3 Frontend

```bash
# Instalar dependencias
npm install

# Configurar entorno
cp .env.example .env
# Editar .env con URL del backend

# Compilar
npm run build

# Servir build estático
npm run preview
```

### 7.4 Variables de Producción

| Variable | Producción |
|----------|-----------|
| PORT | 3000 (o puerto del servidor) |
| DATABASE_HOST | Dirección del servidor PostgreSQL |
| JWT_SECRET | Clave segura generada |
| FRONTEND_ORIGINS | Dominio del frontend |
| VITE_API_URL | URL del API backend |
| VITE_SOCKET_URL | URL del WebSocket |

---

## 8. Configuración de Entorno

### 8.1 Backend (.env.example)

```env
# Server
PORT=3000
HOST=0.0.0.0
TRUST_PROXY=false

# Database
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=vehicle_control
DATABASE_USERNAME=postgres
DATABASE_PASSWORD=your_password

# JWT
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=8h

# CORS
FRONTEND_ORIGINS=http://localhost:5173

# Superadmin Bootstrap
SUPERADMIN_FIRST_NAME=Super
SUPERADMIN_LAST_NAME=Admin
SUPERADMIN_GRADE=
SUPERADMIN_PHONE=
SUPERADMIN_EMAIL=superadmin@example.com
SUPERADMIN_PASSWORD=secure_password
```

### 8.2 Frontend (.env.example)

```env
VITE_API_URL=http://localhost:3000/api
VITE_SOCKET_URL=http://localhost:3000
```

### 8.3 Scripts Disponibles

#### Backend
| Comando | Descripción |
|---------|-------------|
| `npm run build` | Compilar TypeScript |
| `npm run start:dev` | Desarrollo con hot-reload |
| `npm run start:prod` | Producción |
| `npm run lint` | ESLint |
| `npm run typeorm migration:run` | Ejecutar migraciones |
| `npm run typeorm migration:revert` | Revertir última migración |
| `npm run seed:users` | Crear usuarios de prueba |
| `npm run seed:vehicles` | Crear vehículos de prueba |

#### Frontend
| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Desarrollo con Vite |
| `npm run build` | Compilar para producción |
| `npm run preview` | Previsualizar build |
