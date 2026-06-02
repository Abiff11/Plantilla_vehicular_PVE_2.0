import { strict as assert } from 'node:assert';
import { normalizeExcelImportRecord } from 'src/modules/records/imports/excel-import-normalizer';

const BASE_ROW: Record<string, string> = {
  'N°': '1',
  CIV: ' CIV-001 ',
  'PLACAS ANTERIORES': 'ANT 123',
  'PLACAS 2024': 'PVE-2024',
  'PLACAS 2025': 'PVE 2025',
  'PLACAS 2026': 'PVE-2026',
  MARCA: 'Nissan',
  TIPO: 'Pick Up',
  USO: 'Operativo',
  'TIPO DE VEHICULO': 'Grúa',
  'MOD.': '2024.0',
  'CIL.': '4.0',
  'CAP.LTS': '55,0',
  'NO. DE MOTOR': ' ABC 123 ',
  'NO. DE SERIE': ' serie 001 ',
  ADSCRIPCION: ' Servicios ',
  RESGUARDANTE: ' Juan Pérez ',
  'NO. PATRULLA': ' p-01 ',
  'COLOR DE LA UNIDAD': ' Azul con blanco ',
  'ESTADO FISICO': 'Bueno',
  ESTATUS: 'Circulando',
  'ANOTACION GENERAL': 'Patrimonial 2025',
  OBSERVACION: 'Unidad revisada',
  'UBICACION REAL': 'Plaza',
};

function normalize(overrides: Partial<Record<string, string>> = {}) {
  return normalizeExcelImportRecord(
    {
      ...BASE_ROW,
      ...overrides,
    },
    'Delegación Regional Plaza',
    10,
  );
}

function assertBaseNormalization() {
  const record = normalize();

  assert.equal(record.civ, 'CIV-001');
  assert.equal(record.plates, 'PVE2026');
  assert.equal(record.plates2026, 'PVE-2026');
  assert.equal(record.vehicleClass, 'GRUA');
  assert.equal(record.model, '2024');
  assert.equal(record.cylinders, '4');
  assert.equal(record.fuelCapacityLiters, '55');
  assert.equal(record.engineNumber, 'ABC 123');
  assert.equal(record.serialNumber, 'SERIE001');
  assert.equal(record.status, 'ACTIVO');
  assert.equal(record.rawCirculationStatus, 'CIRCULANDO');
  assert.equal(record.assetClassification, 'PATRIMONIAL');
  assert.equal(record.sourceSection, 'DELEGACION REGIONAL PLAZA');
}

function assertPlateFallback() {
  const record = normalize({
    'PLACAS 2026': 'S/P',
    'PLACAS 2025': '',
    'PLACAS 2024': 'ABC 123',
    'PLACAS ANTERIORES': 'OLD 999',
  });

  assert.equal(record.plates, 'ABC123');
}

function assertPhysicalStatusNormalization() {
  const record = normalize({
    'ESTADO FISICO': 'Siniestrado 08/10/2025',
  });

  assert.equal(record.physicalStatus, 'MALO');
  assert.match(record.observation, /Estado fisico Excel: SINIESTRADO 08\/10\/2025/u);
}

function assertCirculationStatusNormalization() {
  assert.equal(normalize({ ESTATUS: 'Nueva' }).status, 'ACTIVO');
  assert.equal(normalize({ ESTATUS: 'Reposición' }).status, 'ACTIVO');
  assert.equal(normalize({ ESTATUS: 'No circulando' }).status, 'INCATIVO');
  assert.equal(normalize({ ESTATUS: 'Baja' }).status, 'PARA BAJA');
  assert.equal(normalize({ ESTATUS: '' }).rawCirculationStatus, 'SIN ESTATUS');
  assert.equal(normalize({ ESTATUS: '' }).status, 'OTRO');
}

function assertAssetClassificationNormalization() {
  assert.equal(normalize({ 'ANOTACION GENERAL': 'Arrendamiento unidad nueva' }).assetClassification, 'ARRENDAMIENTO');
  assert.equal(normalize({ 'ANOTACION GENERAL': '' }).assetClassification, 'OTRO');
}

function assertGenericEngineNormalization() {
  assert.equal(normalize({ 'NO. DE MOTOR': 'S/M' }).engineNumber, 'SIN NUMERO');
  assert.equal(normalize({ 'NO. DE MOTOR': 'Hecho en México' }).engineNumber, 'SIN NUMERO');
}

function main() {
  assertBaseNormalization();
  assertPlateFallback();
  assertPhysicalStatusNormalization();
  assertCirculationStatusNormalization();
  assertAssetClassificationNormalization();
  assertGenericEngineNormalization();

  console.log('Excel import normalization validation passed.');
}

main();
