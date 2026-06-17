import { BadRequestException, ConflictException } from '@nestjs/common';
import { RECORD_FIELD_CATALOG } from 'src/modules/catalog/record-field-catalog';

type NormalizedRecordValues = {
  plates: string;
  engineNumber: string;
  serialNumber: string;
  brand: string;
  type: string;
  useType: string;
  vehicleClass: string;
  model: string;
  custodian: string;
  patrolNumber: string;
  physicalStatus: string;
  status: string;
  assetClassification: string;
  rawAssetClassification: string;
  observation: string;
};

const catalogValidatedFields = ['useType', 'vehicleClass', 'physicalStatus', 'status', 'assetClassification'] as const;
type CatalogValidatedField = (typeof catalogValidatedFields)[number];

function validateCatalogFields(values: NormalizedRecordValues): string | null {
  for (const field of catalogValidatedFields) {
    const value = values[field];
    if (!value || value.trim().length === 0) continue;
    const catalogEntry = RECORD_FIELD_CATALOG[field];
    const validValues = catalogEntry.options.map((opt: { value: string }) => opt.value);
    if (!validValues.includes(value)) {
      if (catalogEntry.allowsCustom) continue;
      const fieldLabel = catalogEntry.label;
      return `${fieldLabel}: '${value}' is not a valid option. Allowed: ${validValues.join(', ')}.`;
    }
  }
  return null;
}

function makeEmptyRecord(overrides: Partial<NormalizedRecordValues> = {}): NormalizedRecordValues {
  return {
    plates: '', engineNumber: '', serialNumber: '', brand: '', type: '',
    useType: '', vehicleClass: '', model: '', custodian: '', patrolNumber: '',
    physicalStatus: '', status: '', assetClassification: '', observation: '',
    rawAssetClassification: '',
    ...overrides,
  };
}

async function ensureNoDuplicateRecords(
  values: Record<string, string>,
  findFn: (field: string, value: string) => Promise<boolean>,
): Promise<void> {
  const uniqueFields = ['plates', 'engineNumber', 'serialNumber'] as const;
  const conflicts: string[] = [];

  for (const field of uniqueFields) {
    const fieldValue = values[field];
    if (!fieldValue || fieldValue.trim().length === 0) continue;
    const exists = await findFn(field, fieldValue);
    if (exists) {
      const fieldLabel = field === 'plates' ? 'Plates' : field === 'engineNumber' ? 'Engine number' : 'Serial number';
      conflicts.push(`${fieldLabel} '${fieldValue}' is already in use by an active record.`);
    }
  }

  if (conflicts.length > 0) {
    throw new ConflictException(conflicts.join(' '));
  }
}

describe('Duplicate record validation logic', () => {
  it('throws ConflictException for duplicate plates', async () => {
    const findFn = jest.fn(async (field, value) => field === 'plates' && value === 'ABC123');

    await expect(
      ensureNoDuplicateRecords(
        { plates: 'ABC123', engineNumber: '', serialNumber: '', brand: '', type: '', useType: '', vehicleClass: '', model: '', custodian: '', patrolNumber: '', physicalStatus: '', status: '', assetClassification: '', observation: '' },
        findFn,
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('throws ConflictException for duplicate engine number', async () => {
    const findFn = jest.fn(async (field, value) => field === 'engineNumber' && value === 'ENG001');

    await expect(
      ensureNoDuplicateRecords(
        { plates: '', engineNumber: 'ENG001', serialNumber: '', brand: '', type: '', useType: '', vehicleClass: '', model: '', custodian: '', patrolNumber: '', physicalStatus: '', status: '', assetClassification: '', observation: '' },
        findFn,
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('throws ConflictException for duplicate serial number', async () => {
    const findFn = jest.fn(async (field, value) => field === 'serialNumber' && value === 'SER001');

    await expect(
      ensureNoDuplicateRecords(
        { plates: '', engineNumber: '', serialNumber: 'SER001', brand: '', type: '', useType: '', vehicleClass: '', model: '', custodian: '', patrolNumber: '', physicalStatus: '', status: '', assetClassification: '', observation: '' },
        findFn,
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('does not throw when no duplicates exist', async () => {
    const findFn = jest.fn(async () => false);

    await expect(
      ensureNoDuplicateRecords(
        { plates: 'XYZ789', engineNumber: 'NEW001', serialNumber: 'NEW002', brand: '', type: '', useType: '', vehicleClass: '', model: '', custodian: '', patrolNumber: '', physicalStatus: '', status: '', assetClassification: '', observation: '' },
        findFn,
      ),
    ).resolves.not.toThrow();
  });

  it('skips empty fields', async () => {
    const findFn = jest.fn(async () => true);

    await expect(
      ensureNoDuplicateRecords(
        { plates: '', engineNumber: '', serialNumber: '', brand: '', type: '', useType: '', vehicleClass: '', model: '', custodian: '', patrolNumber: '', physicalStatus: '', status: '', assetClassification: '', observation: '' },
        findFn,
      ),
    ).resolves.not.toThrow();

    expect(findFn).not.toHaveBeenCalled();
  });
});

describe('Catalog field validation logic', () => {
  it('accepts valid value for closed field vehicleClass', () => {
    const result = validateCatalogFields(makeEmptyRecord({ vehicleClass: 'SEDAN' }));
    expect(result).toBeNull();
  });

  it('accepts MICROBUS as valid value for closed field vehicleClass', () => {
    const result = validateCatalogFields(makeEmptyRecord({ vehicleClass: 'MICROBUS' }));
    expect(result).toBeNull();
  });

  it('accepts AUTOMOVIL as valid value for closed field vehicleClass', () => {
    const result = validateCatalogFields(makeEmptyRecord({ vehicleClass: 'AUTOMOVIL' }));
    expect(result).toBeNull();
  });

  it('accepts CAMIONETA as valid value for closed field vehicleClass', () => {
    const result = validateCatalogFields(makeEmptyRecord({ vehicleClass: 'CAMIONETA' }));
    expect(result).toBeNull();
  });

  it('rejects invalid value for closed field vehicleClass', () => {
    const result = validateCatalogFields(makeEmptyRecord({ vehicleClass: 'CAMION' }));
    expect(result).toContain('Clase de vehiculo');
    expect(result).toContain('CAMION');
    expect(result).toContain('not a valid option');
  });

  it('accepts valid value for closed field physicalStatus', () => {
    const result = validateCatalogFields(makeEmptyRecord({ physicalStatus: 'REGULAR' }));
    expect(result).toBeNull();
  });

  it('rejects invalid value for closed field physicalStatus', () => {
    const result = validateCatalogFields(makeEmptyRecord({ physicalStatus: 'DESTRUIDO' }));
    expect(result).toContain('Estado fisico');
    expect(result).toContain('DESTRUIDO');
  });

  it('accepts custom value for open field useType', () => {
    const result = validateCatalogFields(makeEmptyRecord({ useType: 'AMBULANCIA' }));
    expect(result).toBeNull();
  });

  it('accepts custom value for open field status', () => {
    const result = validateCatalogFields(makeEmptyRecord({ status: 'EN REPARACION' }));
    expect(result).toBeNull();
  });

  it('accepts catalog value for open field assetClassification', () => {
    const result = validateCatalogFields(makeEmptyRecord({ assetClassification: 'PATRIMONIAL' }));
    expect(result).toBeNull();
  });

  it('accepts custom value for open field assetClassification', () => {
    const result = validateCatalogFields(makeEmptyRecord({ assetClassification: 'DONACION' }));
    expect(result).toBeNull();
  });

  it('skips empty catalog fields', () => {
    const result = validateCatalogFields(makeEmptyRecord({ vehicleClass: '', physicalStatus: '' }));
    expect(result).toBeNull();
  });

  it('reports first invalid field found', () => {
    const result = validateCatalogFields(
      makeEmptyRecord({ vehicleClass: 'INVALIDO', physicalStatus: 'MALO' }),
    );
    expect(result).toContain('Clase de vehiculo');
    expect(result).toContain('INVALIDO');
  });
});
