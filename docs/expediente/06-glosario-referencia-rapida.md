# Glosario y Referencia Rápida

## Glosario de Términos

| Término | Definición |
|---------|-----------|
| **Capturist** | Usuario que registra vehículos en el sistema desde una delegación específica |
| **Regional Manager** | Supervisor que monitorea todas las delegaciones de una región |
| **Admin** | Administrador global con acceso a todo el sistema |
| **Director** | Nivel ejecutivo con vista de KPIs y mapa (solo lectura) |
| **SuperAdmin** | Administrador máximo que gestiona usuarios y ve auditoría |
| **Región** | Agrupación geográfica de delegaciones (9 regiones en Oaxaca) |
| **Delegación** | Unidad operativa dentro de una región (41 delegaciones) |
| **Record** | Registro individual de un vehículo con todos sus datos |
| **Transfer** | Movimiento de un vehículo de una delegación a otra |
| **Roster Report** | Reporte de padrón vehicular que confirma el estado del inventario |
| **Soft Delete** | Eliminación lógica que marca el registro como eliminado sin borrarlo |
| **JWT** | JSON Web Token, método de autenticación usado por el sistema |
| **WebSocket** | Protocolo de comunicación bidireccional en tiempo real |
| **Socket.IO** | Librería que implementa WebSockets con fallbacks |
| **RBAC** | Role-Based Access Control, modelo de autorización |
| **TypeORM** | ORM usado para interactuar con la base de datos PostgreSQL |
| **NestJS** | Framework backend basado en Node.js y TypeScript |
| **bcryptjs** | Librería para hashing de contraseñas |
| **Zod** | Librería de validación de esquemas en TypeScript (frontend) |
| **class-validator** | Librería de validación de DTOs en NestJS (backend) |

---

## Referencia Rápida de Rutas

### Backend (API REST)

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/auth/login` | Iniciar sesión |
| GET | `/api/auth/me` | Obtener perfil actual |
| GET | `/api/catalog/regions` | Obtener regiones y delegaciones |
| GET | `/api/catalog/record-fields` | Obtener catálogos de formulario |
| POST | `/api/records` | Crear vehículo |
| GET | `/api/records/my` | Ver mis registros |
| PATCH | `/api/records/:id` | Editar vehículo |
| DELETE | `/api/records/:id` | Eliminar vehículo |
| POST | `/api/records/:id/transfer` | Transferir vehículo |
| POST | `/api/records/reports` | Enviar reporte de delegación |
| GET | `/api/records/reports/overview` | Overview global de reportes |
| GET | `/api/records/director/overview` | Dashboard directivo |
| POST | `/api/users` | Crear usuario |
| GET | `/api/users` | Listar usuarios |
| PATCH | `/api/users/:id` | Editar usuario |
| DELETE | `/api/users/:id` | Eliminar usuario |
| GET | `/api/audit-logs/live` | Ver auditoría |

### Frontend (Rutas del navegador)

| Ruta | Página | Roles |
|------|--------|-------|
| `/portal` | Login | Público |
| `/` | Home | Todos |
| `/workspace` | Captura | capturist |
| `/archive` | Historial | capturist |
| `/monitor` | Monitoreo | regional_manager |
| `/overview` | Admin | admin, superadmin |
| `/insights` | Director | director, admin, superadmin |
| `/insights/map` | Mapa | director, admin, superadmin |
| `/control` | Usuarios | superadmin |
| `/control/activity` | Auditoría | superadmin |

---

## Referencia de Comandos

### Backend

```bash
cd backend

# Instalar dependencias
npm install

# Desarrollo
npm run start:dev

# Producción
npm run build
npm run start:prod

# Base de datos
npm run typeorm migration:run
npm run typeorm migration:revert

# Seeds
npm run seed:users
npm run seed:vehicles

# Lint
npm run lint
```

### Frontend

```bash
cd frontend

# Instalar dependencias
npm install

# Desarrollo
npm run dev

# Producción
npm run build
npm run preview
```

---

## Referencia de Entidades de Base de Datos

### Tabla: users

| Columna | Tipo | Nullable | Descripción |
|---------|------|----------|-------------|
| id | UUID | No | Primary key |
| firstName | varchar | No | Nombre |
| lastName | varchar | No | Apellido |
| grade | varchar | No | Grado |
| phone | varchar | Sí | Teléfono |
| email | varchar | No | Email (único) |
| passwordHash | varchar | No | Hash de contraseña |
| role | enum | No | capturist, regional_manager, admin, director, superadmin |
| isActive | boolean | No | true/false |
| regionId | UUID | Sí | FK → regions |
| delegationId | UUID | Sí | FK → delegations |
| createdAt | timestamp | No | Fecha de creación |
| updatedAt | timestamp | No | Fecha de actualización |
| deletedAt | timestamp | Sí | Fecha de soft delete |

### Tabla: records

| Columna | Tipo | Nullable | Descripción |
|---------|------|----------|-------------|
| id | UUID | No | Primary key |
| plates | varchar | No | Placas del vehículo |
| brand | varchar | No | Marca |
| type | varchar | No | Tipo |
| useType | varchar | No | Uso (PATRULLA, PARTICULAR, OTRO) |
| vehicleClass | varchar | No | Clase (SEDAN, PICK UP, etc.) |
| model | varchar | No | Modelo |
| engineNumber | varchar | No | Número de motor |
| serialNumber | varchar | No | Número de serie |
| custodian | varchar | No | Custodio |
| patrolNumber | varchar | No | Número de placa |
| physicalStatus | varchar | No | Estado físico (BUENO, REGULAR, MALO) |
| status | varchar | No | Estatus (ACTIVO, INACTIVO, etc.) |
| assetClassification | varchar | No | Clasificación (PATRIMONIAL, ARRENDAMIENTO, OTRO) |
| observation | text | Sí | Observaciones |
| delegationId | UUID | No | FK → delegations |
| createdById | UUID | No | FK → users |
| createdAt | timestamp | No | Fecha de creación |
| updatedAt | timestamp | No | Fecha de actualización |
| deletedAt | timestamp | Sí | Fecha de soft delete |

### Tabla: delegations

| Columna | Tipo | Nullable | Descripción |
|---------|------|----------|-------------|
| id | UUID | No | Primary key |
| name | varchar | No | Nombre de la delegación |
| regionId | UUID | No | FK → regions |
| sortOrder | int | No | Orden para visualización |
| createdAt | timestamp | No | Fecha de creación |
| updatedAt | timestamp | No | Fecha de actualización |
| deletedAt | timestamp | Sí | Fecha de soft delete |

### Tabla: regions

| Columna | Tipo | Nullable | Descripción |
|---------|------|----------|-------------|
| id | UUID | No | Primary key |
| name | varchar | No | Nombre de la región |
| code | varchar | No | Código único |
| sortOrder | int | No | Orden para visualización |
| createdAt | timestamp | No | Fecha de creación |
| updatedAt | timestamp | No | Fecha de actualización |
| deletedAt | timestamp | Sí | Fecha de soft delete |

### Tabla: audit_logs

| Columna | Tipo | Nullable | Descripción |
|---------|------|----------|-------------|
| id | UUID | No | Primary key |
| action | varchar | No | Tipo de acción |
| entityType | varchar | No | Tipo de entidad |
| entityId | varchar | No | ID del registro |
| metadata | jsonb | Sí | Datos adicionales |
| actorId | UUID | Sí | FK → users (SET NULL) |
| createdAt | timestamp | No | Fecha del evento |

### Tabla: vehicle_transfers

| Columna | Tipo | Nullable | Descripción |
|---------|------|----------|-------------|
| id | UUID | No | Primary key |
| reason | text | No | Motivo de la transferencia |
| movedAt | timestamp | No | Fecha del movimiento |
| recordId | UUID | No | FK → records |
| fromDelegationId | UUID | No | FK → delegations (origen) |
| toDelegationId | UUID | No | FK → delegations (destino) |
| movedById | UUID | No | FK → users (quién movió) |
| createdAt | timestamp | No | Fecha de creación |
| updatedAt | timestamp | No | Fecha de actualización |
| deletedAt | timestamp | Sí | Fecha de soft delete |

### Tabla: vehicle_roster_reports

| Columna | Tipo | Nullable | Descripción |
|---------|------|----------|-------------|
| id | UUID | No | Primary key |
| reportScope | varchar | No | DELEGATION o REGION |
| hasChanges | boolean | No | Si hubo cambios desde último reporte |
| changesSinceLastReport | int | No | Cantidad de cambios |
| confirmedDelegationReports | int | No | Delegaciones confirmadas |
| notes | text | Sí | Notas del reporte |
| submittedAt | timestamp | No | Fecha de envío |
| delegationId | UUID | Sí | FK → delegations (si es delegación) |
| regionId | UUID | Sí | FK → regions (si es regional) |
| submittedById | UUID | No | FK → users |
| createdAt | timestamp | No | Fecha de creación |
| updatedAt | timestamp | No | Fecha de actualización |
| deletedAt | timestamp | Sí | Fecha de soft delete |

---

## Referencia de Eventos de Auditoría

| Código | Cuándo se genera |
|--------|-----------------|
| USER_LOGGED_IN | Cuando un usuario inicia sesión exitosamente |
| USER_CREATED | Cuando SuperAdmin crea un nuevo usuario |
| USER_UPDATED | Cuando SuperAdmin edita un usuario |
| USER_SOFT_DELETED | Cuando SuperAdmin elimina un usuario |
| RECORD_CREATED | Cuando Capturist registra un nuevo vehículo |
| RECORD_UPDATED | Cuando se edita un registro de vehículo |
| RECORD_SOFT_DELETED | Cuando Admin/SuperAdmin elimina un vehículo |
| RECORD_TRANSFERRED | Cuando se transfiere un vehículo entre delegaciones |
| DELEGATION_ROSTER_REPORT_SUBMITTED_WITH_CHANGES | Reporte de delegación con cambios |
| DELEGATION_ROSTER_REPORT_SUBMITTED_WITHOUT_CHANGES | Reporte de delegación sin cambios |
| REGION_ROSTER_REPORT_SUBMITTED_WITH_CHANGES | Reporte regional con cambios |
| REGION_ROSTER_REPORT_SUBMITTED_WITHOUT_CHANGES | Reporte regional sin cambios |

---

## Referencia de WebSocket

### Conexión

```javascript
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000', {
  auth: { token: 'tu-jwt-token-aqui' }
});
```

### Eventos que puedes escuchar

| Evento | Descripción |
|--------|-------------|
| `records.created` | Se creó un nuevo vehículo |
| `records.changed` | Se modificó, eliminó o transfirió un vehículo |
| `reports.submitted` | Se envió un reporte de padrón |
| `audit.created` | Se registró una acción de auditoría |

### Salas automáticas

Al conectarse, el servidor te asigna a salas según tu rol:
- Todos → `user:{userId}`
- Regional Manager → `region:{regionId}`
- SuperAdmin → `role:superadmin`
- Admin, Director, SuperAdmin → `records:oversight`
