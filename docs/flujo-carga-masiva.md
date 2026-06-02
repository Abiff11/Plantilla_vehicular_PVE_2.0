# Flujo de carga masiva desde Excel

## Objetivo

Documentar el procedimiento operativo para importar la plantilla vehicular institucional desde archivo Excel.

## Ruta del sistema

```txt
Administracion -> Importar Excel
Ruta: /imports/vehicles
```

## Roles permitidos

```txt
plantilla_vehicular
superadmin
coordinacion
```

## Archivo esperado

```txt
Formato: .xlsx
Hoja esperada: PLANTILLA GENERAL 2025 (IMPRIM)
Columnas esperadas: 24
```

El archivo debe subirse tal como lo entrega el area operativa.

No es necesario:

```txt
Renombrar columnas
Reordenar columnas
Eliminar secciones
Convertir a CSV
Limpiar acentos
```

## Flujo general

```txt
1. Subir Excel
2. Generar preview
3. Revisar resumen
4. Revisar errores
5. Resolver valores pendientes en Catalogos
6. Generar preview nuevamente
7. Confirmar importacion
8. Revisar historial
```

## Preview

El preview no guarda vehiculos.

El preview si guarda un lote con estatus:

```txt
PREVIEWED
```

El preview valida:

```txt
Archivo .xlsx
Columnas obligatorias
Filas de vehiculos
Filas de seccion
Catalogos requeridos
Duplicados dentro del Excel
Duplicados contra registros existentes
Normalizacion de placas
Normalizacion de estatus
Normalizacion de estado fisico
```

## Resultado del preview

La pantalla muestra:

```txt
Archivo
Hoja
Total de filas utiles
Filas validas
Filas con error
Valores pendientes de catalogo
Errores por fila
Muestra de filas normalizadas
```

## Valores pendientes de catalogo

Si el preview detecta valores no reconocidos, no se debe confirmar importacion.

Ejemplo:

```txt
Catalogo: vehicle_use
Valor detectado: CAMIONETA
```

Acciones posibles:

```txt
Crear valor nuevo
Crear alias hacia valor existente
Corregir catalogo
Volver a generar preview
```

## Confirmar importacion

La confirmacion solo debe ejecutarse cuando:

```txt
invalidRows = 0
pendingCatalogValues = []
```

Al confirmar:

```txt
1. El backend vuelve a leer el Excel.
2. Vuelve a validar reglas.
3. Si hay errores, rechaza y guarda lote FAILED.
4. Si todo es valido, guarda registros.
5. Genera importBatchId.
6. Guarda lote IMPORTED.
7. Registra auditoria VEHICLE_IMPORT_COMMITTED.
```

## Estados de lote

```txt
PREVIEWED
IMPORTED
FAILED
CANCELLED
```

### PREVIEWED

Se genero preview.

Puede tener errores o valores pendientes.

### IMPORTED

La importacion fue confirmada y los registros se guardaron.

### FAILED

El commit fue intentado, pero habia errores bloqueantes.

### CANCELLED

Reservado para cancelaciones futuras.

## Errores persistidos

Los errores se guardan en:

```txt
vehicle_import_errors
```

Cada error conserva:

```txt
Lote
Fila
Seccion
Columna
Valor
Tipo de error
Mensaje
```

Tipos de error esperados:

```txt
VALIDATION
CATALOG
DUPLICATE
```

## Campos importados visibles

Despues de importar, los registros muestran:

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

## Reglas de normalizacion principales

### Placas

Prioridad:

```txt
PLACAS 2026
PLACAS 2025
PLACAS 2024
PLACAS ANTERIORES
```

Valores tratados como vacio:

```txt
S/P
SP
SIN PLACA
SIN PLACAS
SIN PLACA(S)
N/A
-
```

### Estado fisico

```txt
SINIESTRADA -> MALO
SINIESTRADO 08/10/2025 -> MALO
BUEN* -> BUENO
REGULAR -> REGULAR
MAL* -> MALO
```

### Estatus

```txt
CIRCULANDO -> ACTIVO
NUEVA -> ACTIVO
REPOSICION -> ACTIVO
NO CIRCULANDO -> INCATIVO
BAJA -> PARA BAJA
vacio -> OTRO / SIN ESTATUS
```

### Clasificacion del bien

```txt
Contiene ARREND -> ARRENDAMIENTO
Contiene PATRIMONIAL -> PATRIMONIAL
Otro o vacio -> OTRO
```

## Validacion tecnica local

Antes de probar importacion real, ejecutar:

```bash
cd backend
npm run lint
npm run validate:imports
npm run migration:show
```

Resultado esperado:

```txt
tsc --noEmit OK
Excel import normalization validation passed.
Migraciones pendientes visibles o aplicadas segun base local
```

## Prueba controlada recomendada

Usar una base local o de staging con respaldo.

Orden recomendado:

```bash
cd backend
npm run migration:show
npm run migration:run
npm run validate:imports
npm run start:dev
```

Despues:

```txt
1. Iniciar sesion con rol permitido.
2. Entrar a Catalogos.
3. Verificar que existan catalogos base.
4. Entrar a Importar Excel.
5. Subir archivo .xlsx.
6. Generar preview.
7. Resolver pendientes.
8. Confirmar importacion.
9. Revisar Vista general vehicular.
10. Abrir detalle de una unidad importada.
```

## Criterios de aceptacion

La carga masiva se considera correcta si:

```txt
El preview detecta filas utiles.
El preview detecta secciones.
Los valores pendientes se muestran por catalogo.
Los errores indican fila y mensaje.
El commit no permite guardar con errores.
El commit guarda registros cuando no hay errores.
El lote queda en historial.
Los registros muestran campos importados.
La bitacora registra preview, commit o fail.
```

## Restricciones actuales

- La importacion no actualiza registros existentes.
- La importacion rechaza duplicados.
- La importacion no elimina registros.
- La importacion no modifica catalogos automaticamente.
- La delegacion asociada al commit se resuelve por usuario o primera delegacion disponible.

## Mejora futura recomendada

Agregar seleccion explicita de delegacion o mapeo por:

```txt
ADSCRIPCION
UBICACION REAL
sourceSection
```
