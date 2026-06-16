# Estructura real de PLANTILLA ( COMPLETA) 2025.xlsx

## Hoja detectada

```txt
PLANTILLA GENERAL 2025 (IMPRIM)
```

## Rango y volumen

```txt
Rango: A1:Y308
Columnas: 25
Filas vehiculares detectadas: 295
Filas agrupadoras detectadas: 12
```

## Columnas obligatorias aceptadas por el sistema

| Orden | Columna Excel | Campo sistema |
|---:|---|---|
| 1 | N° | sourceRowNumber |
| 2 | CIV | civ |
| 3 | PLACAS ANTERIORES | previousPlates |
| 4 | PLACAS 2024 | plates2024 |
| 5 | PLACAS 2025 | plates2025 |
| 6 | PLACAS 2026 | plates2026 |
| 7 | MARCA | brand |
| 8 | TIPO | type |
| 9 | USO | useType |
| 10 | TIPO DE VEHICULO | vehicleClass |
| 11 | MOD. | model |
| 12 | CIL. | cylinders |
| 13 | CAP.LTS | fuelCapacityLiters |
| 14 | No. DE MOTOR | engineNumber |
| 15 | No. DE SERIE | serialNumber |
| 16 | REGION | regionName |
| 17 | DELEGACION | delegationName / adscription |
| 18 | RESGUARDANTE | custodian |
| 19 | No. PATRULLA | patrolNumber |
| 20 | COLOR DE LA UNIDAD | color |
| 21 | ESTADO FISICO | physicalStatus |
| 22 | ESTATUS | rawCirculationStatus / status |
| 23 | ANOTACION GENERAL | assetClassification |
| 24 | OBSERVACIÓN | observation |
| 25 | UBICACIÓN REAL | realLocation |

## Regla aplicada

El sistema ya no espera la columna `ADSCRIPCION`. El Excel real separa esa informacion en `REGION` y `DELEGACION`.

Para compatibilidad interna:

```txt
adscription = delegationName
```

## Secciones detectadas

```txt
DELEGACIÓN REGIONAL PLAZA
SUSTANTIVAS DIRECCIÓN GENERAL
COMISIONADAS PROXIMIDAD SOCIAL
AGRUPAMIENTO CICLISTA GRUPO BICI-POLICIAS
VALLES CENTRALES REGION ZONA NORTE OPERATIVO PLAZA
VALLES CENTRALES REGION ZONA SUR
DELEGACION REGIONAL DE LA CAÑADA
VALLES CENTRALES REGION MIXTECA
DELEGACIÓN REGIONAL CUENCA
DELEGACIÓN REGIONAL COSTA
DELEGACIÓN REGIONAL ISTMO ZONA NORTE
DELEGACIÓN REGIONAL ISTMO ZONA SUR
```

## Cambios técnicos asociados

- `RecordEntity` guarda `regionName` y `delegationName`.
- El normalizador conserva `REGION`, `DELEGACION` y usa `DELEGACION` como `adscription`.
- El servicio de importación valida 25 columnas reales.
- Se agregó migración para crear las columnas nuevas en `records`.
