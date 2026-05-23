# Flujo de la Aplicación - Capacitación por Rol

## Tabla de Contenidos
1. [Roles del Sistema](#1-roles-del-sistema)
2. [Flujo General de la Aplicación](#2-flujo-general-de-la-aplicación)
3. [Capacitación por Rol](#3-capacitación-por-rol)
4. [Flujos Cruzados entre Roles](#4-flujos-cruzados-entre-roles)

---

## 1. Roles del Sistema

| Rol | Descripción | Alcance |
|-----|-------------|---------|
| **Capturist** | Personal que captura y gestiona vehículos de su delegación | Delegación asignada |
| **Regional Manager** | Supervisa las delegaciones de su región | Región asignada |
| **Admin** | Administrador global del sistema | Todo el sistema |
| **Director** | Vista ejecutiva con KPIs y mapa | Todo el sistema (solo lectura) |
| **SuperAdmin** | Administrador máximo, gestiona usuarios y auditoría | Todo el sistema |

---

## 2. Flujo General de la Aplicación

```
┌──────────────────────────────────────────────────────────────────┐
│                     PANTALLA DE LOGIN                             │
│   El usuario ingresa email y contraseña                          │
│   → Validación de credenciales (JWT)                             │
│   → Si éxito: token almacenado en sessionStorage                 │
│   → Si fallo: alerta de error con SweetAlert2                    │
└──────────────────────────┬───────────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────────┐
│                     HOME PAGE (Dashboard)                         │
│   Contenido dinámico según el rol del usuario                    │
│   → Estadísticas rápidas                                         │
│   → Acciones rápidas según permisos                              │
│   → Navegación lateral con opciones del rol                      │
└──────────────────────────┬───────────────────────────────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        ▼                  ▼                  ▼
  /workspace          /monitor           /overview
  (Capturist)      (RegionalMgr)        (Admin)
        │                  │                  │
        ▼                  ▼                  ▼
  /archive           /insights            /control
  (Capturist)       (Director)           (SuperAdmin)
```

---

## 3. Capacitación por Rol

### 3.1 CAPTURIST (Capturista)

#### ¿Quién es?
Personal operativo asignado a una delegación específica. Es responsable de registrar y mantener actualizada la información de los vehículos de su delegación.

#### ¿Qué puede hacer?

| Acción | Descripción | Ruta |
|--------|-------------|------|
| **Iniciar sesión** | Ingresa con sus credenciales | `/portal` |
| **Ver dashboard** | Estadísticas de su delegación | `/` |
| **Capturar vehículos** | Registrar nuevos vehículos con todos sus datos | `/workspace` |
| **Ver mis registros** | Listado de vehículos que ha capturado | `/archive` |
| **Editar registros** | Modificar información de vehículos (solo de su delegación) | `/archive` |
| **Transferir vehículos** | Mover vehículos a otra delegación con motivo | `/archive` |
| **Enviar reporte de padrón** | Confirmar el estado del padrón de su delegación | `/archive` |
| **Ver reportes de mi delegación** | Historial de reportes enviados | `/archive` |

#### Flujo de Trabajo del Capturista

```
1. INICIO DE SESIÓN
   │
   ▼
2. DASHBOARD - Ve resumen de su actividad
   │  - Vehículos capturados
   │  - Reportes enviados
   │
   ▼
3. CAPTURA DE VEHÍCULOS (/workspace)
   │  - Llena formulario con validación:
   │    • Placas, marca, tipo, uso, clase
   │    • Modelo, motor, serie, custodio
   │    • No. de placa, estado físico, estatus
   │    • Clasificación del bien, observaciones
   │  - Envía el registro
   │  - El sistema notifica en tiempo real a supervisores
   │
   ▼
4. CONSULTA DE REGISTROS (/archive)
   │  - Ve lista de vehículos de su delegación
   │  - Filtra por estado, delegación
   │  - Puede editar registros existentes
   │  - Puede transferir vehículos a otra delegación
   │
   ▼
5. REPORTE DE PADRÓN
      - Genera reporte de padrón vehicular
      - El sistema compara con movimientos desde último reporte
      - Marca si hay cambios o no
      - Envía reporte para supervisión regional
```

#### Campo de Formulario - Detalle

| Campo | Tipo | Valores Permitidos |
|-------|------|-------------------|
| Placas | Texto | Libre |
| Marca | Texto | Libre |
| Tipo | Texto | Libre |
| Uso | Select | PATRULLA, PARTICULAR, OTRO (permite personalizado) |
| Clase | Select | SEDAN, PICK UP, MOTOCICLETA, GRUA, BICICLETA |
| Modelo | Texto | Libre |
| Motor | Texto | Libre |
| Serie | Texto | Libre |
| Custodio | Texto | Libre |
| No. Placa | Texto | Libre |
| Estado Físico | Select | BUENO, REGULAR, MALO |
| Estatus | Select | ACTIVO, INACTIVO, SINIESTRADO, PARA BAJA, OTRO |
| Clasificación | Select | PATRIMONIAL, ARRENDAMIENTO, OTRO |
| Observaciones | Texto largo | Libre |

---

### 3.2 REGIONAL MANAGER (Gerente Regional)

#### ¿Quién es?
Supervisor que monitorea todas las delegaciones dentro de una región geográfica específica.

#### ¿Qué puede hacer?

| Acción | Descripción | Ruta |
|--------|-------------|------|
| **Iniciar sesión** | Ingresa con sus credenciales | `/portal` |
| **Ver dashboard** | Resumen de su región | `/` |
| **Monitoreo regional** | Ve actividad en tiempo real de todas las delegaciones de su región | `/monitor` |
| **Ver delegaciones** | Listado de delegaciones con sus reportes y actividad | `/monitor` |
| **Transferir vehículos** | Mover vehículos entre delegaciones de su región | `/monitor` |
| **Reportes regionales** | Envía reportes consolidados de su región | `/monitor` |
| **Ver reportes regionales** | Historial de reportes de su región | `/monitor` |

#### Flujo de Trabajo del Regional Manager

```
1. INICIO DE SESIÓN
   │
   ▼
2. DASHBOARD - Resumen de la región
   │  - Total de vehículos en la región
   │  - Delegaciones activas
   │  - Actividad reciente
   │
   ▼
3. MONITOREO REGIONAL (/monitor)
   │  - Ve todas las delegaciones de su región
   │  - Actividad en tiempo real (WebSocket)
   │  - Reportes pendientes y enviados por cada delegación
   │
   ▼
4. GESTIÓN DE TRANSFERENCIAS
   │  - Puede transferir vehículos entre delegaciones de su región
   │  - Debe especificar motivo de la transferencia
   │
   ▼
5. REPORTE REGIONAL
      - Consolida información de todas las delegaciones
      - Envía reporte regional con o sin cambios
      - Los administradores y directores pueden ver el resultado
```

---

### 3.3 ADMIN (Administrador)

#### ¿Quién es?
Administrador con acceso global a todo el sistema. Puede gestionar registros de cualquier delegación y ver la operación completa.

#### ¿Qué puede hacer?

| Acción | Descripción | Ruta |
|--------|-------------|------|
| **Iniciar sesión** | Ingresa con sus credenciales | `/portal` |
| **Ver dashboard** | Vista global del sistema | `/` |
| **Vista administrativa** | Panel global con filtros por región y delegación | `/overview` |
| **Ver reportes globales** | Resumen de todos los reportes de padrón | `/overview` |
| **Filtrar datos** | Por región, delegación, estatus | `/overview` |
| **Editar registros** | Modificar cualquier registro del sistema | `/overview` |
| **Eliminar registros** | Soft delete de vehículos | `/overview` |
| **Transferir vehículos** | Mover vehículos entre cualquier delegación | `/overview` |
| **Ver mapa** | Mapa interactivo (acceso compartido con Director) | `/insights/map` |
| **Ver dashboard directivo** | KPIs y métricas ejecutivas | `/insights` |

#### Flujo de Trabajo del Admin

```
1. INICIO DE SESIÓN
   │
   ▼
2. DASHBOARD - Vista global
   │  - Estadísticas totales del sistema
   │  - Regiones activas
   │  - Actividad reciente
   │
   ▼
3. PANEL ADMINISTRATIVO (/overview)
   │  - Filtros por región y delegación
   │  - Tabla de registros con estado de reportes
   │  - Transferencias de vehículos
   │  - Edición y eliminación de registros
   │
   ▼
4. GESTIÓN DE REGISTROS
   │  - Puede editar cualquier registro
   │  - Puede eliminar registros (soft delete)
   │  - Puede transferir vehículos entre cualquier delegación
   │
   ▼
5. SUPERVISIÓN DE REPORTES
      - Ve el overview global de reportes
      - Puede verificar el estado de cada delegación
```

---

### 3.4 DIRECTOR (Director)

#### ¿Quién es?
Nivel ejecutivo con acceso de lectura a métricas, KPIs y visualización geográfica del sistema. No realiza modificaciones, solo supervisa.

#### ¿Qué puede hacer?

| Acción | Descripción | Ruta |
|--------|-------------|------|
| **Iniciar sesión** | Ingresa con sus credenciales | `/portal` |
| **Ver dashboard** | Resumen ejecutivo | `/` |
| **Dashboard directivo** | KPIs, gráficos y métricas del sistema | `/insights` |
| **Ver desglose por clase** | Distribución de vehículos por tipo | `/insights` |
| **Ver observaciones de estado** | Estado general de los vehículos | `/insights` |
| **Mapa interactivo** | Mapa de Oaxaca con marcadores de delegaciones | `/insights/map` |
| **Filtrar por región** | Aplicar filtros en dashboard y mapa | `/insights`, `/insights/map` |

#### Flujo de Trabajo del Director

```
1. INICIO DE SESIÓN
   │
   ▼
2. DASHBOARD - Resumen ejecutivo
   │  - KPIs principales
   │  - Indicadores de rendimiento
   │
   ▼
3. DASHBOARD DIRECTIVO (/insights)
   │  - KPIs: total vehículos, delegaciones, regiones
   │  - Desglose por clase de vehículo (gráfica)
   │  - Observaciones de estado físico
   │  - Filtros por región
   │  - Actualización en tiempo real
   │
   ▼
4. MAPA INTERACTIVO (/insights/map)
      - Mapa de Oaxaca con marcadores por delegación
      - Colores proporcionales al estado de vehículos
      - Información al hacer clic en cada marcador
      - Filtros por región
```

---

### 3.5 SUPERADMIN (Super Administrador)

#### ¿Quién es?
El rol con mayor privilegio en el sistema. Gestiona usuarios, ve auditoría en tiempo real y tiene acceso completo a todas las funciones.

#### ¿Qué puede hacer?

| Acción | Descripción | Ruta |
|--------|-------------|------|
| **Iniciar sesión** | Ingresa con sus credenciales | `/portal` |
| **Ver dashboard** | Resumen total del sistema | `/` |
| **Gestión de usuarios** | Crear, editar, eliminar usuarios | `/control` |
| **Asignar roles** | Asignar cualquier rol a usuarios | `/control` |
| **Asignar regiones/delegaciones** | Asignar usuarios a regiones o delegaciones | `/control` |
| **Buscar usuarios** | Filtrar por nombre, email, rol | `/control` |
| **Ver auditoría en tiempo real** | Feed de todas las acciones del sistema | `/control/activity` |
| **Todas las funciones de Admin** | Acceso completo a registros y reportes | Múltiples rutas |

#### Flujo de Trabajo del SuperAdmin

```
1. INICIO DE SESIÓN
   │
   ▼
2. DASHBOARD - Resumen total
   │  - Todas las estadísticas del sistema
   │
   ▼
3. GESTIÓN DE USUARIOS (/control)
   │  - Crear nuevos usuarios con:
   │    • Nombre, apellido, grado, teléfono, email
   │    • Rol (capturist, regional_manager, admin, director)
   │    • Asignación a región y/o delegación
   │  - Editar usuarios existentes
   │  - Eliminar usuarios (soft delete)
   │  - Búsqueda de usuarios
   │  - NOTA: No puede editarse ni eliminarse a sí mismo
   │
   ▼
4. AUDITORÍA EN TIEMPO REAL (/control/activity)
      - Feed de todas las acciones del sistema:
        • Inicios de sesión
        • Creación/edición/eliminación de usuarios
        • Creación/edición/eliminación de registros
        • Transferencias de vehículos
        • Envío de reportes
      - Actualización en tiempo real vía WebSocket
      - Filtros por tipo de acción
```

---

## 4. Flujos Cruzados entre Roles

### 4.1 Flujo de Captura a Supervisión

```
CAPTURISTA                    REGIONAL MANAGER                ADMIN/DIRECTOR
    │                              │                              │
    ├── Crea registro ─────────────┤                              │
    │   (WebSocket)                ├── Recibe notificación        │
    │                              │   en tiempo real             │
    │                              │                              │
    ├── Envía reporte ────────────>┤                              │
    │   de delegación              │                              │
    │                              ├── Revisa reporte             │
    │                              │                              │
    │                              ├── Envía reporte ────────────>┤
    │                              │   regional                   │
    │                              │                              ├── Consulta overview
    │                              │                              │   y KPIs
```

### 4.2 Flujo de Transferencia de Vehículos

```
SOLICITANTE                     SISTEMA                       DESTINO
    │                              │                              │
    ├── Inicia transferencia ─────>┤                              │
    │   (origen → destino)         │                              │
    │   con motivo                 │                              │
    │                              ├── Crea registro              │
    │                              │   de transferencia           │
    │                              │                              │
    │                              ├── Actualiza delegación       │
    │                              │   del vehículo               │
    │                              │                              │
    │                              ├── Emite evento ─────────────>┤
    │                              │   WebSocket                  ├── Actualiza vista
    │                              │                              │   en tiempo real
    │                              │                              │
    │                              ├── Registra en auditoría      │
```

### 4.3 Flujo de Gestión de Usuarios

```
SUPERADMIN                      SISTEMA                       USUARIO CREADO
    │                              │                              │
    ├── Crea usuario con ─────────>┤                              │
    │   rol, región, delegación    │                              │
    │                              ├── Registra en BD             │
    │                              │   y auditoría                │
    │                              │                              │
    │                              ├── Usuario puede ────────────>┤
    │                              │   iniciar sesión             ├── Accede según su rol
    │                              │                              │
    ├── Puede editar ─────────────>┤                              │
    │   o eliminar usuario         │                              │
    │   (excepto superadmin)       │                              │
```

### 4.4 Flujo de Auditoría

```
CUALQUIER ROL                 SISTEMA                       SUPERADMIN
     │                              │                              │
     ├── Cualquier acción ─────────>┤                              │
     │   (login, CRUD, transfer)    │                              │
     │                              ├── Crea log de auditoría      │
     │                              │   con:                       │
     │                              │   - Acción                   │
     │                              │   - Entidad                  │
     │                              │   - ID                       │
     │                              │   - Metadata                 │
     │                              │   - Actor (quién)            │
     │                              │                              │
     │                              ├── Emite evento ─────────────>┤
     │                              │   "audit.created"            ├── Ve en tiempo real
     │                              │                              │   en /control/activity
```

---

## 5. Resumen de Permisos por Rol

| Acción | Capturist | RegionalMgr | Admin | Director | SuperAdmin |
|--------|:---------:|:-----------:|:-----:|:--------:|:----------:|
| Capturar vehículos | ✅ (su deleg.) | ❌ | ❌ | ❌ | ❌ |
| Editar registros | ✅ (su deleg.) | ❌ | ✅ | ❌ | ✅ |
| Eliminar registros | ❌ | ❌ | ✅ | ❌ | ✅ |
| Transferir vehículos | ✅ (su deleg.) | ✅ (su región) | ✅ | ❌ | ✅ |
| Ver registros propios | ✅ | ❌ | ✅ | ❌ | ✅ |
| Ver región en vivo | ❌ | ✅ | ❌ | ❌ | ✅ |
| Ver overview global | ❌ | ❌ | ✅ | ✅ | ✅ |
| Ver dashboard director | ❌ | ❌ | ✅ | ✅ | ✅ |
| Ver mapa | ❌ | ❌ | ✅ | ✅ | ✅ |
| Reporte delegación | ✅ | ❌ | ❌ | ❌ | ❌ |
| Reporte regional | ❌ | ✅ | ❌ | ❌ | ❌ |
| Crear usuarios | ❌ | ❌ | ❌ | ❌ | ✅ |
| Editar usuarios | ❌ | ❌ | ❌ | ❌ | ✅ |
| Eliminar usuarios | ❌ | ❌ | ❌ | ❌ | ✅ |
| Ver auditoría | ❌ | ❌ | ❌ | ❌ | ✅ |
