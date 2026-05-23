# Documentación de Seguridad

## Tabla de Contenidos
1. [Políticas de Seguridad](#1-políticas-de-seguridad)
2. [Autenticación](#2-autenticación)
3. [Autorización y Control de Acceso](#3-autorización-y-control-de-acceso)
4. [Protección de Datos](#4-protección-de-datos)
5. [Seguridad de la API](#5-seguridad-de-la-api)
6. [Seguridad del Frontend](#6-seguridad-del-frontend)
7. [Seguridad de WebSockets](#7-seguridad-de-websockets)
8. [Auditoría y Monitoreo](#8-auditoría-y-monitoreo)
9. [Vulnerabilidades y Mitigaciones](#9-vulnerabilidades-y-mitigaciones)
10. [Recomendaciones de Mejora](#10-recomendaciones-de-mejora)

---

## 1. Políticas de Seguridad

### 1.1 Principios de Seguridad Aplicados

| Principio | Implementación |
|-----------|---------------|
| **Mínimo privilegio** | Cada rol tiene acceso solo a lo necesario |
| **Defensa en profundidad** | Múltiples capas: JWT + Guards + Data filtering |
| **Seguridad por diseño** | Validación en frontend y backend |
| **No confianza** | Todo request se valida, incluso con token válido |
| **Registro completo** | Todas las acciones sensibles se auditan |

### 1.2 Clasificación de Datos

| Tipo de Dato | Clasificación | Ejemplo |
|-------------|--------------|---------|
| Credenciales | **Confidencial** | Passwords, JWT_SECRET |
| Datos de usuarios | **Confidencial** | Email, teléfono, grado |
| Registros vehiculares | **Interno** | Placas, custodio, ubicación |
| Logs de auditoría | **Confidencial** | Acciones, actores, timestamps |
| Catálogos | **Público** | Regiones, delegaciones |

---

## 2. Autenticación

### 2.1 JWT (JSON Web Tokens)

#### Características
| Aspecto | Detalle |
|---------|---------|
| **Algoritmo** | HS256 (HMAC + SHA-256) |
| **Secret** | Variable de entorno JWT_SECRET |
| **Expiración** | Configurable (default: 8 horas) |
| **Payload** | sub, email, role, regionId, delegationId |

#### Estructura del Token
```
Header:  { "alg": "HS256", "typ": "JWT" }
Payload: { "sub": "uuid", "email": "...", "role": "...", "regionId": "...", "delegationId": "...", "iat": 1234, "exp": 5678 }
Signature: HMACSHA256(base64UrlEncode(header) + "." + base64UrlEncode(payload), JWT_SECRET)
```

#### Ciclo de Vida del Token
```
┌─────────────┐     POST /api/auth/login     ┌─────────────┐
│  Frontend   │ ────────────────────────────► │   Backend   │
│             │                               │             │
│             │ ◄──────────────────────────── │             │
│             │   Response: { accessToken }   │   Valida    │
│             │                               │   creds     │
│ sessionStorage.setItem()                    │   Genera    │
│             │                               │   JWT       │
└─────────────┘                               └─────────────┘

┌─────────────┐   GET /api/auth/me (Bearer)  ┌─────────────┐
│  Frontend   │ ────────────────────────────► │   Backend   │
│             │   Header: Authorization       │             │
│             │   "Bearer <token>"            │   Valida    │
│             │ ◄──────────────────────────── │   token     │
│             │   Response: { user }          │   Retorna   │
└─────────────┘                               │   perfil    │
                                              └─────────────┘
```

### 2.2 Hash de Contraseñas

| Aspecto | Detalle |
|---------|---------|
| **Algoritmo** | bcryptjs |
| **Rounds** | 10 (saltRounds) |
| **Proceso** | `bcrypt.hash(password, 10)` |
| **Verificación** | `bcrypt.compare(input, storedHash)` |
| **Almacenamiento** | Solo el hash, nunca la contraseña plana |

### 2.3 Rate Limiting de Login

| Aspecto | Detalle |
|---------|---------|
| **Máximo intentos** | 5 |
| **Ventana** | 10 minutos |
| **Clave** | Combinación de IP + email |
| **Acción al exceder** | Rechazo con mensaje de error |
| **Reset** | Automático después de la ventana |

> **Nota**: El rate limiting está implementado en memoria. En producción con múltiples instancias, se recomienda usar Redis.

### 2.4 Almacenamiento de Tokens

| Aspecto | Detalle |
|---------|---------|
| **Ubicación** | sessionStorage |
| **Persistencia** | Solo durante la sesión del navegador |
| **Ventaja** | Se elimina al cerrar el navegador |
| **Riesgo** | Vulnerable a XSS (mitigado por CSP y sanitización) |
| **Alternativa no usada** | localStorage (persistente, más riesgoso) |

### 2.5 Bootstrap de SuperAdmin

| Aspecto | Detalle |
|---------|---------|
| **Trigger** | Arranque de la aplicación |
| **Condiciones** | SUPERADMIN_EMAIL y SUPERADMIN_PASSWORD definidos |
| **Protección** | Solo crea si no existe |
| **Seguridad** | No muestra el usuario en listados protegidos |

---

## 3. Autorización y Control de Acceso

### 3.1 Modelo RBAC (Role-Based Access Control)

```
┌──────────────┐
│  SUPERADMIN  │ ← Acceso total + gestión de usuarios + auditoría
└──────┬───────┘
       │
┌──────▼───────┐
│     ADMIN    │ ← Acceso global a registros + edición/eliminación
└──────┬───────┘
       │
┌──────▼───────┐
│   DIRECTOR   │ ← Solo lectura: KPIs, mapa, overview
└──────┬───────┘
       │
┌──────▼───────────┐
│ REGIONAL_MANAGER │ ← Acceso a delegaciones de su región
└──────┬───────────┘
       │
┌──────▼───────┐
│  CAPTURIST   │ ← Acceso solo a su delegación
└──────────────┘
```

### 3.2 Matriz de Permisos Detallada

| Endpoint | C | RM | A | D | SA |
|----------|---|----|---|---|----|
| POST /api/auth/login | ✅ | ✅ | ✅ | ✅ | ✅ |
| GET /api/auth/me | ✅ | ✅ | ✅ | ✅ | ✅ |
| GET /api/catalog/* | ✅ | ✅ | ✅ | ✅ | ✅ |
| POST /api/records | ✅ | ❌ | ❌ | ❌ | ❌ |
| GET /api/records/my | ✅ | ❌ | ❌ | ❌ | ❌ |
| PATCH /api/records/:id | ✅* | ❌ | ✅ | ❌ | ✅ |
| DELETE /api/records/:id | ❌ | ❌ | ✅ | ❌ | ✅ |
| POST /api/records/:id/transfer | ✅* | ✅* | ✅ | ❌ | ✅ |
| GET /api/records/region/live | ❌ | ✅ | ❌ | ❌ | ✅ |
| GET /api/records/admin/overview | ❌ | ❌ | ✅ | ❌ | ✅ |
| GET /api/records/director/overview | ❌ | ❌ | ✅ | ✅ | ✅ |
| POST /api/records/reports | ✅ | ❌ | ❌ | ❌ | ❌ |
| POST /api/records/reports/region | ❌ | ✅ | ❌ | ❌ | ❌ |
| GET /api/records/reports/overview | ❌ | ❌ | ✅ | ✅ | ✅ |
| POST /api/users | ❌ | ❌ | ❌ | ❌ | ✅ |
| GET /api/users | ❌ | ❌ | ❌ | ❌ | ✅ |
| PATCH /api/users/:id | ❌ | ❌ | ❌ | ❌ | ✅† |
| DELETE /api/users/:id | ❌ | ❌ | ❌ | ❌ | ✅† |
| GET /api/audit-logs/live | ❌ | ❌ | ❌ | ❌ | ✅ |

✅* = Con restricciones (solo delegación/región propia)
✅† = No puede editar/eliminar superadmin

### 3.3 Implementación de Guards

#### JwtAuthGuard
```typescript
// Valida el token JWT en cada request protegido
// Extrae: sub, email, role, regionId, delegationId
// Si el token es inválido o expirado → 401 Unauthorized
```

#### RolesGuard
```typescript
// Verifica que user.role esté en @RequireRoles(...)
// Si el rol no está permitido → 403 Forbidden
```

#### Data-Level Filtering
```typescript
// El servicio filtra datos según el contexto del usuario:
// - Capturist: solo delegationId = user.delegationId
// - RegionalManager: solo regionId = user.regionId
// - Admin/Director/SuperAdmin: sin filtro (o filtros opcionales)
```

### 3.4 Protección de SuperAdmin

| Protección | Implementación |
|-----------|---------------|
| No editable | UsersService rechaza PATCH si target.role === SUPERADMIN |
| No eliminable | UsersService rechaza DELETE si target.role === SUPERADMIN |
| Bootstrap seguro | Solo crea si no existe, no expone contraseña |

---

## 4. Protección de Datos

### 4.1 Datos en Tránsito

| Aspecto | Implementación |
|---------|---------------|
| **HTTPS** | Forzado via HSTS en producción |
| **WSS** | WebSocket seguro en producción |
| **CORS** | Orígenes restrictivos configurables |
| **Headers** | Seguridad HTTP configurada en main.ts |

### 4.2 Datos en Reposo

| Aspecto | Implementación |
|---------|---------------|
| **Passwords** | Hash bcryptjs (10 rounds) |
| **JWT Secret** | Variable de entorno, no en código |
| **DB Credentials** | Variables de entorno |
| **Soft Delete** | Datos no se eliminan físicamente |

### 4.3 Validación de Entrada

| Capa | Herramienta | Propósito |
|------|------------|-----------|
| **Frontend** | Zod + react-hook-form | Validación antes de enviar |
| **Backend** | class-validator + class-transformer | Validación en servidor |
| **Pipe** | ValidationPipe | Whitelist, forbidNonWhitelisted, transform |

#### Ejemplo de Validación Backend
```typescript
// DTO con class-validator
class CreateRecordDto {
  @IsString() plates: string;
  @IsString() brand: string;
  @IsEnum(UseType) useType: UseType;
  // ... todos los campos validados
}
```

### 4.4 Prevención de Inyección

| Tipo | Protección |
|------|-----------|
| **SQL Injection** | TypeORM usa parameterized queries |
| **XSS** | React escapa contenido automáticamente |
| **CSRF** | JWT en header (no cookie) mitiga riesgo |

---

## 5. Seguridad de la API

### 5.1 Endpoints Públicos

| Endpoint | Método | Protección |
|----------|--------|-----------|
| `/api/auth/login` | POST | Rate limiting (5 intentos/10min) |

### 5.2 Endpoints Protegidos

Todos los demás endpoints requieren:
1. **Token JWT válido** (JwtAuthGuard)
2. **Rol autorizado** (RolesGuard, donde aplique)

### 5.3 Headers de Respuesta

| Header | Valor | Propósito |
|--------|-------|-----------|
| X-Frame-Options | DENY | Prevenir clickjacking (no iframe) |
| X-Content-Type-Options | nosniff | Prevenir MIME type sniffing |
| Referrer-Policy | strict-origin-when-cross-origin | Controlar información de referrer |
| Cross-Origin-Opener-Policy | same-origin | Aislar contexto de navegación |
| Cross-Origin-Resource-Policy | same-origin | Restringir carga de recursos cross-origin |
| Strict-Transport-Security | max-age=... | Forzar HTTPS |

### 5.4 CORS

| Aspecto | Configuración |
|---------|--------------|
| **Orígenes permitidos** | FRONTEND_ORIGINS (default: localhost:5173) |
| **Credentials** | true |
| **Métodos** | GET, POST, PATCH, DELETE, OPTIONS |
| **Headers permitidos** | Content-Type, Authorization |

---

## 6. Seguridad del Frontend

### 6.1 Almacenamiento de Tokens

| Aspecto | Detalle |
|---------|---------|
| **Token** | sessionStorage (se elimina al cerrar navegador) |
| **No se usa** | localStorage (persistente entre sesiones) |
| **No se usa** | Cookies (evita CSRF pero requiere manejo manual) |

### 6.2 Protección de Rutas

```typescript
// ProtectedRoute component
if (!isAuthenticated) → redirect to /portal
if (!allowedRoles.includes(user.role)) → redirect to /
```

### 6.3 Sanitización

| Aspecto | Implementación |
|---------|---------------|
| **React** | Escapa contenido JSX automáticamente |
| **Formularios** | Validación Zod antes de enviar |
| **API** | Respuestas tipadas con TypeScript |

### 6.4 Limpieza de Legacy Keys

```typescript
// auth-storage.ts
// Limpia claves legacy: 'token', 'user', 'authToken'
// Usa solo: 'vehicle_control_access_token'
```

---

## 7. Seguridad de WebSockets

### 7.1 Autenticación

| Aspecto | Detalle |
|---------|---------|
| **Método** | Token JWT en `socket.auth.token` o header `Authorization` |
| **Validación** | El gateway valida el token antes de permitir conexión |
| **Rechazo** | Si el token es inválido → desconexión |

### 7.2 Salas y Aislamiento

| Sala | Quién accede | Qué ve |
|------|-------------|--------|
| `user:{userId}` | Solo ese usuario | Notificaciones propias |
| `region:{regionId}` | RegionalManager de esa región | Actividad de su región |
| `role:superadmin` | SuperAdmin | Auditoría global |
| `records:oversight` | Admin, Director, SuperAdmin | Actividad global de registros |

### 7.3 Eventos

| Evento | Visibilidad |
|--------|------------|
| `records.created` | Solo salas correspondientes |
| `records.changed` | Solo salas correspondientes |
| `reports.submitted` | Solo salas correspondientes |
| `audit.created` | Solo `role:superadmin` |

---

## 8. Auditoría y Monitoreo

### 8.1 Eventos Auditados

| Evento | Datos Registrados |
|--------|------------------|
| USER_LOGGED_IN | actor, timestamp |
| USER_CREATED | actor, target user, metadata |
| USER_UPDATED | actor, target user, campos cambiados |
| USER_SOFT_DELETED | actor, target user |
| RECORD_CREATED | actor, record data, delegation |
| RECORD_UPDATED | actor, record id, campos cambiados |
| RECORD_SOFT_DELETED | actor, record id |
| RECORD_TRANSFERRED | actor, from, to, reason |
| DELEGATION_ROSTER_REPORT_* | actor, delegation, hasChanges |
| REGION_ROSTER_REPORT_* | actor, region, hasChanges |

### 8.2 Estructura del Log

```typescript
interface AuditLog {
  id: string;
  action: string;       // Tipo de acción
  entityType: string;   // User, Record, etc.
  entityId: string;     // UUID del registro
  metadata: object;     // Datos adicionales
  actor: User | null;   // Quién realizó la acción
  createdAt: Date;      // Cuándo
}
```

### 8.3 Protección de Logs

| Aspecto | Detalle |
|---------|---------|
| **Acceso** | Solo SuperAdmin |
| **Actor** | SET NULL on delete del usuario (protege identidad) |
| **Inmutabilidad** | Solo se crean, no se editan ni eliminan |
| **Tiempo real** | Broadcast via WebSocket a superadmin |

---

## 9. Vulnerabilidades y Mitigaciones

### 9.1 OWASP Top 10 - Estado Actual

| # | Vulnerabilidad | Estado | Mitigación Actual |
|---|---------------|--------|------------------|
| A01 | Broken Access Control | ✅ Mitigado | RBAC con Guards + Data filtering |
| A02 | Cryptographic Failures | ✅ Mitigado | bcryptjs, JWT con secret seguro |
| A03 | Injection | ✅ Mitigado | TypeORM parameterized queries |
| A04 | Insecure Design | ⚠️ Parcial | Rate limiting solo en login |
| A05 | Security Misconfiguration | ⚠️ Parcial | Headers básicos configurados |
| A06 | Vulnerable Components | ⚠️ Revisar | Dependencias actualizadas |
| A07 | Auth Failures | ✅ Mitigado | JWT + rate limiting en login |
| A08 | Data Integrity | ✅ Mitigado | Validación en frontend y backend |
| A09 | Logging Failures | ✅ Mitigado | Auditoría completa |
| A10 | SSRF | ✅ No aplica | No se hacen requests externos |

### 9.2 Riesgos Identificados

| Riesgo | Severidad | Descripción | Mitigación Actual | Mejora Sugerida |
|--------|-----------|-------------|-------------------|-----------------|
| Token XSS | Media | Token en sessionStorage vulnerable a XSS | React escaping | CSP headers, sanitización adicional |
| Rate limiting | Media | Solo en memoria, no distribuido | In-memory store | Redis para cluster |
| CSRF | Baja | JWT en header (no cookie) | Diseño actual | CSRF token si se usan cookies |
| JWT Expiración | Baja | 8h puede ser largo | Configurable | Refresh tokens |
| Logs sin rotación | Media | Logs crecen indefinidamente | Archivos locales | Rotación, retención |
| Secrets en env | Baja | .env en disco, no en repo | .gitignore | Vault o secrets manager |

---

## 10. Recomendaciones de Mejora

### 10.1 Corto Plazo

| # | Mejora | Impacto | Esfuerzo |
|---|--------|---------|----------|
| 1 | Agregar CSP (Content Security Policy) headers | Alto | Bajo |
| 2 | Implementar refresh tokens | Medio | Medio |
| 3 | Rate limiting distribuido (Redis) | Medio | Medio |
| 4 | Rotación de logs de auditoría | Medio | Bajo |
| 5 | Validación de complejidad de contraseñas | Medio | Bajo |

### 10.2 Mediano Plazo

| # | Mejora | Impacto | Esfuerzo |
|---|--------|---------|----------|
| 6 | Auditoría de dependencias (npm audit) | Alto | Bajo |
| 7 | Implementar 2FA para roles administrativos | Alto | Alto |
| 8 | Cifrado de datos sensibles en BD | Medio | Medio |
| 9 | API versioning | Medio | Bajo |
| 10 | Health check endpoint | Bajo | Bajo |

### 10.3 Largo Plazo

| # | Mejora | Impacto | Esfuerzo |
|---|--------|---------|----------|
| 11 | Secrets management (Vault, AWS Secrets) | Alto | Alto |
| 12 | SIEM integration para auditoría | Alto | Alto |
| 13 | Penetration testing formal | Alto | Externo |
| 14 | Compliance (ISO 27001, etc.) | Alto | Alto |
| 15 | Backup y disaster recovery | Alto | Medio |

### 10.4 Checklist de Producción

- [ ] JWT_SECRET generado de forma criptográficamente segura
- [ ] CONTRASEÑAS de base de datos fuertes y únicas
- [ ] HTTPS/TLS configurado correctamente
- [ ] FRONTEND_ORIGINS restringido al dominio real
- [ ] Rate limiting configurado para producción
- [ ] Logs de auditoría con retención definida
- [ ] Backups automáticos de base de datos
- [ ] Monitoreo de errores (Sentry, etc.)
- [ ] Variables de entorno no en repositorio
- [ ] Dependencias actualizadas y auditadas
- [ ] Superadmin con credenciales únicas
- [ ] Plan de respuesta a incidentes
