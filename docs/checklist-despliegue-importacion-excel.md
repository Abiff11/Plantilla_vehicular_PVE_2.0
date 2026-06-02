# Checklist de despliegue - Importacion Excel

## Objetivo

Checklist para desplegar de forma segura la funcionalidad de catalogos dinamicos e importacion masiva desde Excel.

## Alcance

Incluye cambios en:

```txt
Backend
Frontend
Base de datos
Catalogos
Auditoria
Documentacion
```

## Migraciones involucradas

```txt
UserSessionVersion1763760000000
AddExcelImportFieldsToRecords1780420000000
CreateDynamicCatalogs1780421000000
CreateVehicleImportBatches1780422000000
```

Antes de produccion, confirmar si `UserSessionVersion1763760000000` ya estaba pendiente por otro bloque y si debe aplicarse junto con estas migraciones.

## Validacion antes de migrar

Ejecutar en local o staging:

```bash
cd backend
npm run lint
npm run validate:imports
npm run migration:show
```

Ejecutar en frontend:

```bash
cd frontend
npm run build
```

## Respaldo obligatorio

Antes de aplicar migraciones en produccion:

```bash
pg_dumpall -U <usuario> | gzip > backup_pre_importacion_excel_$(date +%Y%m%d_%H%M%S).sql.gz
```

Tambien respaldar variables y compose/productivo si aplica:

```txt
.env
compose.yml / docker-compose.yml
nginx config
scripts de deploy
```

## Aplicacion de migraciones

En ambiente controlado:

```bash
cd backend
npm run migration:show
npm run migration:run
npm run migration:show
```

Resultado esperado despues de aplicar:

```txt
[X] AddExcelImportFieldsToRecords1780420000000
[X] CreateDynamicCatalogs1780421000000
[X] CreateVehicleImportBatches1780422000000
```

## Validacion de arranque backend

Despues de migrar:

```bash
npm run start:dev
```

O en Docker:

```bash
docker compose logs -f <backend-service>
```

Verificar que no existan errores relacionados con:

```txt
catalog_groups
catalog_items
catalog_aliases
vehicle_import_batches
vehicle_import_errors
records.importBatchId
records.civ
uuid_generate_v4
```

## Validacion de catalogos

Entrar con usuario autorizado.

Ruta:

```txt
/catalogs
```

Verificar:

```txt
Aparecen grupos de catalogo.
Aparecen valores iniciales.
Se puede crear un valor de prueba.
Se puede desactivar el valor de prueba.
Se puede crear alias.
La bitacora registra cambios.
```

## Validacion de importacion

Ruta:

```txt
/imports/vehicles
```

Validar:

```txt
Se puede seleccionar archivo .xlsx.
Preview responde.
Se muestra total de filas.
Se muestran errores si existen.
Se muestran valores pendientes si existen.
No se permite confirmar con errores.
Se permite confirmar solo con preview limpio.
El historial muestra el lote.
Los errores del lote pueden consultarse.
```

## Validacion de registros importados

Despues de confirmar una importacion:

```txt
Entrar a Vista general vehicular.
Buscar por CIV.
Buscar por placas 2026.
Buscar por color.
Buscar por adscripcion.
Abrir detalle de unidad.
Verificar campos importados.
```

Campos a revisar:

```txt
CIV
Placas anteriores
Placas 2024
Placas 2025
Placas 2026
Cilindros
Capacidad litros
Adscripcion
Color
Estatus Excel
Ubicacion real
Seccion Excel
Fila Excel
Lote de importacion
```

## Validacion de auditoria

Verificar eventos:

```txt
CATALOG_GROUP_CREATED
CATALOG_ITEM_CREATED
CATALOG_ITEM_UPDATED
CATALOG_ITEM_DELETED
CATALOG_ALIAS_CREATED
VEHICLE_IMPORT_PREVIEWED
VEHICLE_IMPORT_COMMITTED
VEHICLE_IMPORT_FAILED
```

## Riesgos conocidos

### Migraciones pendientes previas

Si existe una migracion pendiente anterior, no aplicar en produccion sin revisar su contenido.

Actualmente puede aparecer:

```txt
UserSessionVersion1763760000000
```

### Importacion duplicada

El sistema rechaza duplicados por:

```txt
plates
serialNumber
engineNumber no generico
civ
```

No ejecutar dos veces el mismo archivo sin revisar historial.

### Delegacion por defecto

Actualmente el commit asocia registros a:

```txt
Delegacion del usuario si existe
Primera delegacion disponible si el usuario no tiene delegacion
```

Esto debe revisarse antes de una importacion oficial si se requiere segmentar por delegacion real.

## Rollback

Si falla antes de confirmar importacion:

```txt
No hay registros vehiculares nuevos.
Solo quedan lotes PREVIEWED o FAILED.
```

Si falla despues de importar:

```txt
Identificar importBatchId.
Respaldar base.
Revisar registros con records.importBatchId.
Preparar script manual de reversa si Direccion autoriza.
```

No borrar registros importados sin autorizacion operativa.

## Cierre de despliegue

El despliegue se considera aceptado si:

```txt
Backend compila.
Frontend compila.
Migraciones aplican sin error.
Catalogos base se siembran.
Preview funciona.
Commit funciona con archivo limpio.
Errores se persisten.
Bitacora registra eventos.
Registros importados se ven en tablas y detalle.
```
