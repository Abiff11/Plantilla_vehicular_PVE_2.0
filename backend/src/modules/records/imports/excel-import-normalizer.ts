export type ExcelImportRecordValues = Record<string, string>;

export type NormalizedExcelImportRecord = {
  civ: string;
  previousPlates: string;
  plates2024: string;
  plates2025: string;
  plates2026: string;
  plates: string;
  brand: string;
  type: string;
  useType: string;
  vehicleClass: string;
  model: string;
  cylinders: string;
  fuelCapacityLiters: string;
  engineNumber: string;
  serialNumber: string;
  regionName: string;
  delegationName: string;
  adscription: string;
  custodian: string;
  patrolNumber: string;
  color: string;
  physicalStatus: string;
  status: string;
  rawCirculationStatus: string;
  assetClassification: string;
  observation: string;
  realLocation: string;
  sourceSection: string;
  sourceRowNumber: number;
};

const EMPTY_PLACEHOLDERS = new Set(['', '-', 'N/A', 'NA', 'NINGUNO', 'NINGUNA', 'S/D', 'SD']);
const NO_PLATE_PLACEHOLDERS = new Set([...EMPTY_PLACEHOLDERS, 'S/P', 'SP', 'SIN PLACA', 'SIN PLACAS']);
const NO_ENGINE_PLACEHOLDERS = new Set([...EMPTY_PLACEHOLDERS, 'S/M', 'SM', 'S/N', 'SN', 'SIN MOTOR', 'SIN NUMERO', 'HECHO EN MEXICO', 'HECHO EN USA', 'IMPORTADO']);
const NO_SERIAL_PLACEHOLDERS = new Set([...EMPTY_PLACEHOLDERS, 'S/N', 'SN', 'SIN SERIE', 'SIN NUMERO']);

export function normalizeExcelImportRecord(values: ExcelImportRecordValues, sourceSection: string, sourceRowNumber: number): NormalizedExcelImportRecord {
  const rawPhysicalStatus = normalizeCatalogText(values['ESTADO FISICO']);
  const physicalStatus = normalizePhysicalStatus(rawPhysicalStatus);
  const rawAssetClassification = normalizeCatalogText(values['ANOTACION GENERAL']);
  const assetClassification = normalizeAssetClassification(rawAssetClassification);
  const rawCirculationStatus = normalizeCirculationStatus(values.ESTATUS);
  const baseObservation = normalizeText(values.OBSERVACION);
  const regionName = normalizeCatalogText(values.REGION);
  const delegationName = normalizeCatalogText(values.DELEGACION);

  return {
    civ: normalizeCode(values.CIV),
    previousPlates: normalizeExcelSourceText(values['PLACAS ANTERIORES']),
    plates2024: normalizeExcelSourceText(values['PLACAS 2024']),
    plates2025: normalizeExcelSourceText(values['PLACAS 2025']),
    plates2026: normalizeExcelSourceText(values['PLACAS 2026']),
    plates: resolveMainPlates(values),
    brand: normalizeCatalogText(values.MARCA),
    type: normalizeCatalogText(values.TIPO),
    useType: normalizeCatalogText(values.USO),
    vehicleClass: normalizeVehicleClass(values['TIPO DE VEHICULO']),
    model: normalizeModel(values['MOD.']),
    cylinders: normalizeNumericText(values['CIL.']),
    fuelCapacityLiters: normalizeNumericText(values['CAP.LTS']),
    engineNumber: normalizeEngineNumber(values['NO. DE MOTOR']),
    serialNumber: normalizeSerialNumber(values['NO. DE SERIE']),
    regionName,
    delegationName,
    adscription: delegationName || normalizeCatalogText(values.ADSCRIPCION),
    custodian: normalizeCustodianName(values.RESGUARDANTE),
    patrolNumber: normalizeCode(values['NO. PATRULLA']),
    color: normalizeCatalogText(values['COLOR DE LA UNIDAD']),
    physicalStatus,
    status: deriveSystemStatus(rawCirculationStatus),
    rawCirculationStatus,
    assetClassification,
    observation: buildObservation(baseObservation, [rawPhysicalStatus && rawPhysicalStatus !== physicalStatus ? `Estado fisico Excel: ${rawPhysicalStatus}` : '', rawAssetClassification && rawAssetClassification !== assetClassification ? `Anotacion general Excel: ${rawAssetClassification}` : '']),
    realLocation: normalizeCatalogText(values['UBICACION REAL']),
    sourceSection: normalizeCatalogText(sourceSection),
    sourceRowNumber,
  };
}

function resolveMainPlates(values: ExcelImportRecordValues) {
  for (const candidate of [values['PLACAS 2026'], values['PLACAS 2025'], values['PLACAS 2024'], values['PLACAS ANTERIORES']]) {
    const normalized = normalizePlateForCurrentValue(candidate);
    if (normalized) return normalized;
  }
  return '';
}

function normalizePlateForCurrentValue(value: string) {
  const normalized = stripDiacritics(normalizeUpper(value));
  if (NO_PLATE_PLACEHOLDERS.has(normalized)) return '';
  const compacted = normalized.replace(/[\s-]+/gu, '');
  if (!compacted || /^\d+$/u.test(compacted) || !/[A-Z]/u.test(compacted) || compacted.length < 5) return '';
  return compacted;
}

function normalizeEngineNumber(value: string) {
  const normalized = normalizeUpper(value);
  return NO_ENGINE_PLACEHOLDERS.has(stripDiacritics(normalized)) ? 'SIN NUMERO' : normalized;
}

function normalizeSerialNumber(value: string) {
  const normalized = normalizeUpper(value);
  return NO_SERIAL_PLACEHOLDERS.has(stripDiacritics(normalized)) ? 'SIN NUMERO' : normalizeCode(normalized);
}

function normalizeVehicleClass(value: string) {
  const normalized = normalizeCatalogText(value);
  return stripDiacritics(normalized) === 'GRUA' ? 'GRUA' : stripDiacritics(normalized);
}

function normalizePhysicalStatus(value: string) {
  const normalized = stripDiacritics(value);
  if (normalized.startsWith('SINIESTRAD')) return 'MALO';
  if (normalized.startsWith('BUEN')) return 'BUENO';
  if (normalized.startsWith('REGULAR')) return 'REGULAR';
  if (normalized.startsWith('MAL')) return 'MALO';
  return normalized || 'MALO';
}

function normalizeAssetClassification(value: string) {
  const normalized = stripDiacritics(value);
  if (!normalized) return 'OTRO';
  if (normalized.includes('ARREND')) return 'ARRENDAMIENTO';
  if (normalized.includes('PATRIMONIAL')) return 'PATRIMONIAL';
  return 'OTRO';
}

function normalizeCirculationStatus(value: string) {
  const normalized = stripDiacritics(normalizeUpper(value));
  return !normalized || EMPTY_PLACEHOLDERS.has(normalized) ? 'SIN ESTATUS' : normalized;
}

function deriveSystemStatus(rawCirculationStatus: string) {
  switch (stripDiacritics(rawCirculationStatus)) {
    case 'CIRCULANDO':
    case 'NUEVA':
    case 'REPOSICION':
      return 'ACTIVO';
    case 'NO CIRCULANDO':
      return 'INCATIVO';
    case 'BAJA':
      return 'PARA BAJA';
    default:
      return 'OTRO';
  }
}

function buildObservation(baseObservation: string, notes: string[]) {
  const suffix = notes.filter(Boolean).map((note) => `[${note}]`).join(' ');
  return [baseObservation, suffix].filter(Boolean).join(' ');
}

function normalizeModel(value: string) { return normalizeUpper(value).replace(/\.0$/u, ''); }
function normalizeNumericText(value: string) { return normalizeUpper(value).replace(/,/gu, '.').replace(/\.0+$/u, ''); }
function normalizeCode(value: string) { return normalizeUpper(value).replace(/\s+/gu, ''); }
function normalizeCatalogText(value: string) { return stripDiacritics(normalizeUpper(value)).replace(/\s+/gu, ' '); }
function normalizeExcelSourceText(value: string) { return normalizeUpper(value).replace(/\s+/gu, ' '); }
function normalizeCustodianName(value: string) { return normalizeUpper(value).replace(/\s+/gu, ' ') || 'SIN RESGUARDANTE'; }
function normalizeText(value: string) { return String(value ?? '').trim().replace(/\s+/gu, ' '); }
function normalizeUpper(value: string) { return normalizeText(value).toUpperCase(); }
function stripDiacritics(value: string) { return value.normalize('NFD').replace(/[\u0300-\u036f]/gu, '').trim(); }
