# Procesos Registrados por Rol

## Tabla de Contenidos
1. [Procesos del Capturist](#1-procesos-del-capturist)
2. [Procesos del Regional Manager](#2-procesos-del-regional-manager)
3. [Procesos del Admin](#3-procesos-del-admin)
4. [Procesos del Director](#4-procesos-del-director)
5. [Procesos del SuperAdmin](#5-procesos-del-superadmin)
6. [Tabla de Eventos de Auditoría](#6-tabla-de-eventos-de-auditoría)

---

## 1. Procesos del Capturist

### 1.1 Autenticación
| Campo | Detalle |
|-------|---------|
| **Endpoint** | `POST /api/auth/login` |
| **Método** | Email + contraseña |
| **Resultado** | Token JWT almacenado en sessionStorage |
| **Auditoría** | `USER_LOGGED_IN` |

### 1.2 Obtener Perfil Actual
| Campo | Detalle |
|-------|---------|
| **Endpoint** | `GET /api/auth/me` |
| **Guard** | JwtAuthGuard |
| **Resultado** | Datos del usuario autenticado |

### 1.3 Capturar Nuevo Vehículo
| Campo | Detalle |
|-------|---------|
| **Endpoint** | `POST /api/records` |
| **Guard** | JwtAuthGuard + RolesGuard (Capturist) |
| **Datos requeridos** | plates, brand, type, useType, vehicleClass, model, engineNumber, serialNumber, custodian, patrolNumber, physicalStatus, status, assetClassification |
| **Datos opcionales** | observation |
| **Asignación automática** | delegationId (del usuario), createdById (usuario actual) |
| **Auditoría** | `RECORD_CREATED` |
| **WebSocket** | Evento `records.created` → sala `role:superadmin`, `records:oversight`, `region:{regionId}` |

### 1.4 Ver Mis Registros
| Campo | Detalle |
|-------|---------|
| **Endpoint** | `GET /api/records/my` |
| **Guard** | JwtAuthGuard + RolesGuard (Capturist) |
| **Filtro** | Solo registros creados por el usuario actual |

### 1.5 Editar Registro
| Campo | Detalle |
|-------|---------|
| **Endpoint** | `PATCH /api/records/:id` |
| **Guard** | JwtAuthGuard + RolesGuard (Capturist, Admin, SuperAdmin) |
| **Restricción Capturist** | Solo registros de su propia delegación |
| **Auditoría** | `RECORD_UPDATED` |
| **WebSocket** | Evento `records.changed` → salas correspondientes |

### 1.6 Transferir Vehículo
| Campo | Detalle |
|-------|---------|
| **Endpoint** | `POST /api/records/:id/transfer` |
| **Guard** | JwtAuthGuard + RolesGuard (Capturist, RegionalManager, Admin, SuperAdmin) |
| **Datos requeridos** | toDelegationId, reason (motivo) |
| **Restricción Capturist** | Solo vehículos de su delegación, destino dentro del sistema |
| **Proceso interno** | 1. Crea VehicleTransferEntity<br>2. Actualiza delegationId del registro<br>3. Registra auditoría |
| **Auditoría** | `RECORD_TRANSFERRED` |
| **WebSocket** | Evento `records.changed` |

### 1.7 Enviar Reporte de Padrón (Delegación)
| Campo | Detalle |
|-------|---------|
| **Endpoint** | `POST /api/records/reports` |
| **Guard** | JwtAuthGuard + RolesGuard (Capturist) |
| **Proceso** | 1. Consulta movimientos desde último reporte<br>2. Compara cambios (creados, actualizados, eliminados, transferidos)<br>3. Marca hasChanges (true/false)<br>4. Registra confirmedDelegationReports y notes |
| **Auditoría** | `DELEGATION_ROSTER_REPORT_SUBMITTED_WITH_CHANGES` o `DELEGATION_ROSTER_REPORT_SUBMITTED_WITHOUT_CHANGES` |
| **WebSocket** | Evento `reports.submitted` |

### 1.8 Ver Reportes de Mi Delegación
| Campo | Detalle |
|-------|---------|
| **Endpoint** | `GET /api/records/reports/my` |
| **Guard** | JwtAuthGuard + RolesGuard (Capturist) |
| **Filtro** | Solo reportes de la delegación del usuario |

### 1.9 Obtener Catálogos para Formulario
| Campo | Detalle |
|-------|---------|
| **Endpoint** | `GET /api/catalog/record-fields` |
| **Guard** | JwtAuthGuard |
| **Resultado** | Catálogos: useType, vehicleClass, physicalStatus, status, assetClassification |

---

## 2. Procesos del Regional Manager

### 2.1 Autenticación
| Campo | Detalle |
|-------|---------|
| **Endpoint** | `POST /api/auth/login` |
| **Auditoría** | `USER_LOGGED_IN` |

### 2.2 Obtener Perfil Actual
| Campo | Detalle |
|-------|---------|
| **Endpoint** | `GET /api/auth/me` |

### 2.3 Ver Monitoreo Regional en Vivo
| Campo | Detalle |
|-------|---------|
| **Endpoint** | `GET /api/records/region/live` |
| **Guard** | JwtAuthGuard + RolesGuard (RegionalManager) |
| **Datos** | Actividad en tiempo real de todas las delegaciones de la región asignada |
| **WebSocket** | Se une a sala `region:{regionId}` al conectarse |

### 2.4 Ver Overview Regional de Reportes
| Campo | Detalle |
|-------|---------|
| **Endpoint** | `GET /api/records/reports/region/overview` |
| **Guard** | JwtAuthGuard + RolesGuard (RegionalManager) |
| **Datos** | Resumen de reportes de todas las delegaciones de su región |

### 2.5 Ver Reportes Regionales Propios
| Campo | Detalle |
|-------|---------|
| **Endpoint** | `GET /api/records/reports/region/my` |
| **Guard** | JwtAuthGuard + RolesGuard (RegionalManager) |
| **Datos** | Historial de reportes regionales enviados por el usuario |

### 2.6 Enviar Reporte Regional
| Campo | Detalle |
|-------|---------|
| **Endpoint** | `POST /api/records/reports/region` |
| **Guard** | JwtAuthGuard + RolesGuard (RegionalManager) |
| **Proceso** | 1. Consolida información de delegaciones de su región<br>2. Compara cambios desde último reporte regional<br>3. Marca hasChanges<br>4. Envía reporte |
| **Auditoría** | `REGION_ROSTER_REPORT_SUBMITTED_WITH_CHANGES` o `REGION_ROSTER_REPORT_SUBMITTED_WITHOUT_CHANGES` |
| **WebSocket** | Evento `reports.submitted` |

### 2.7 Transferir Vehículo (dentro de su región)
| Campo | Detalle |
|-------|---------|
| **Endpoint** | `POST /api/records/:id/transfer` |
| **Guard** | JwtAuthGuard + RolesGuard |
| **Restricción** | Solo vehículos de delegaciones dentro de su región |
| **Auditoría** | `RECORD_TRANSFERRED` |

### 2.8 Obtener Catálogos
| Campo | Detalle |
|-------|---------|
| **Endpoint** | `GET /api/catalog/record-fields` |

### 2.9 Obtener Regiones y Delegaciones
| Campo | Detalle |
|-------|---------|
| **Endpoint** | `GET /api/catalog/regions` |
| **Guard** | JwtAuthGuard |
| **Resultado** | Lista de regiones con sus delegaciones anidadas |

---

## 3. Procesos del Admin

### 3.1 Autenticación
| Campo | Detalle |
|-------|---------|
| **Endpoint** | `POST /api/auth/login` |
| **Auditoría** | `USER_LOGGED_IN` |

### 3.2 Obtener Perfil Actual
| Campo | Detalle |
|-------|---------|
| **Endpoint** | `GET /api/auth/me` |

### 3.3 Ver Overview Administrativo Global
| Campo | Detalle |
|-------|---------|
| **Endpoint** | `GET /api/records/admin/overview` |
| **Guard** | JwtAuthGuard + RolesGuard (Admin, SuperAdmin) |
| **Filtros opcionales** | regionId, delegationId, status |
| **Datos** | Resumen global con estado de reportes por delegación |
| **WebSocket** | Se une a sala `records:oversight` al conectarse |

### 3.4 Editar Cualquier Registro
| Campo | Detalle |
|-------|---------|
| **Endpoint** | `PATCH /api/records/:id` |
| **Guard** | JwtAuthGuard + RolesGuard (Capturist, Admin, SuperAdmin) |
| **Alcance** | Cualquier registro del sistema, sin restricción de delegación |
| **Auditoría** | `RECORD_UPDATED` |
| **WebSocket** | Evento `records.changed` |

### 3.5 Eliminar Registro (Soft Delete)
| Campo | Detalle |
|-------|---------|
| **Endpoint** | `DELETE /api/records/:id` |
| **Guard** | JwtAuthGuard + RolesGuard (Admin, SuperAdmin) |
| **Proceso** | Establece deletedAt = timestamp actual (no borra físicamente) |
| **Auditoría** | `RECORD_SOFT_DELETED` |
| **WebSocket** | Evento `records.changed` |

### 3.6 Transferir Vehículo (cualquier delegación)
| Campo | Detalle |
|-------|---------|
| **Endpoint** | `POST /api/records/:id/transfer` |
| **Guard** | JwtAuthGuard + RolesGuard |
| **Alcance** | Cualquier vehículo a cualquier delegación |
| **Auditoría** | `RECORD_TRANSFERRED` |

### 3.7 Ver Overview Global de Reportes
| Campo | Detalle |
|-------|---------|
| **Endpoint** | `GET /api/records/reports/overview` |
| **Guard** | JwtAuthGuard + RolesGuard (Admin, SuperAdmin, Director) |
| **Datos** | Todos los reportes de padrón del sistema |

### 3.8 Ver Dashboard Directivo
| Campo | Detalle |
|-------|---------|
| **Endpoint** | `GET /api/records/director/overview` |
| **Guard** | JwtAuthGuard + RolesGuard (Director, Admin, SuperAdmin) |
| **Filtros opcionales** | regionId |
| **Datos** | KPIs, desglose por clase, observaciones de estado |

### 3.9 Obtener Catálogos y Regiones
| Campo | Detalle |
|-------|---------|
| **Endpoints** | `GET /api/catalog/record-fields`, `GET /api/catalog/regions` |

---

## 4. Procesos del Director

### 4.1 Autenticación
| Campo | Detalle |
|-------|---------|
| **Endpoint** | `POST /api/auth/login` |
| **Auditoría** | `USER_LOGGED_IN` |

### 4.2 Obtener Perfil Actual
| Campo | Detalle |
|-------|---------|
| **Endpoint** | `GET /api/auth/me` |

### 4.3 Ver Dashboard Directivo (KPIs)
| Campo | Detalle |
|-------|---------|
| **Endpoint** | `GET /api/records/director/overview` |
| **Guard** | JwtAuthGuard + RolesGuard (Director, Admin, SuperAdmin) |
| **Filtros opcionales** | regionId |
| **Datos** | Total de vehículos, delegaciones activas, regiones activas, desglose por clase de vehículo, observaciones por estado físico |
| **WebSocket** | Se une a sala `records:oversight`; recibe actualizaciones en tiempo real |

### 4.4 Ver Overview Global de Reportes
| Campo | Detalle |
|-------|---------|
| **Endpoint** | `GET /api/records/reports/overview` |
| **Guard** | JwtAuthGuard + RolesGuard (Admin, SuperAdmin, Director) |

### 4.5 Obtener Regiones (para filtros del mapa)
| Campo | Detalle |
|-------|---------|
| **Endpoint** | `GET /api/catalog/regions` |

> **Nota:** El Director no tiene capacidad de escritura (crear, editar, eliminar). Su rol es exclusivamente de consulta y supervisión ejecutiva.

---

## 5. Procesos del SuperAdmin

### 5.1 Autenticación
| Campo | Detalle |
|-------|---------|
| **Endpoint** | `POST /api/auth/login` |
| **Auditoría** | `USER_LOGGED_IN` |

### 5.2 Obtener Perfil Actual
| Campo | Detalle |
|-------|---------|
| **Endpoint** | `GET /api/auth/me` |

### 5.3 Crear Usuario
| Campo | Detalle |
|-------|---------|
| **Endpoint** | `POST /api/users` |
| **Guard** | JwtAuthGuard + RolesGuard (SuperAdmin) |
| **Datos requeridos** | firstName, lastName, grade, email, password, role |
| **Datos opcionales** | phone, regionId, delegationId |
| **Proceso** | 1. Valida que email no exista<br>2. Hashea contraseña (bcryptjs, 10 rounds)<br>3. Crea usuario en BD |
| **Auditoría** | `USER_CREATED` |
| **WebSocket** | Evento broadcast a superadmin |

### 5.4 Listar Todos los Usuarios
| Campo | Detalle |
|-------|---------|
| **Endpoint** | `GET /api/users` |
| **Guard** | JwtAuthGuard + RolesGuard (SuperAdmin) |

### 5.5 Editar Usuario
| Campo | Detalle |
|-------|---------|
| **Endpoint** | `PATCH /api/users/:id` |
| **Guard** | JwtAuthGuard + RolesGuard (SuperAdmin) |
| **Restricción** | No puede editar un usuario con rol superadmin |
| **Datos editables** | firstName, lastName, grade, phone, email, role, regionId, delegationId, isActive |
| **Auditoría** | `USER_UPDATED` |

### 5.6 Eliminar Usuario (Soft Delete)
| Campo | Detalle |
|-------|---------|
| **Endpoint** | `DELETE /api/users/:id` |
| **Guard** | JwtAuthGuard + RolesGuard (SuperAdmin) |
| **Restricción** | No puede eliminar un usuario con rol superadmin |
| **Proceso** | Establece deletedAt = timestamp actual |
| **Auditoría** | `USER_SOFT_DELETED` |

### 5.7 Ver Auditoría en Tiempo Real
| Campo | Detalle |
|-------|---------|
| **Endpoint** | `GET /api/audit-logs/live` |
| **Guard** | JwtAuthGuard + RolesGuard (SuperAdmin) |
| **Datos** | Logs recientes de auditoría con acción, entidad, actor, metadata |
| **WebSocket** | Se une a sala `role:superadmin`; recibe evento `audit.created` en tiempo real |

### 5.8 Todos los Procesos de Admin
| Detalle |
|---------|
| El SuperAdmin tiene acceso a todos los endpoints de Admin: overview, editar registros, eliminar registros, transferencias, reportes, dashboard directivo |

---

## 6. Tabla de Eventos de Auditoría

| Evento de Auditoría | Roles que lo generan | Descripción |
|---------------------|---------------------|-------------|
| `USER_LOGGED_IN` | Todos | Inicio de sesión exitoso |
| `USER_CREATED` | SuperAdmin | Creación de nuevo usuario |
| `USER_UPDATED` | SuperAdmin | Modificación de datos de usuario |
| `USER_SOFT_DELETED` | SuperAdmin | Eliminación suave de usuario |
| `RECORD_CREATED` | Capturist | Nuevo registro de vehículo |
| `RECORD_UPDATED` | Capturist, Admin, SuperAdmin | Edición de registro de vehículo |
| `RECORD_SOFT_DELETED` | Admin, SuperAdmin | Eliminación suave de vehículo |
| `RECORD_TRANSFERRED` | Capturist, RegionalManager, Admin, SuperAdmin | Transferencia de vehículo entre delegaciones |
| `DELEGATION_ROSTER_REPORT_SUBMITTED_WITH_CHANGES` | Capturist | Reporte de padrón de delegación con cambios detectados |
| `DELEGATION_ROSTER_REPORT_SUBMITTED_WITHOUT_CHANGES` | Capturist | Reporte de padrón de delegación sin cambios |
| `REGION_ROSTER_REPORT_SUBMITTED_WITH_CHANGES` | RegionalManager | Reporte regional con cambios detectados |
| `REGION_ROSTER_REPORT_SUBMITTED_WITHOUT_CHANGES` | RegionalManager | Reporte regional sin cambios |

### Estructura de un Log de Auditoría

| Campo | Tipo | Descripción |
|-------|------|-------------|
| action | string | Tipo de acción (ver tabla anterior) |
| entityType | string | Tipo de entidad afectada (User, Record, etc.) |
| entityId | UUID | ID del registro afectado |
| metadata | JSONB | Datos adicionales del evento |
| actor | UserEntity | Usuario que realizó la acción (nullable, SET NULL on delete) |
| createdAt | timestamp | Fecha y hora del evento |

---

## 7. Procesos del Sistema (Automáticos)

### 7.1 Bootstrap de SuperAdmin
| Campo | Detalle |
|-------|---------|
| **Trigger** | Arranque de la aplicación (app bootstrap) |
| **Condición** | Variables SUPERADMIN_EMAIL y SUPERADMIN_PASSWORD definidas |
| **Proceso** | Crea usuario superadmin si no existe |
| **Archivo** | `src/modules/users/superadmin-bootstrap.service.ts` |

### 7.2 Migración de Base de Datos
| Campo | Detalle |
|-------|---------|
| **Trigger** | Arranque de la aplicación (migrationsRun: true) |
| **Migración** | `1761140000000-init-schema.ts` |
| **Proceso** | Crea todas las tablas, índices, foreign keys si no existen |

### 7.3 WebSocket - Gestión de Salas
| Evento | Sala | Quién se une |
|--------|------|-------------|
| Conexión | `user:{userId}` | Todos los usuarios |
| Conexión | `region:{regionId}` | RegionalManager con región asignada |
| Conexión | `role:superadmin` | SuperAdmin |
| Conexión | `records:oversight` | Admin, Director, SuperAdmin |

### 7.4 Eventos WebSocket Emitidos

| Evento | Trigger | Destinatarios |
|--------|---------|--------------|
| `records.created` | Nuevo vehículo capturado | SuperAdmin, Admin/Director (oversight), Región del vehículo |
| `records.changed` | Edición, eliminación o transferencia | SuperAdmin, Admin/Director (oversight), Región del vehículo |
| `reports.submitted` | Reporte de padrón enviado | SuperAdmin, Admin/Director (oversight) |
| `audit.created` | Cualquier acción auditada | SuperAdmin |

### 7.5 Rate Limiting de Login
| Campo | Detalle |
|-------|---------|
| **Máximo intentos** | 5 por combinación de IP + email |
| **Ventana de tiempo** | 10 minutos |
| **Acción al exceder** | Rechazo de intento con mensaje de error |
