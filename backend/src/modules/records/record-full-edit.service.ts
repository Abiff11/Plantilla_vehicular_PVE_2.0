import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role } from 'src/common/enums/role.enum';
import { AuditLogsService } from 'src/modules/audit-logs/audit-logs.service';
import { VehicleFormCatalogService } from 'src/modules/catalog/vehicle-form-catalog.service';
import { RealtimeGateway } from 'src/modules/realtime/realtime.gateway';
import { UpdateRecordDto } from './dto/update-record.dto';
import { RecordEntity } from './entities/record.entity';

type AuthUser = {
  sub: string;
  role: Role;
  regionId: string | null;
  delegationId: string | null;
};

const editableRecordFields = [
  'civ',
  'previousPlates',
  'plates2024',
  'plates2025',
  'plates2026',
  'plates',
  'brand',
  'type',
  'useType',
  'vehicleClass',
  'model',
  'cylinders',
  'fuelCapacityLiters',
  'engineNumber',
  'serialNumber',
  'regionName',
  'delegationName',
  'adscription',
  'custodian',
  'patrolNumber',
  'color',
  'physicalStatus',
  'status',
  'rawCirculationStatus',
  'assetClassification',
  'rawAssetClassification',
  'observation',
  'realLocation',
  'sourceSection',
  'sourceRowNumber',
] as const;

type EditableRecordField = (typeof editableRecordFields)[number];
type EditableRecordValues = Pick<RecordEntity, EditableRecordField>;

const NO_PLATE_VALUES = new Set([
  '',
  '-',
  'N/A',
  'NA',
  'S/P',
  'SP',
  'SINPLACA',
  'SINPLACAS',
]);

const GENERIC_IDENTIFIER_VALUES = new Set([
  'SINNUMERO',
  'SINMOTOR',
  'SINSERIE',
  'SN',
  'SM',
  'IMPORTADO',
  'HECHOENMEXICO',
  'HECHOENUSA',
  'HECHOENEUA',
]);

@Injectable()
export class RecordFullEditService {
  constructor(
    @InjectRepository(RecordEntity)
    private readonly recordRepository: Repository<RecordEntity>,
    private readonly auditLogsService: AuditLogsService,
    private readonly realtimeGateway: RealtimeGateway,
    private readonly vehicleFormCatalogService: VehicleFormCatalogService,
  ) {}

  async update(id: string, dto: UpdateRecordDto, authUser: AuthUser) {
    const record = await this.findOne(id);
    this.ensureRecordEditAccess(record, authUser);

    const before = this.pickRecordValues(record);
    const mergedValues = this.mergeDefinedRecordValues(before, dto);
    const normalizedValues = this.normalizeRecordValues(mergedValues);
    normalizedValues.plates = this.resolveMainPlate(normalizedValues);

    const changedFields = editableRecordFields.filter(
      (fieldName) => before[fieldName] !== normalizedValues[fieldName],
    );

    if (changedFields.length === 0) {
      return record;
    }

    const catalogError = await this.vehicleFormCatalogService.validateValues(
      { ...normalizedValues },
      changedFields,
    );

    if (catalogError) {
      throw new BadRequestException(catalogError);
    }

    await this.ensureNoDuplicateRecords(normalizedValues, id);
    await this.recordRepository.update(id, normalizedValues);
    const updatedRecord = await this.findOne(id);

    await this.auditLogsService.register({
      actorId: authUser.sub,
      action: 'RECORD_UPDATED',
      entityType: 'record',
      entityId: id,
      metadata: {
        delegationId: record.delegation.id,
        regionId: record.delegation.region.id,
        changedFields,
        before: Object.fromEntries(
          changedFields.map((fieldName) => [fieldName, before[fieldName]]),
        ),
        after: Object.fromEntries(
          changedFields.map((fieldName) => [fieldName, normalizedValues[fieldName]]),
        ),
      },
    });

    this.realtimeGateway.emitRecordChanged(updatedRecord);

    return updatedRecord;
  }

  private async findOne(id: string) {
    const record = await this.recordRepository.findOne({
      where: { id },
      relations: {
        delegation: {
          region: true,
        },
        createdBy: true,
        photos: {
          uploadedBy: true,
        },
      },
    });

    if (!record) {
      throw new NotFoundException('No se encontro la captura vehicular.');
    }

    return record;
  }

  private ensureRecordEditAccess(record: RecordEntity, authUser: AuthUser) {
    if (authUser.role !== Role.Enlace) {
      return;
    }

    if (record.delegation.id !== authUser.delegationId) {
      throw new ForbiddenException(
        'El enlace solo puede editar capturas de su delegacion.',
      );
    }
  }

  private async ensureNoDuplicateRecords(
    values: EditableRecordValues,
    excludeId?: string,
  ) {
    const uniqueFields = ['plates', 'engineNumber', 'serialNumber'] as const;
    const conflicts: string[] = [];

    for (const field of uniqueFields) {
      const fieldValue = values[field];

      if (!fieldValue || String(fieldValue).trim().length === 0) {
        continue;
      }

      if (
        (field === 'engineNumber' || field === 'serialNumber') &&
        isGenericIdentifierValue(fieldValue)
      ) {
        continue;
      }

      const query = this.recordRepository
        .createQueryBuilder('record')
        .where(`record.${field} = :value`, { value: fieldValue })
        .andWhere('record.deletedAt IS NULL');

      if (excludeId) {
        query.andWhere('record.id != :excludeId', { excludeId });
      }

      const existing = await query.getOne();

      if (existing) {
        const fieldLabel =
          field === 'plates'
            ? 'Las placas'
            : field === 'engineNumber'
              ? 'El numero de motor'
              : 'El numero de serie';
        conflicts.push(
          `${fieldLabel} '${fieldValue}' ya esta en uso en una captura activa.`,
        );
      }
    }

    if (conflicts.length > 0) {
      throw new ConflictException(conflicts.join(' '));
    }
  }

  private pickRecordValues(record: RecordEntity): EditableRecordValues {
    return {
      civ: record.civ,
      previousPlates: record.previousPlates,
      plates2024: record.plates2024,
      plates2025: record.plates2025,
      plates2026: record.plates2026,
      plates: record.plates,
      brand: record.brand,
      type: record.type,
      useType: record.useType,
      vehicleClass: record.vehicleClass,
      model: record.model,
      cylinders: record.cylinders,
      fuelCapacityLiters: record.fuelCapacityLiters,
      engineNumber: record.engineNumber,
      serialNumber: record.serialNumber,
      regionName: record.regionName,
      delegationName: record.delegationName,
      adscription: record.adscription,
      custodian: record.custodian,
      patrolNumber: record.patrolNumber,
      color: record.color,
      physicalStatus: record.physicalStatus,
      status: record.status,
      rawCirculationStatus: record.rawCirculationStatus,
      assetClassification: record.assetClassification,
      rawAssetClassification: record.rawAssetClassification,
      observation: record.observation,
      realLocation: record.realLocation,
      sourceSection: record.sourceSection,
      sourceRowNumber: record.sourceRowNumber,
    };
  }

  private mergeDefinedRecordValues(
    currentValues: EditableRecordValues,
    dto: UpdateRecordDto,
  ): EditableRecordValues {
    const mergedValues: EditableRecordValues = { ...currentValues };

    for (const fieldName of editableRecordFields) {
      const nextValue = dto[fieldName];

      if (nextValue !== undefined) {
        mergedValues[fieldName] = nextValue as never;
      }
    }

    return mergedValues;
  }

  private normalizeRecordValues(values: EditableRecordValues): EditableRecordValues {
    return {
      civ: normalizeCode(values.civ),
      previousPlates: normalizePlateSourceValue(values.previousPlates),
      plates2024: normalizePlateSourceValue(values.plates2024),
      plates2025: normalizePlateSourceValue(values.plates2025),
      plates2026: normalizePlateSourceValue(values.plates2026),
      plates: normalizePlateSourceValue(values.plates),
      brand: normalizeCatalogText(values.brand),
      type: normalizeCatalogText(values.type),
      useType: normalizeCatalogText(values.useType),
      vehicleClass: normalizeCatalogText(values.vehicleClass),
      model: normalizeText(values.model).toUpperCase().replace(/\.0$/u, ''),
      cylinders: normalizeText(values.cylinders).toUpperCase().replace(/,/gu, '.').replace(/\.0+$/u, ''),
      fuelCapacityLiters: normalizeText(values.fuelCapacityLiters).toUpperCase().replace(/,/gu, '.').replace(/\.0+$/u, ''),
      engineNumber: normalizeCode(values.engineNumber),
      serialNumber: normalizeCode(values.serialNumber),
      regionName: normalizeCatalogText(values.regionName),
      delegationName: normalizeCatalogText(values.delegationName),
      adscription: normalizeCatalogText(values.adscription),
      custodian: normalizeText(values.custodian).toUpperCase(),
      patrolNumber: normalizeCode(values.patrolNumber),
      color: normalizeCatalogText(values.color),
      physicalStatus: normalizeCatalogText(values.physicalStatus),
      status: normalizeCatalogText(values.status),
      rawCirculationStatus: normalizeCatalogText(values.rawCirculationStatus),
      assetClassification: normalizeCatalogText(values.assetClassification),
      rawAssetClassification: normalizeCatalogText(values.rawAssetClassification),
      observation: normalizeText(values.observation),
      realLocation: normalizeCatalogText(values.realLocation),
      sourceSection: normalizeCatalogText(values.sourceSection),
      sourceRowNumber: values.sourceRowNumber ?? null,
    };
  }

  private resolveMainPlate(values: EditableRecordValues) {
    return (
      values.plates2026 ||
      values.plates2025 ||
      values.plates2024 ||
      values.previousPlates ||
      values.plates ||
      ''
    );
  }
}

function normalizeText(value: unknown) {
  return String(value ?? '').trim().replace(/\s+/gu, ' ');
}

function normalizeCatalogText(value: unknown) {
  return normalizeText(value)
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '')
    .replace(/\s+/gu, ' ')
    .trim();
}

function normalizeCode(value: unknown) {
  return normalizeCatalogText(value).replace(/\s+/gu, '');
}

function normalizePlateSourceValue(value: unknown) {
  const normalized = normalizeCode(value);

  if (NO_PLATE_VALUES.has(normalized)) {
    return '';
  }

  if (!normalized || /^\d+$/u.test(normalized) || !/[A-Z]/u.test(normalized) || normalized.length < 5) {
    return '';
  }

  return normalized;
}

function isGenericIdentifierValue(value: unknown) {
  const normalized = normalizeCode(value).replace(/[\s.-]+/gu, '');
  return GENERIC_IDENTIFIER_VALUES.has(normalized);
}
