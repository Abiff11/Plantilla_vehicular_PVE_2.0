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

const EMPTY_PLACEHOLDERS = new Set([
  '',
  '-',
  '—',
  'N/A',
  'NA',
  'NINGUNO',
  'NINGUNA',
  'S/D',
  'SD',
]);

const NO_PLATE_PLACEHOLDERS = new Set([
  ...EMPTY_PLACEHOLDERS,
  'S/P',
  'SP',
  'SIN PLACA',
  'SIN PLACAS',
  'SIN PLACA(S)',
]);

const NO_ENGINE_PLACEHOLDERS = new Set([
  ...EMPTY_PLACEHOLDERS,
  'S/M',
  'SM',
  'SIN MOTOR',
  'SIN NUMERO',
  'SIN NÚMERO',
  'HECHO EN MEXICO',
  'HECHO EN MÉXICO',
]);

export function normalizeExcelImportRecord(
  values: ExcelImportRecordValues,
  sourceSection: string,
  sourceRowNumber: number,
): NormalizedExcelImportRecord {
  const rawPhysicalStatus = normalizeCatalogText(values['ESTADO FISICO']);
  const physicalStatus = normalizePhysicalStatus(rawPhysicalStatus);
  const rawAssetClassification = normalizeCatalogText(values['ANOTACION GENERAL']);
  const assetClassification = normalizeAssetClassification(rawAssetClassification);
  const rawCirculationStatus = normalizeCirculationStatus(values.ESTATUS);
  const baseObservation = normalizeText(values.OBSERVACION);

  return {
    civ: normalizeCode(values.CIV),
    previousPlates: normalizePlateValue(values['PLACAS ANTERIORES'], false),
    plates2024: normalizePlateValue(values['PLACAS 2024'], false),
    plates2025: normalizePlateValue(values['PLACAS 2025'], false),
    plates2026: normalizePlateValue(values['PLACAS 2026'], false),
    plates: resolveMainPlates(values),
    brand: normalizeCatalogText(values.MARCA),
    type: normalizeCatalogText(values.TIPO),
    useType: normalizeCatalogText(values.USO),
    vehicleClass: normalizeVehicleClass(values['TIPO DE VEHICULO']),
    model: normalizeModel(values['MOD.']),
    cylinders: normalizeNumericText(values['CIL.']),
    fuelCapacityLiters: normalizeNumericText(values['CAP.LTS']),
    engineNumber: normalizeEngineNumber(values['NO. DE MOTOR']),
    serialNumber: normalizeCode(values['NO. DE SERIE']),
    adscription: normalizeCatalogText(values.ADSCRIPCION),
    custodian: normalizePersonName(values.RESGUARDANTE),
    patrolNumber: normalizeCode(values['NO. PATRULLA']),
    color: normalizeCatalogText(values['COLOR DE LA UNIDAD']),
    physicalStatus,
    status: deriveSystemStatus(rawCirculationStatus),
    rawCirculationStatus,
    assetClassification,
    observation: buildObservation(baseObservation, [
      rawPhysicalStatus && rawPhysicalStatus !== physicalStatus
        ? `Estado fisico Excel: ${rawPhysicalStatus}`
        : '',
      rawAssetClassification && rawAssetClassification !== assetClassification
        ? `Anotacion general Excel: ${rawAssetClassification}`
        : '',
    ]),
    realLocation: normalizeCatalogText(values['UBICACION REAL']),
    sourceSection: normalizeCatalogText(sourceSection),
    sourceRowNumber,
  };
}

function resolveMainPlates(values: ExcelImportRecordValues) {
  const candidates = [
    values['PLACAS 2026'],
    values['PLACAS 2025'],
    values['PLACAS 2024'],
    values['PLACAS ANTERIORES'],
  ];

  for (const candidate of candidates) {
    const normalized = normalizePlateValue(candidate, true);

    if (normalized) {
      return normalized;
    }
  }

  return '';
}

function normalizePlateValue(value: string, compact: boolean) {
  const normalized = normalizeUpper(value);

  if (NO_PLATE_PLACEHOLDERS.has(stripDiacritics(normalized))) {
    return '';
  }

  return compact ? normalized.replace(/[\s-]+/gu, '') : normalized;
}

function normalizeEngineNumber(value: string) {
  const normalized = normalizeUpper(value);

  if (NO_ENGINE_PLACEHOLDERS.has(stripDiacritics(normalized))) {
    return 'SIN NUMERO';
  }

  return normalized;
}

function normalizeVehicleClass(value: string) {
  const normalized = normalizeCatalogText(value);

  if (stripDiacritics(normalized) === 'GRUA') {
    return 'GRUA';
  }

  return stripDiacritics(normalized);
}

function normalizePhysicalStatus(value: string) {
  const normalized = stripDiacritics(value);

  if (normalized.startsWith('SINIESTRAD')) {
    return 'MALO';
  }

  if (normalized.startsWith('BUEN')) {
    return 'BUENO';
  }

  if (normalized.startsWith('REGULAR')) {
    return 'REGULAR';
  }

  if (normalized.startsWith('MAL')) {
    return 'MALO';
  }

  return normalized || 'MALO';
}

function normalizeAssetClassification(value: string) {
  const normalized = stripDiacritics(value);

  if (!normalized) {
    return 'OTRO';
  }

  if (normalized.includes('ARREND')) {
    return 'ARRENDAMIENTO';
  }

  if (normalized.includes('PATRIMONIAL')) {
    return 'PATRIMONIAL';
  }

  return 'OTRO';
}

function normalizeCirculationStatus(value: string) {
  const normalized = stripDiacritics(normalizeUpper(value));

  if (!normalized || EMPTY_PLACEHOLDERS.has(normalized)) {
    return 'SIN ESTATUS';
  }

  return normalized;
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
  const cleanNotes = notes.filter(Boolean);

  if (cleanNotes.length === 0) {
    return baseObservation;
  }

  const suffix = cleanNotes.map((note) => `[${note}]`).join(' ');
  return [baseObservation, suffix].filter(Boolean).join(' ');
}

function normalizeModel(value: string) {
  return normalizeUpper(value).replace(/\.0$/u, '');
}

function normalizeNumericText(value: string) {
  const normalized = normalizeUpper(value).replace(/,/gu, '.');
  return normalized.replace(/\.0+$/u, '');
}

function normalizeCode(value: string) {
  return normalizeUpper(value).replace(/\s+/gu, '');
}

function normalizeCatalogText(value: string) {
  return normalizeUpper(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '')
    .replace(/\s+/gu, ' ');
}

function normalizePersonName(value: string) {
  return normalizeUpper(value).replace(/\s+/gu, ' ');
}

function normalizeText(value: string) {
  return String(value ?? '').trim().replace(/\s+/gu, ' ');
}

function normalizeUpper(value: string) {
  return normalizeText(value).toUpperCase();
}

function stripDiacritics(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '')
    .trim();
}
