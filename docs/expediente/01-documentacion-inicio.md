# Sistema de Control Vehicular - Documentación de Inicio

## 1. Información General del Proyecto

| Campo | Detalle |
|-------|---------|
| **Nombre** | Sistema de Control Vehicular |
| **Versión** | 0.1.0 |
| **Propósito** | Sistema integral para el registro, seguimiento y control de vehículos institucionales distribuidos en regiones y delegaciones |
| **Tipo** | Aplicación web full-stack con actualizaciones en tiempo real |

---

## 2. Stack Tecnológico

### Backend
| Tecnología | Versión | Propósito |
|------------|---------|-----------|
| NestJS | v11.1.3 | Framework backend (Node.js) |
| TypeScript | - | Lenguaje de programación |
| TypeORM | v0.3.24 | ORM para base de datos |
| PostgreSQL | - | Base de datos relacional |
| JWT (@nestjs/jwt) | - | Autenticación por tokens |
| Passport + bcryptjs | - | Autenticación y hash de contraseñas |
| Socket.IO | v4.8.1 | Comunicación en tiempo real (WebSockets) |
| class-validator | - | Validación de DTOs |

### Frontend
| Tecnología | Versión | Propósito |
|------------|---------|-----------|
| React | v19.1.0 | Biblioteca de UI |
| TypeScript | - | Lenguaje de programación |
| Vite | v6.3.5 | Bundler y dev server |
| react-router-dom | v7.6.0 | Enrutamiento |
| react-hook-form + Zod | v7.56.4 / v3.24.4 | Formularios con validación |
| Leaflet + react-leaflet | v1.9.4 / v5.0.0 | Mapas interactivos |
| sweetalert2 | v11.26.24 | Alertas y diálogos |
| socket.io-client | v4.8.1 | Cliente WebSocket |

---

## 3. Arquitectura del Sistema

```
┌─────────────────────────────────────────────────────────┐
│                    FRONTEND (React)                      │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────┐ │
│  │  Pages   │ │Components│ │ Services │ │   Types    │ │
│  └──────────┘ └──────────┘ └──────────┘ └────────────┘ │
│                      │           │                      │
│              API REST (fetch)   WebSocket (Socket.IO)   │
└──────────────────────┼───────────┼──────────────────────┘
                       │           │
┌──────────────────────┼───────────┼──────────────────────┐
│                   BACKEND (NestJS)                       │
│  ┌────────┐ ┌───────┐ ┌────────┐ ┌────────┐ ┌────────┐ │
│  │  Auth  │ │Catalog│ │Records │ │ Users  │ │ Audit  │ │
│  │ Module │ │Module │ │ Module │ │ Module │ │  Logs  │ │
│  └────────┘ └───────┘ └────────┘ └────────┘ └────────┘ │
│                      │                                  │
│              ┌───────┴───────┐                          │
│              │  Realtime     │   Socket.IO Gateway       │
│              │   Module      │                          │
│              └───────────────┘                          │
│                      │                                  │
│              ┌───────┴───────┐                          │
│              │   TypeORM     │   ORM Layer               │
│              └───────┬───────┘                          │
└──────────────────────┼──────────────────────────────────┘
                       │
              ┌────────┴────────┐
              │   PostgreSQL    │
              │   (Database)    │
              └─────────────────┘
```

---

## 4. Estructura del Proyecto

```
SISTEMA DE CONTROL VEHICULAR/
├── backend/
│   ├── src/
│   │   ├── common/           # Utilidades compartidas
│   │   │   ├── auth/         # Guards, decorators de roles
│   │   │   ├── entities/     # Entity base (BaseEntity)
│   │   │   └── enums/        # Enumeraciones (Role)
│   │   ├── config/           # Configuración TypeORM
│   │   ├── database/
│   │   │   └── migrations/   # Migraciones de BD
│   │   ├── modules/
│   │   │   ├── audit-logs/   # Registro de auditoría
│   │   │   ├── auth/         # Autenticación JWT
│   │   │   ├── catalog/      # Catálogos (regiones, delegaciones)
│   │   │   ├── realtime/     # Gateway WebSocket
│   │   │   │   └── records/  # CRUD de vehículos, transferencias, reportes
│   │   │   └── users/        # Gestión de usuarios
│   │   └── scripts/          # Scripts de seed (datos iniciales)
│   └── .env                  # Variables de entorno
│
├── frontend/
│   └── src/
│       ├── components/       # Componentes reutilizables
│       ├── lib/              # Utilidades (api, socket, routes)
│       ├── modules/          # Contextos y hooks
│       │   ├── auth/         # Contexto de autenticación
│       │   ├── director/     # Hooks del dashboard directivo
│       │   └── records/      # Hooks de datos de capturista
│       ├── pages/            # Páginas de la aplicación
│       └── types.ts          # Definiciones de TypeScript
│
└── expediente/               # Esta carpeta de documentación
```

---

## 5. Módulos del Sistema

### 5.1 Módulo de Autenticación (Auth)
- Login con email y contraseña
- Generación y validación de tokens JWT
- Rate limiting (máximo 5 intentos por IP/email en 10 minutos)
- Hash de contraseñas con bcryptjs (10 rounds)
- Registro de auditoría en cada inicio de sesión

### 5.2 Módulo de Catálogos (Catalog)
- Regiones y delegaciones precargadas (9 regiones, 41 delegaciones)
- Catálogos para formularios de vehículos:
  - Tipo de uso, clase de vehículo, estado físico, estatus, clasificación de bien

### 5.3 Módulo de Registros (Records)
- CRUD de registros vehiculares
- Transferencias de vehículos entre delegaciones
- Reportes de padrón vehicular (por delegación y región)
- Dashboards por rol con vistas en tiempo real

### 5.4 Módulo de Usuarios (Users)
- Creación, edición, listado y eliminación suave de usuarios
- Asignación de roles y asignación a regiones/delegaciones
- Bootstrap automático del superadmin

### 5.5 Módulo de Auditoría (Audit Logs)
- Registro de todas las acciones sensibles
- Broadcast en tiempo real a superadmin
- Consulta de logs con filtros

### 5.6 Módulo de Tiempo Real (Realtime)
- Gateway WebSocket con Socket.IO
- Salas por usuario, región, rol
- Eventos: creación/cambio de registros, reportes, auditoría

---

## 6. Variables de Entorno

### Backend (.env)
| Variable | Descripción |
|----------|-------------|
| PORT | Puerto del servidor (default: 3000) |
| HOST | Host del servidor (default: 0.0.0.0) |
| DATABASE_HOST | Host de PostgreSQL |
| DATABASE_PORT | Puerto de PostgreSQL (default: 5432) |
| DATABASE_NAME | Nombre de la base de datos |
| DATABASE_USERNAME | Usuario de BD |
| DATABASE_PASSWORD | Contraseña de BD |
| JWT_SECRET | Clave secreta para JWT |
| JWT_EXPIRES_IN | Expiración del token (default: 8h) |
| FRONTEND_ORIGINS | Orígenes permitidos para CORS |
| SUPERADMIN_* | Datos del superadmin inicial |

### Frontend (.env)
| Variable | Descripción |
|----------|-------------|
| VITE_API_URL | URL del API backend |
| VITE_SOCKET_URL | URL del WebSocket |

---

## 7. Comandos de Inicio Rápido

### Backend
```bash
cd backend
npm install
cp .env.example .env   # Configurar variables
npm run build
npm run typeorm migration:run
npm run seed:users     # Opcional: usuarios de prueba
npm run seed:vehicles  # Opcional: vehículos de prueba
npm run start:dev
```

### Frontend
```bash
cd frontend
npm install
cp .env.example .env   # Configurar variables
npm run dev
```

---

## 8. Base de Datos

### Tablas
| Tabla | Descripción |
|-------|-------------|
| regions | Regiones geográficas |
| delegations | Delegaciones asignadas a regiones |
| users | Usuarios del sistema |
| records | Registros de vehículos |
| audit_logs | Logs de auditoría |
| vehicle_roster_reports | Reportes de padrón vehicular |
| vehicle_transfers | Historial de transferencias de vehículos |

---

## 9. Características Principales

- **Autenticación JWT** con renovación y expiración configurable
- **Control de acceso basado en roles** (RBAC) con 5 roles
- **Actualizaciones en tiempo real** vía WebSocket
- **Reportes de padrón vehicular** con comparativa de cambios
- **Mapa interactivo** con distribución de vehículos por delegación
- **Auditoría completa** de todas las acciones sensibles
- **Eliminación suave** (soft delete) en usuarios y registros
- **Validación de formularios** con Zod en frontend y class-validator en backend
- **Seguridad HTTP** con headers de protección (HSTS, CSP, X-Frame-Options)
