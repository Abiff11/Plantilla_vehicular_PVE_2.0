import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Role } from 'src/common/enums/role.enum';
import { AuditLogsService } from 'src/modules/audit-logs/audit-logs.service';
import { CatalogAliasEntity } from 'src/modules/catalog/entities/catalog-alias.entity';
import { CatalogGroupEntity } from 'src/modules/catalog/entities/catalog-group.entity';
import { CatalogItemEntity } from 'src/modules/catalog/entities/catalog-item.entity';
import { DelegationEntity } from 'src/modules/catalog/entities/delegation.entity';
import { UserEntity } from 'src/modules/users/entities/user.entity';
import { RecordEntity } from '../entities/record.entity';
import {
  VehicleImportBatchEntity,
  VehicleImportBatchStatus,
} from '../entities/vehicle-import-batch.entity';
import { VehicleImportErrorEntity } from '../entities/vehicle-import-error.entity';
import {
  normalizeExcelImportRecord,
  type NormalizedExcelImportRecord,
} from './excel-import-normalizer';
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
  normalized: NormalizedExcelImportRecord;
  errors: string[];
};

type CatalogLookup = Map<string, Set<string>>;

type DuplicateLookup = {
  plates: Map<string, number>;
  serialNumbers: Map<string, number>;
  engineNumbers: Map<string, number>;
  civs: Map<string, number>;
  existingPlates: Set<string>;
  existingSerialNumbers: Set<string>;
  existingEngineNumbers: Set<string>;
  existingCivs: Set<string>;
};

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
  field: keyof NormalizedExcelImportRecord;
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
  'HECHO EN MÉXICO',
  'SIN MOTOR',
  'S/M',
  'SM',
  'S/N',
  'SN',
  'S.N.',
  'IMPORTADO',
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
    @InjectRepository(VehicleImportBatchEntity)
    private readonly importBatchRepository: Repository<VehicleImportBatchEntity>,
    @InjectRepository(VehicleImportErrorEntity)
    private readonly importErrorRepository: Repository<VehicleImportErrorEntity>,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  async preview(file: UploadedExcelFile, authUser: AuthUser) {
    this.assertExcelFile(file);
    this.assertImportRole(authUser);

    const user = await this.resolveUser(authUser);
    const parsed = await this.parseImportRows(file);
    const catalogLookup = await this.buildCatalogLookup();
    const rows = await this.validateRows(parsed.rows, catalogLookup);
    const summary = this.buildImportSummary(file.originalname, parsed.sheetName, rows, catalogLookup);
    const batch = await this.createBatch(summary, user, VehicleImportBatchStatus.Previewed, 0);

    await this.persistImportErrors(batch, rows);
    await this.auditLogsService.register({
      actorId: authUser.sub,
      action: 'VEHICLE_IMPORT_PREVIEWED',
      entityType: 'vehicle_import_batch',
      entityId: batch.id,
      metadata: {
        fileName: file.originalname,
        sheetName: parsed.sheetName,
        totalRows: summary.totalRows,
        validRows: summary.validRows,
        invalidRows: summary.invalidRows,
      },
    });

    return {
      importBatchId: batch.id,
      ...summary,
      sampleRows: rows.slice(0, 20).map((row) => row.normalized),
    };
  }

  async commit(file: UploadedExcelFile, authUser: AuthUser) {
    this.assertExcelFile(file);
    this.assertImportRole(authUser);

    const user = await this.resolveUser(authUser);
    const defaultDelegation = await this.resolveDefaultDelegation(authUser);
    const parsed = await this.parseImportRows(file);
    const catalogLookup = await this.buildCatalogLookup();
    const rows = await this.validateRows(parsed.rows, catalogLookup);
    const summary = this.buildImportSummary(file.originalname, parsed.sheetName, rows, catalogLookup);
    const hasBlockingErrors = summary.invalidRows > 0 || summary.pendingCatalogValues.length > 0;
    const batch = await this.createBatch(
      summary,
      user,
      hasBlockingErrors ? VehicleImportBatchStatus.Failed : VehicleImportBatchStatus.Imported,
      0,
    );

    await this.persistImportErrors(batch, rows);

    if (hasBlockingErrors) {
      await this.auditLogsService.register({
        actorId: authUser.sub,
        action: 'VEHICLE_IMPORT_FAILED',
        entityType: 'vehicle_import_batch',
        entityId: batch.id,
        metadata: {
          fileName: file.originalname,
          sheetName: parsed.sheetName,
          invalidRows: summary.invalidRows,
          pendingCatalogValues: summary.pendingCatalogValues,
        },
      });

      throw new BadRequestException({
        message: 'La importacion tiene errores o valores pendientes de catalogo.',
        importBatchId: batch.id,
        invalidRows: summary.invalidRows,
        pendingCatalogValues: summary.pendingCatalogValues,
        errors: summary.errors.slice(0, 50),
      });
    }

    const records = rows.map((row) =>
      this.recordRepository.create({
        ...row.normalized,
        importBatchId: batch.id,
        delegation: defaultDelegation,
        createdBy: user,
      }),
    );
    const savedRecords = await this.recordRepository.save(records, { chunk: 50 });

    batch.importedRows = savedRecords.length;
    batch.finishedAt = new Date();
    await this.importBatchRepository.save(batch);

    await this.auditLogsService.register({
      actorId: authUser.sub,
      action: 'VEHICLE_IMPORT_COMMITTED',
      entityType: 'vehicle_import_batch',
      entityId: batch.id,
      metadata: {
        fileName: file.originalname,
        sheetName: parsed.sheetName,
        importedRows: savedRecords.length,
        delegationId: defaultDelegation.id,
        importBatchId: batch.id,
      },
    });

    return {
      importBatchId: batch.id,
      fileName: file.originalname,
      sheetName: parsed.sheetName,
      importedRows: savedRecords.length,
    };
  }

  findImportBatches() {
    return this.importBatchRepository.find({
      relations: { createdBy: true },
      order: { createdAt: 'DESC' },
      take: 100,
    });
  }

  async findImportErrors(batchId: string) {
    const batch = await this.importBatchRepository.findOne({ where: { id: batchId } });

    if (!batch) {
      throw new NotFoundException('No se encontro el lote de importacion.');
    }

    return this.importErrorRepository.find({
      where: { batch: { id: batchId } },
      order: { rowNumber: 'ASC', createdAt: 'ASC' },
    });
  }

  private async resolveUser(authUser: AuthUser) {
    const user = await this.userRepository.findOneBy({ id: authUser.sub });

    if (!user) {
      throw new NotFoundException('No se encontro el usuario autenticado.');
    }

    return user;
  }

  private async createBatch(
    summary: ReturnType<RecordsImportService['buildImportSummary']>,
    user: UserEntity,
    status: VehicleImportBatchStatus,
    importedRows: number,
  ) {
    return this.importBatchRepository.save(
      this.importBatchRepository.create({
        fileName: summary.fileName,
        sheetName: summary.sheetName,
        totalRows: summary.totalRows,
        validRows: summary.validRows,
        invalidRows: summary.invalidRows,
        importedRows,
        status,
        sourceSections: summary.sourceSections,
        pendingCatalogValues: summary.pendingCatalogValues,
        finishedAt:
          status === VehicleImportBatchStatus.Imported || status === VehicleImportBatchStatus.Failed
            ? new Date()
            : null,
        createdBy: user,
      }),
    );
  }

  private async persistImportErrors(batch: VehicleImportBatchEntity, rows: ImportRow[]) {
    const errors = rows.flatMap((row) =>
      row.errors.map((message) =>
        this.importErrorRepository.create({
          batch,
          rowNumber: row.sourceRowNumber,
          section: row.sourceSection,
          columnName: resolveErrorColumnName(message),
          rawValue: resolveErrorRawValue(message, row),
          errorType: resolveErrorType(message),
          message,
        }),
      ),
    );

    if (errors.length === 0) {
      return [];
    }

    return this.importErrorRepository.save(errors, { chunk: 100 });
  }

  private buildImportSummary(
    fileName: string,
    sheetName: string,
    rows: ImportRow[],
    catalogLookup: CatalogLookup,
  ) {
    const invalidRows = rows.filter((row) => row.errors.length > 0);
    const pendingCatalogValues = this.findPendingCatalogValues(rows, catalogLookup);

    return {
      fileName,
      sheetName,
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
    if (authUser.delegationId) {
      const assignedDelegation = await this.delegationRepository.findOne({
        where: { id: authUser.delegationId },
        relations: { region: true },
      });

      if (assignedDelegation) {
        return assignedDelegation;
      }
    }

    const firstDelegation = await this.delegationRepository.findOne({
      where: {},
      relations: { region: true },
      order: { sortOrder: 'ASC' },
    });

    if (!firstDelegation) {
      throw new BadRequestException('No existe una delegacion disponible para asociar la importacion.');
    }

    return firstDelegation;
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

      const normalized = normalizeExcelImportRecord(values, currentSection, index + 1);

      if (!isImportableVehicleRow(normalized)) {
        continue;
      }

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

  private async buildDuplicateLookup(rows: ImportRow[]): Promise<DuplicateLookup> {
    const plates = rows
      .map((row) => row.normalized.plates)
      .filter((value) => value && isStrongPlateValue(value));
    const serialNumbers = rows.map((row) => row.normalized.serialNumber).filter(Boolean);
    const civs = rows
      .map((row) => row.normalized.civ)
      .filter((value) => value && isStrongCivValue(value));
    const engineNumbers = rows
      .map((row) => row.normalized.engineNumber)
      .filter((value) => value && !GENERIC_ENGINE_VALUES.has(normalizeCatalogValue(value)));
    const where = [
      ...(plates.length > 0 ? [{ plates: In(plates) }] : []),
      ...(serialNumbers.length > 0 ? [{ serialNumber: In(serialNumbers) }] : []),
      ...(engineNumbers.length > 0 ? [{ engineNumber: In(engineNumbers) }] : []),
      ...(civs.length > 0 ? [{ civ: In(civs) }] : []),
    ];
    const existingRecords = where.length > 0 ? await this.recordRepository.find({ where }) : [];

    return {
      plates: countValues(plates),
      serialNumbers: countValues(serialNumbers),
      engineNumbers: countValues(engineNumbers),
      civs: countValues(civs),
      existingPlates: new Set(existingRecords.map((record) => record.plates).filter(isStrongPlateValue)),
      existingSerialNumbers: new Set(existingRecords.map((record) => record.serialNumber).filter(Boolean)),
      existingEngineNumbers: new Set(existingRecords.map((record) => record.engineNumber).filter(Boolean)),
      existingCivs: new Set(existingRecords.map((record) => record.civ).filter(isStrongCivValue)),
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

function validateRow(
  record: NormalizedExcelImportRecord,
  catalogLookup: CatalogLookup,
  duplicateLookup: DuplicateLookup,
) {
  const errors: string[] = [];

  if (!record.plates && !record.serialNumber && !record.civ) {
    errors.push('La fila requiere placas, numero de serie o CIV para identificar la unidad.');
  }

  for (const requiredField of ['type', 'useType', 'vehicleClass', 'model', 'serialNumber', 'custodian', 'physicalStatus', 'status'] as const) {
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

  if (record.plates && isStrongPlateValue(record.plates) && (duplicateLookup.plates.get(record.plates) ?? 0) > 1) {
    errors.push(`Placas duplicadas dentro del Excel: ${record.plates}.`);
  }

  if (record.serialNumber && (duplicateLookup.serialNumbers.get(record.serialNumber) ?? 0) > 1) {
    errors.push(`Numero de serie duplicado dentro del Excel: ${record.serialNumber}.`);
  }

  if (record.civ && isStrongCivValue(record.civ) && (duplicateLookup.civs.get(record.civ) ?? 0) > 1) {
    errors.push(`CIV duplicado dentro del Excel: ${record.civ}.`);
  }

  if (
    record.engineNumber &&
    !GENERIC_ENGINE_VALUES.has(normalizeCatalogValue(record.engineNumber)) &&
    (duplicateLookup.engineNumbers.get(record.engineNumber) ?? 0) > 1
  ) {
    errors.push(`Numero de motor duplicado dentro del Excel: ${record.engineNumber}.`);
  }

  if (record.plates && isStrongPlateValue(record.plates) && duplicateLookup.existingPlates.has(record.plates)) {
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

  if (record.civ && isStrongCivValue(record.civ) && duplicateLookup.existingCivs.has(record.civ)) {
    errors.push(`El CIV ya existe en una captura activa: ${record.civ}.`);
  }

  return errors;
}

function resolveErrorColumnName(message: string) {
  const catalogMatch = message.match(/catalogo ([^:]+):/iu);

  if (catalogMatch) {
    return catalogMatch[1];
  }

  const requiredMatch = message.match(/Campo obligatorio vacio: ([^.]+)\./iu);

  if (requiredMatch) {
    return requiredMatch[1];
  }

  return '';
}

function resolveErrorRawValue(message: string, row: ImportRow) {
  const catalogMatch = message.match(/catalogo ([^:]+): (.+)\./iu);

  if (catalogMatch) {
    return catalogMatch[2];
  }

  const requiredMatch = message.match(/Campo obligatorio vacio: ([^.]+)\./iu);

  if (requiredMatch) {
    return String(row.normalized[requiredMatch[1] as keyof NormalizedExcelImportRecord] ?? '');
  }

  return '';
}

function resolveErrorType(message: string) {
  if (message.includes('duplicad') || message.includes('ya existe')) {
    return 'DUPLICATE';
  }

  if (message.includes('catalogo')) {
    return 'CATALOG';
  }

  return 'VALIDATION';
}

function detectSection(values: Record<string, string>, row: string[]) {
  const civ = normalizeText(values.CIV);
  const brand = normalizeText(values.MARCA);
  const serialNumber = normalizeText(values['NO. DE SERIE']);
  const joined = row.map(normalizeText).filter(Boolean).join(' ');

  if (!civ && !brand && !serialNumber && joined.length > 0) {
    return normalizeCatalogValue(joined);
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

function isImportableVehicleRow(record: NormalizedExcelImportRecord) {
  return Boolean(
    record.type ||
      record.vehicleClass ||
      record.serialNumber ||
      record.patrolNumber ||
      record.engineNumber !== 'SIN NUMERO',
  );
}

function isStrongPlateValue(value: string) {
  const normalized = normalizeCatalogValue(value);

  if (!normalized) {
    return false;
  }

  if (/^\d{1,4}$/u.test(normalized)) {
    return false;
  }

  return normalized.length >= 5;
}

function isStrongCivValue(value: string) {
  return /^ML\d{4,}$/u.test(normalizeCatalogValue(value));
}

function countValues(values: string[]) {
  const result = new Map<string, number>();

  for (const value of values) {
    result.set(value, (result.get(value) ?? 0) + 1);
  }

  return result;
}

function normalizeHeader(value: string) {
  return normalizeCatalogValue(value)
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
