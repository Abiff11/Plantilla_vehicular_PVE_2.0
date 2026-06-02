# Catalogos vehiculares

## Objetivo

Documentar el uso operativo del modulo de Catalogos para administrar valores usados por la plantilla vehicular y por la importacion de Excel.

## Ruta del sistema

```txt
Administracion -> Catalogos
Ruta: /catalogs
```

## Roles con acceso

Pueden administrar catalogos:

```txt
plantilla_vehicular
superadmin
coordinacion
```

## Que problema resuelve

El Excel institucional puede traer valores nuevos, variantes con acentos, abreviaturas o errores de captura.

Ejemplos:

```txt
GRUA / GRÚA
SINIESTRADA / SINIESTRADO 08/10/2025
CIRCULANDO / NO CIRCULANDO / BAJA
CAMIONETA en columna USO
```

El modulo de Catalogos permite resolver estos casos sin modificar codigo.

## Estructura tecnica

El modulo usa tres tablas dinamicas:

```txt
catalog_groups
catalog_items
catalog_aliases
```

### catalog_groups

Agrupa tipos de catalogo.

Ejemplos:

```txt
vehicle_use
vehicle_class
physical_status
circulation_status
system_status
asset_classification
adscription
real_location
excel_section
```

### catalog_items

Contiene los valores validos dentro de cada catalogo.

Ejemplo para `vehicle_use`:

```txt
OPERATIVO
SUSTANTIVO
ADMINISTRATIVO
```

### catalog_aliases

Relaciona valores del Excel con valores normalizados.

Ejemplos:

```txt
GRÚA -> GRUA
SINIESTRADA -> MALO
SINIESTRADO 08/10/2025 -> MALO
```

## Catalogos base

### vehicle_use

Uso administrativo u operativo de la unidad.

Valores iniciales:

```txt
OPERATIVO
SUSTANTIVO
ADMINISTRATIVO
CAMIONETA
```

Nota: `CAMIONETA` aparece en el Excel dentro de `USO`, pero debe revisarse porque posiblemente corresponde a `TIPO DE VEHICULO`.

### vehicle_class

Clase de unidad.

Valores iniciales:

```txt
AUTOMOVIL
CAMIONETA
MOTOCICLETA
BICICLETA
GRUA
MINIBUS CARROCERIA ALUVAN
CAMIONES (CAMIONETA)
```

### physical_status

Estado fisico normalizado.

Valores iniciales:

```txt
BUENO
REGULAR
MALO
```

Alias iniciales:

```txt
SINIESTRADA -> MALO
SINIESTRADO 08/10/2025 -> MALO
```

### circulation_status

Valor original de la columna `ESTATUS` del Excel.

Valores iniciales:

```txt
CIRCULANDO
NUEVA
REPOSICION
NO CIRCULANDO
BAJA
ROJO
SIN ESTATUS
```

### system_status

Estatus interno usado por dashboard y reportes.

Valores iniciales:

```txt
ACTIVO
INCATIVO
SINIESTRADO
PARA BAJA
OTRO
```

### asset_classification

Clasificacion administrativa o patrimonial.

Valores iniciales:

```txt
PATRIMONIAL
ARRENDAMIENTO
OTRO
```

## Como crear un nuevo valor

1. Entrar a `Administracion -> Catalogos`.
2. Seleccionar el grupo correspondiente.
3. Capturar:

```txt
Codigo
Etiqueta
Valor normalizado
```

4. Guardar.
5. Verificar que aparezca como activo.

## Como crear un alias

1. Seleccionar el catalogo.
2. Elegir el valor destino.
3. Capturar el valor exacto que viene en el Excel.
4. Capturar origen:

```txt
excel
manual
correccion
```

5. Guardar alias.

Ejemplo:

```txt
Valor destino: GRUA
Valor del Excel: GRÚA
Origen: excel
```

## Reglas de administracion

- No borrar valores historicos si ya fueron usados por importaciones.
- Preferir desactivar en lugar de eliminar si hay duda.
- Crear alias cuando el valor del Excel sea equivalente a un valor existente.
- Crear item nuevo solo cuando el valor represente una categoria real nueva.
- Revisar valores sospechosos antes de normalizarlos.

## Auditoria

Cada accion administrativa queda registrada:

```txt
CATALOG_GROUP_CREATED
CATALOG_ITEM_CREATED
CATALOG_ITEM_UPDATED
CATALOG_ITEM_DELETED
CATALOG_ALIAS_CREATED
```

La bitacora conserva:

```txt
Usuario
Fecha
Catalogo
Valor modificado
Antes / despues
Alias creado
```

## Relacion con importacion Excel

La importacion valida valores contra catalogos antes de guardar registros.

Si hay valores pendientes, el sistema debe mostrar:

```txt
Catalogo afectado
Valor detectado
Fila del Excel
Mensaje de error
```

El usuario debe resolverlo en Catalogos y volver a generar preview.

## Buenas practicas

Antes de confirmar una importacion:

```txt
1. Revisar valores pendientes.
2. Crear alias para equivalencias obvias.
3. Crear valores nuevos solo si son categorias reales.
4. Volver a generar preview.
5. Confirmar importacion solo con cero errores bloqueantes.
```
