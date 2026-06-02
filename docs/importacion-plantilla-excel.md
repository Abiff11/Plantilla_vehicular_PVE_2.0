# Importacion de plantilla vehicular desde Excel

## Objetivo

Definir el contrato tecnico y operativo para importar la base historica de vehiculos desde el archivo Excel institucional sin modificar el archivo original y sin perder columnas relevantes.

Este documento corresponde al Bloque 0 de implementacion: contrato del Excel.

## Archivo base

```txt
Nombre: PLANTILLA ( COMPLETA) 2025.xlsx
Hoja: PLANTILLA GENERAL 2025 (IMPRIM)
Rango detectado: A1:X308
Columnas detectadas: 24
Registros utiles aproximados: 294
```

## Regla principal

La importacion debe tomar el archivo tal cual viene del area operativa.

No se debe exigir al usuario que renombre columnas, reordene columnas o limpie manualmente el Excel antes de subirlo.

El sistema debe:

1. Leer el archivo original.
2. Detectar encabezados y secciones.
3. Validar columnas esperadas.
4. Validar valores contra catalogos administrables.
5. Mostrar vista previa.
6. Guardar registros solo cuando el usuario confirme la importacion.

## Columnas esperadas

| Orden | Columna Excel | Campo sistema | Accion |
|---:|---|---|---|
| 1 | N° | sourceRowNumber / sourceNumber | Crear campo de origen |
| 2 | CIV | civ | Crear campo |
| 3 | PLACAS ANTERIORES | previousPlates | Crear campo |
| 4 | PLACAS 2024 | plates2024 | Crear campo |
| 5 | PLACAS 2025 | plates2025 | Crear campo |
| 6 | PLACAS 2026 | plates2026 | Crear campo |
| 7 | MARCA | brand | Reutilizar campo actual |
| 8 | TIPO | type | Reutilizar campo actual |
| 9 | USO | useType | Reutilizar campo actual y validar con catalogo |
| 10 | TIPO DE VEHICULO | vehicleClass | Reutilizar campo actual y validar con catalogo |
| 11 | MOD. | model | Reutilizar campo actual |
| 12 | CIL. | cylinders | Crear campo |
| 13 | CAP.LTS | fuelCapacityLiters | Crear campo |
| 14 | No. DE MOTOR | engineNumber | Reutilizar campo actual |
| 15 | No. DE SERIE | serialNumber | Reutilizar campo actual |
| 16 | ADSCRIPCION | adscription | Crear campo / catalogo |
| 17 | RESGUARDANTE | custodian | Reutilizar campo actual |
| 18 | No. PATRULLA | patrolNumber | Reutilizar campo actual |
| 19 | COLOR DE LA UNIDAD | color | Crear campo / catalogo |
| 20 | ESTADO FISICO | physicalStatus | Reutilizar campo actual y validar con catalogo |
| 21 | ESTATUS | rawCirculationStatus / status | Crear campo raw y derivar estatus interno |
| 22 | ANOTACION GENERAL | assetClassification | Reutilizar campo actual y validar con catalogo |
| 23 | OBSERVACION | observation | Reutilizar campo actual |
| 24 | UBICACION REAL | realLocation | Crear campo / catalogo |

## Campos nuevos requeridos en records

```txt
civ
previousPlates
plates2024
plates2025
plates2026
cylinders
fuelCapacityLiters
adscription
color
rawCirculationStatus
realLocation
sourceSection
sourceRowNumber
importBatchId
```

## Campos actuales reutilizados

```txt
plates
brand
type
useType
vehicleClass
model
engineNumber
serialNumber
custodian
patrolNumber
physicalStatus
status
assetClassification
observation
delegation
createdBy
```

## Secciones detectadas en el Excel

Las filas que funcionan como agrupadores no deben importarse como vehiculos. Deben conservarse como `sourceSection` para cada registro posterior.

Secciones detectadas:

```txt
DELEGACION REGIONAL PLAZA
SUSTANTIVAS
COMISIONADAS
AGRUPAMIENTO CICLISTA
VALLES CENTRALES REGION ZONA NORTE
VALLES CENTRALES REGION ZONA SUR
DELEGACION REGIONAL DE LA CANADA
VALLES CENTRALES REGION MIXTECA
DELEGACION REGIONAL CUENCA
DELEGACION REGIONAL COSTA
DELEGACION REGIONAL ISTMO ZONA NORTE
DELEGACION REGIONAL ISTMO ZONA SUR
BAJAS TERCER BLOQUE
```

## Regla para placas principales

El campo interno `plates` debe derivarse en este orden:

```txt
1. PLACAS 2026
2. Si esta vacio, usar PLACAS 2025
3. Si esta vacio, usar PLACAS 2024
4. Si esta vacio, usar PLACAS ANTERIORES
5. Si esta vacio o solo contiene S/P, registrar sin placas y validar por CIV o numero de serie
```

Los campos originales de placas por anio deben conservarse en columnas separadas.

## Regla de estatus

La columna `ESTATUS` del Excel no debe reemplazar directamente al campo interno `status`.

Se debe guardar el valor original en:

```txt
rawCirculationStatus
```

Y derivar el campo interno:

| Valor Excel | status interno |
|---|---|
| CIRCULANDO | ACTIVO |
| NUEVA | ACTIVO |
| REPOSICION | ACTIVO |
| NO CIRCULANDO | INCATIVO |
| BAJA | PARA BAJA |
| ROJO | OTRO |
| Vacio | OTRO |

## Catalogos requeridos

La importacion debe validar o proponer valores contra catalogos administrables.

Catalogos base:

```txt
vehicle_brand
vehicle_type
vehicle_use
vehicle_class
vehicle_color
physical_status
circulation_status
system_status
asset_classification
adscription
real_location
excel_section
```

## Valores iniciales detectados

### vehicle_use

```txt
OPERATIVO
SUSTANTIVO
ADMINISTRATIVO
CAMIONETA
```

Nota: `CAMIONETA` en la columna USO parece un posible error de captura. Debe mostrarse como pendiente de validacion o mapeo.

### vehicle_class

```txt
AUTOMOVIL
CAMIONETA
MOTOCICLETA
BICICLETA
GRUA
GRUA / GRÚA
MINIBUS CARROCERIA ALUVAN
CAMIONES (CAMIONETA)
```

### physical_status

```txt
BUENO
REGULAR
MALO
SINIESTRADA
SINIESTRADO 08/10/2025
```

Valores como `SINIESTRADA` o `SINIESTRADO 08/10/2025` deben conservarse como valor original y mapearse a un estado fisico normalizado.

### circulation_status

```txt
CIRCULANDO
NO CIRCULANDO
BAJA
NUEVA
REPOSICION
ROJO
SIN ESTATUS
```

## Reglas de duplicados

La importacion debe validar duplicados contra registros activos.

Campos candidatos:

```txt
plates
serialNumber
engineNumber
civ
```

El campo `engineNumber` no debe usarse como llave de duplicado cuando tenga valores genericos.

Valores genericos a ignorar como llave unica:

```txt
SIN NUMERO
SIN NÚMERO
N/A
NA
HECHO EN MEXICO
SIN MOTOR
S/M
```

## Flujo obligatorio de importacion

```txt
1. Subir Excel
2. Leer archivo en memoria
3. Validar columnas
4. Separar encabezados, secciones y filas vehiculares
5. Normalizar valores
6. Comparar contra catalogos
7. Mostrar preview
8. Mostrar errores y pendientes
9. Confirmar importacion
10. Crear lote de importacion
11. Insertar o rechazar filas segun validacion
12. Registrar bitacora
```

## Reglas de seguridad operativa

- No guardar registros durante el preview.
- No modificar catalogos automaticamente sin accion del usuario.
- No eliminar registros existentes durante importacion.
- No sobrescribir registros existentes sin una regla explicita posterior.
- Registrar usuario, fecha, archivo, hoja y resultado de cada importacion.
- Mantener trazabilidad por fila original del Excel.

## Resultado esperado del Bloque 0

Con este contrato, los siguientes bloques pueden implementarse sin ambiguedad:

```txt
Bloque 1: ampliar RecordEntity y crear migracion.
Bloque 2: crear catalogos administrables.
Bloque 3: sembrar catalogos iniciales desde el Excel.
Bloque 7: crear preview y commit de importacion.
```
