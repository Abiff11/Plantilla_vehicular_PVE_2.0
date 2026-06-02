import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { Role } from 'src/common/enums/role.enum';
import { CatalogAliasEntity } from 'src/modules/catalog/entities/catalog-alias.entity';
import { CatalogGroupEntity } from 'src/modules/catalog/entities/catalog-group.entity';
import { CatalogItemEntity } from 'src/modules/catalog/entities/catalog-item.entity';
import { DelegationEntity } from 'src/modules/catalog/entities/delegation.entity';
import { UserEntity } from 'src/modules/users/entities/user.entity';
import { AuditLogsService } from 'src/modules/audit-logs/audit-logs.service';
import { RecordEntity } from '../entities/record.entity';
import { parseExcelWorkbook } from './excel-workbook.parser';

type UploadedExcelFile = {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
};

type AuthUser = {
  sub: string;
  role: Role;
  regionId: string | null;
  delegationId: string | null;
};

type ImportRow = {
  sourceRowNumber: number;
  sourceSection: string;
  values: Record<string, string>;
  normalized: NormalizedImportRecord;
  errors: string[];
};

type NormalizedImportRecord = {
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

type CatalogLookup = Map<string, Set<string>>;

const EXPECTED_HEADERS = [
  'N°',
  'CIV',
  'PLACAS ANTERIORES',
  'PLACAS 2024',
  'PLACAS 2025',
  'PLACAS 2026',
  'MARCA',
  'TIPO',
  'USO',
  'TIPO DE VEHICULO',
  'MOD.',
  'CIL.',
  'CAP.LTS',
  'NO. DE MOTOR',
  'NO. DE SERIE',
  'ADSCRIPCION',
  'RESGUARDANTE',
  'NO. PATRULLA',
  'COLOR DE LA UNIDAD',
  'ESTADO FISICO',
  'ESTATUS',
  'ANOTACION GENERAL',
  'OBSERVACION',
  'UBICACION REAL',
] as const;

const CATALOG_FIELD_MAP: Array<{
  field: keyof NormalizedImportRecord;
  catalogCode: string;
  required: boolean;
}> = [
  { field: 'useType', catalogCode: 'vehicle_use', required: true },
  { field: 'vehicleClass', catalogCode: 'vehicle_class', required: true },
  { field: 'physicalStatus', catalogCode: 'physical_status', required: true },
  { field: 'rawCirculationStatus', catalogCode: 'circulation_status', required: false },
  { field: 'status', catalogCode: 'system_status', required: true },
  { field: 'assetClassification', catalogCode: 'asset_classification', required: false },
  { field: 'sourceSection', catalogCode: 'excel_section', required: false },
];

const GENERIC_ENGINE_VALUES = new Set([
  'SIN NUMERO',
  'SIN NÚMERO',
  'N/A',
  'NA',
  'HECHO EN MEXICO',
  'SIN MOTOR',
  'S/M',
]);

const EXCEL_MIME_TYPES = new Set([
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/octet-stream',
  'application/zip',
  '',
]);

@Injectable()
export class RecordsImportService {
  constructor(
    @InjectRepository(RecordEntity)
    private readonly recordRepository: Repository<RecordEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    @InjectRepository(DelegationEntity)
    private readonly delegationRepository: Repository<DelegationEntity>,
    @InjectRepository(CatalogGroupEntity)
    private readonly catalogGroupRepository: Repository<CatalogGroupEntity>,
    @InjectRepository(CatalogItemEntity)
    private readonly catalogItemRepository: Repository<CatalogItemEntity>,
    @InjectRepository(CatalogAliasEntity)
    private readonly catalogAliasRepository: Repository<CatalogAliasEntity>,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  async preview(file: UploadedExcelFile) {
    this.assertExcelFile(file);
    const parsed = await this.parseImportRows(file);
    const catalogLookup = await this.buildCatalogLookup();
    const rows = await this.validateRows(parsed.rows, catalogLookup);
    const invalidRows = rows.filter((row) => row.errors.length > 0);
    const pendingCatalogValues = this.findPendingCatalogValues(rows, catalogLookup);

    return {
      fileName: file.originalname,
      sheetName: parsed.sheetName,
      totalRows: rows.length,
      validRows: rows.length - invalidRows.length,
      invalidRows: invalidRows.length,
      sourceSections: Array.from(new Set(rows.map((row) => row.sourceSection).filter(Boolean))),
      pendingCatalogValues,
      errors: invalidRows.map((row) => ({
        rowNumber: row.sourceRowNumber,
        section: row.sourceSection,
        messages: row.errors,
      })),
      sampleRows: rows.slice(0, 20).map((row) => row.normalized),
    };
  }

  async commit(file: UploadedExcelFile, authUser: AuthUser) {
    this.assertExcelFile(file);
    this.assertImportRole(authUser);

    const user = await this.userRepository.findOneBy({ id: authUser.sub });

    if (!user) {
      throw new NotFoundException('No se encontro el usuario autenticado.');
    }

    const defaultDelegation = await this.resolveDefaultDelegation(authUser);
    const parsed = await this.parseImportRows(file);
    const catalogLookup = await this.buildCatalogLookup();
    const rows = await this.validateRows(parsed.rows, catalogLookup);
    const invalidRows = rows.filter((row) => row.errors.length > 0);
    const pendingCatalogValues = this.findPendingCatalogValues(rows, catalogLookup);

    if (invalidRows.length > 0 || pendingCatalogValues.length > 0) {
      throw new BadRequestException({
        message: 'La importacion tiene errores o valores pendientes de catalogo.',
        invalidRows: invalidRows.length,
        pendingCatalogValues,
        errors: invalidRows.slice(0, 50).map((row) => ({
          rowNumber: row.sourceRowNumber,
          section: row.sourceSection,
          messages: row.errors,
        })),
      });
    }

    const importBatchId = randomUUID();
    const records = rows.map((row) =>
      this.recordRepository.create({
        ...row.normalized,
        importBatchId,
        delegation: defaultDelegation,
        createdBy: user,
      }),
    );

    const savedRecords = await this.recordRepository.save(records, { chunk: 50 });

    await this.auditLogsService.register({
      actorId: authUser.sub,
      action: 'VEHICLE_IMPORT_COMMITTED',
      entityType: 'vehicle_import_batch',
      entityId: importBatchId,
      metadata: {
        fileName: file.originalname,
        sheetName: parsed.sheetName,
        importedRows: savedRecords.length,
        delegationId: defaultDelegation.id,
        importBatchId,
      },
    });

    return {
      importBatchId,
      fileName: file.originalname,
      sheetName: parsed.sheetName,
      importedRows: savedRecords.length,
    };
  }

  private assertExcelFile(file: UploadedExcelFile) {
    if (!file) {
      throw new BadRequestException('Se requiere un archivo Excel.');
    }

    if (!file.originalname.toLowerCase().endsWith('.xlsx')) {
      throw new BadRequestException('Solo se permite archivo .xlsx.');
    }

    if (!EXCEL_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException('El archivo no tiene un tipo MIME permitido para Excel.');
    }

    if (file.size > 15 * 1024 * 1024) {
      throw new BadRequestException('El archivo Excel no debe superar 15 MB.');
    }
  }

  private assertImportRole(authUser: AuthUser) {
    if (
      authUser.role === Role.PlantillaVehicular ||
      authUser.role === Role.SuperAdmin ||
      authUser.role === Role.Coordinacion
    ) {
      return;
    }

    throw new BadRequestException('El usuario no tiene permisos para importar plantilla vehicular.');
  }

  private async resolveDefaultDelegation(authUser: AuthUser) {
    const delegation = await this.delegationRepository.findOne({
      where: authUser.delegationId ? { id: authUser.delegationId } : {},
      relations: { region: true },
      order: { sortOrder: 'ASC' },
    });

    if (!delegation) {
      throw new BadRequestException('No existe una delegacion disponible para asociar la importacion.');
    }

    return delegation;
  }

  private async parseImportRows(file: UploadedExcelFile) {
    const workbook = parseExcelWorkbook(file.buffer);
    const sheet =
      workbook.sheets.find((candidate) => candidate.name === 'PLANTILLA GENERAL 2025 (IMPRIM)') ??
      workbook.sheets[0];

    if (!sheet) {
      throw new BadRequestException('El Excel no contiene hojas legibles.');
    }

    const headerIndex = sheet.rows.findIndex((row) =>
      row.some((cell) => normalizeHeader(cell) === 'CIV') &&
      row.some((cell) => normalizeHeader(cell) === 'PLACAS 2026'),
    );

    if (headerIndex < 0) {
      throw new BadRequestException('No se encontro la fila de encabezados esperada.');
    }

    const headers = sheet.rows[headerIndex].map(normalizeHeader);
    const missingHeaders = EXPECTED_HEADERS.filter(
      (expectedHeader) => !headers.includes(normalizeHeader(expectedHeader)),
    );

    if (missingHeaders.length > 0) {
      throw new BadRequestException(
        `Faltan columnas obligatorias en el Excel: ${missingHeaders.join(', ')}.`,
      );
    }

    const columnMap = new Map<string, number>();
    headers.forEach((header, index) => {
      if (header) {
        columnMap.set(header, index);
      }
    });

    const rows: ImportRow[] = [];
    let currentSection = '';

    for (let index = headerIndex + 1; index < sheet.rows.length; index += 1) {
      const row = sheet.rows[index];
      const values = this.mapRowValues(row, columnMap);
      const section = detectSection(values, row);

      if (section) {
        currentSection = section;
        continue;
      }

      if (!isVehicleRow(values)) {
        continue;
      }

      const normalized = normalizeImportRecord(values, currentSection, index + 1);
      rows.push({
        sourceRowNumber: index + 1,
        sourceSection: currentSection,
        values,
        normalized,
        errors: [],
      });
    }

    return { sheetName: sheet.name, rows };
  }

  private mapRowValues(row: string[], columnMap: Map<string, number>) {
    const values: Record<string, string> = {};

    for (const header of EXPECTED_HEADERS) {
      const columnIndex = columnMap.get(normalizeHeader(header));
      values[header] = columnIndex === undefined ? '' : normalizeText(row[columnIndex] ?? '');
    }

    return values;
  }

  private async buildCatalogLookup(): Promise<CatalogLookup> {
    const groups = await this.catalogGroupRepository.find({
      where: { code: In(CATALOG_FIELD_MAP.map((entry) => entry.catalogCode)) },
      relations: { items: true },
    });
    const aliases = await this.catalogAliasRepository.find({
      relations: { catalogItem: { group: true } },
    });
    const lookup: CatalogLookup = new Map();

    for (const group of groups) {
      const values = new Set<string>();

      for (const item of group.items ?? []) {
        if (item.isActive) {
          values.add(normalizeCatalogValue(item.label));
          values.add(normalizeCatalogValue(item.normalizedValue));
          values.add(normalizeCatalogValue(item.code));
        }
      }

      lookup.set(group.code, values);
    }

    for (const alias of aliases) {
      const groupCode = alias.catalogItem.group.code;
      const values = lookup.get(groupCode) ?? new Set<string>();
      values.add(normalizeCatalogValue(alias.rawValue));
      values.add(normalizeCatalogValue(alias.normalizedRawValue));
      lookup.set(groupCode, values);
    }

    return lookup;
  }

  private async validateRows(rows: ImportRow[], catalogLookup: CatalogLookup) {
    const duplicateLookup = await this.buildDuplicateLookup(rows);

    for (const row of rows) {
      row.errors = validateRow(row.normalized, catalogLookup, duplicateLookup);
    }

    return rows;
  }

  private async buildDuplicateLookup(rows: ImportRow[]) {
    const plates = rows.map((row) => row.normalized.plates).filter(Boolean);
    const serialNumbers = rows.map((row) => row.normalized.serialNumber).filter(Boolean);
    const civs = rows.map((row) => row.normalized.civ).filter(Boolean);
    const engineNumbers = rows
      .map((row) => row.normalized.engineNumber)
      .filter((value) => value && !GENERIC_ENGINE_VALUES.has(normalizeCatalogValue(value)));

    const existingRecords = await this.recordRepository.find({
      where: [
        ...(plates.length > 0 ? [{ plates: In(plates) }] : []),
        ...(serialNumbers.length > 0 ? [{ serialNumber: In(serialNumbers) }] : []),
        ...(engineNumbers.length > 0 ? [{ engineNumber: In(engineNumbers) }] : []),
        ...(civs.length > 0 ? [{ civ: In(civs) }] : []),
      ],
    });

    return {
      plates: countValues(plates),
      serialNumbers: countValues(serialNumbers),
      engineNumbers: countValues(engineNumbers),
      civs: countValues(civs),
      existingPlates: new Set(existingRecords.map((record) => record.plates).filter(Boolean)),
      existingSerialNumbers: new Set(existingRecords.map((record) => record.serialNumber).filter(Boolean)),
      existingEngineNumbers: new Set(existingRecords.map((record) => record.engineNumber).filter(Boolean)),
      existingCivs: new Set(existingRecords.map((record) => record.civ).filter(Boolean)),
    };
  }

  private findPendingCatalogValues(rows: ImportRow[], catalogLookup: CatalogLookup) {
    const pending = new Map<string, Set<string>>();

    for (const row of rows) {
      for (const entry of CATALOG_FIELD_MAP) {
        const value = row.normalized[entry.field];

        if (!value || !entry.required) {
          continue;
        }

        const catalogValues = catalogLookup.get(entry.catalogCode) ?? new Set<string>();

        if (!catalogValues.has(normalizeCatalogValue(String(value)))) {
          const values = pending.get(entry.catalogCode) ?? new Set<string>();
          values.add(String(value));
          pending.set(entry.catalogCode, values);
        }
      }
    }

    return Array.from(pending.entries()).map(([catalogCode, values]) => ({
      catalogCode,
      values: Array.from(values).sort((left, right) => left.localeCompare(right)),
    }));
  }
}

function normalizeImportRecord(
  values: Record<string, string>,
  sourceSection: string,
  sourceRowNumber: number,
): NormalizedImportRecord {
  const rawCirculationStatus = normalizeUpper(values.ESTATUS || 'SIN ESTATUS');

  return {
    civ: normalizeUpper(values.CIV),
    previousPlates: normalizeUpper(values['PLACAS ANTERIORES']),
    plates2024: normalizeUpper(values['PLACAS 2024']),
    plates2025: normalizeUpper(values['PLACAS 2025']),
    plates2026: normalizeUpper(values['PLACAS 2026']),
    plates: resolveMainPlates(values),
    brand: normalizeUpper(values.MARCA),
    type: normalizeUpper(values.TIPO),
    useType: normalizeUpper(values.USO),
    vehicleClass: normalizeUpper(values['TIPO DE VEHICULO']),
    model: normalizeUpper(values['MOD.']),
    cylinders: normalizeUpper(values['CIL.']),
    fuelCapacityLiters: normalizeUpper(values['CAP.LTS']),
    engineNumber: normalizeUpper(values['NO. DE MOTOR']),
    serialNumber: normalizeUpper(values['NO. DE SERIE']),
    adscription: normalizeUpper(values.ADSCRIPCION),
    custodian: normalizeUpper(values.RESGUARDANTE),
    patrolNumber: normalizeUpper(values['NO. PATRULLA']),
    color: normalizeUpper(values['COLOR DE LA UNIDAD']),
    physicalStatus: normalizeUpper(values['ESTADO FISICO']),
    status: deriveSystemStatus(rawCirculationStatus),
    rawCirculationStatus,
    assetClassification: normalizeUpper(values['ANOTACION GENERAL'] || 'OTRO'),
    observation: normalizeText(values.OBSERVACION),
    realLocation: normalizeUpper(values['UBICACION REAL']),
    sourceSection: normalizeUpper(sourceSection),
    sourceRowNumber,
  };
}

function validateRow(
  record: NormalizedImportRecord,
  catalogLookup: CatalogLookup,
  duplicateLookup: Awaited<ReturnType<RecordsImportService['buildDuplicateLookup']>>,
) {
  const errors: string[] = [];

  if (!record.plates && !record.serialNumber && !record.civ) {
    errors.push('La fila requiere placas, numero de serie o CIV para identificar la unidad.');
  }

  for (const requiredField of ['brand', 'type', 'useType', 'vehicleClass', 'model', 'engineNumber', 'serialNumber', 'custodian', 'physicalStatus', 'status'] as const) {
    if (!record[requiredField]) {
      errors.push(`Campo obligatorio vacio: ${requiredField}.`);
    }
  }

  for (const entry of CATALOG_FIELD_MAP) {
    const value = record[entry.field];

    if (!value && !entry.required) {
      continue;
    }

    const catalogValues = catalogLookup.get(entry.catalogCode) ?? new Set<string>();

    if (entry.required && !catalogValues.has(normalizeCatalogValue(String(value)))) {
      errors.push(`Valor pendiente de catalogo ${entry.catalogCode}: ${value}.`);
    }
  }

  if (record.plates && duplicateLookup.plates.get(record.plates)! > 1) {
    errors.push(`Placas duplicadas dentro del Excel: ${record.plates}.`);
  }

  if (record.serialNumber && duplicateLookup.serialNumbers.get(record.serialNumber)! > 1) {
    errors.push(`Numero de serie duplicado dentro del Excel: ${record.serialNumber}.`);
  }

  if (record.civ && duplicateLookup.civs.get(record.civ)! > 1) {
    errors.push(`CIV duplicado dentro del Excel: ${record.civ}.`);
  }

  if (
    record.engineNumber &&
    !GENERIC_ENGINE_VALUES.has(normalizeCatalogValue(record.engineNumber)) &&
    duplicateLookup.engineNumbers.get(record.engineNumber)! > 1
  ) {
    errors.push(`Numero de motor duplicado dentro del Excel: ${record.engineNumber}.`);
  }

  if (record.plates && duplicateLookup.existingPlates.has(record.plates)) {
    errors.push(`Las placas ya existen en una captura activa: ${record.plates}.`);
  }

  if (record.serialNumber && duplicateLookup.existingSerialNumbers.has(record.serialNumber)) {
    errors.push(`El numero de serie ya existe en una captura activa: ${record.serialNumber}.`);
  }

  if (
    record.engineNumber &&
    !GENERIC_ENGINE_VALUES.has(normalizeCatalogValue(record.engineNumber)) &&
    duplicateLookup.existingEngineNumbers.has(record.engineNumber)
  ) {
    errors.push(`El numero de motor ya existe en una captura activa: ${record.engineNumber}.`);
  }

  if (record.civ && duplicateLookup.existingCivs.has(record.civ)) {
    errors.push(`El CIV ya existe en una captura activa: ${record.civ}.`);
  }

  return errors;
}

function detectSection(values: Record<string, string>, row: string[]) {
  const civ = normalizeText(values.CIV);
  const brand = normalizeText(values.MARCA);
  const serialNumber = normalizeText(values['NO. DE SERIE']);
  const joined = row.map(normalizeText).filter(Boolean).join(' ');

  if (!civ && !brand && !serialNumber && joined.length > 0) {
    return normalizeUpper(joined);
  }

  return '';
}

function isVehicleRow(values: Record<string, string>) {
  return Boolean(
    normalizeText(values.CIV) ||
      normalizeText(values['PLACAS 2026']) ||
      normalizeText(values.MARCA) ||
      normalizeText(values['NO. DE SERIE']),
  );
}

function resolveMainPlates(values: Record<string, string>) {
  const candidates = [
    values['PLACAS 2026'],
    values['PLACAS 2025'],
    values['PLACAS 2024'],
    values['PLACAS ANTERIORES'],
  ];

  for (const candidate of candidates) {
    const normalized = normalizeUpper(candidate);

    if (normalized && normalized !== 'S/P' && normalized !== 'SP') {
      return normalized;
    }
  }

  return '';
}

function deriveSystemStatus(rawCirculationStatus: string) {
  switch (normalizeCatalogValue(rawCirculationStatus)) {
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

function countValues(values: string[]) {
  const result = new Map<string, number>();

  for (const value of values) {
    result.set(value, (result.get(value) ?? 0) + 1);
  }

  return result;
}

function normalizeHeader(value: string) {
  return normalizeUpper(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '')
    .replace(/\s+/gu, ' ')
    .replace(/^NO\s+/u, 'NO. ')
    .trim();
}

function normalizeText(value: string) {
  return String(value ?? '').trim().replace(/\s+/gu, ' ');
}

function normalizeUpper(value: string) {
  return normalizeText(value).toUpperCase();
}

function normalizeCatalogValue(value: string) {
  return normalizeUpper(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '');
}
