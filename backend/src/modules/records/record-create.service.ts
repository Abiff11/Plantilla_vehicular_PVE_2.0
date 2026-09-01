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
import { RECORD_FIELD_CATALOG } from 'src/modules/catalog/record-field-catalog';
import { DelegationEntity } from 'src/modules/catalog/entities/delegation.entity';
import { RealtimeGateway } from 'src/modules/realtime/realtime.gateway';
import { UserEntity } from 'src/modules/users/entities/user.entity';
import { StorageService } from '../storage/storage.service';
import { CreateRecordDto } from './dto/create-record.dto';
import { RecordEntity } from './entities/record.entity';
import { VehiclePhotoEntity } from './entities/vehicle-photo.entity';
import { RecordsService } from './records.service';

type AuthUser = {
  sub: string;
  role: Role;
  regionId: string | null;
  delegationId: string | null;
};

type UploadedFile = {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
};

type NormalizedCreateValues = Pick<
  RecordEntity,
  | 'civ'
  | 'previousPlates'
  | 'plates2024'
  | 'plates2025'
  | 'plates2026'
  | 'plates'
  | 'brand'
  | 'type'
  | 'useType'
  | 'vehicleClass'
  | 'model'
  | 'cylinders'
  | 'fuelCapacityLiters'
  | 'engineNumber'
  | 'serialNumber'
  | 'regionName'
  | 'delegationName'
  | 'adscription'
  | 'custodian'
  | 'patrolNumber'
  | 'color'
  | 'physicalStatus'
  | 'status'
  | 'rawCirculationStatus'
  | 'assetClassification'
  | 'rawAssetClassification'
  | 'observation'
  | 'realLocation'
  | 'sourceSection'
  | 'sourceRowNumber'
>;

const catalogValidatedFields = [
  'useType',
  'vehicleClass',
  'physicalStatus',
  'status',
  'assetClassification',
] as const;

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
export class RecordCreateService {
  constructor(
    @InjectRepository(RecordEntity)
    private readonly recordRepository: Repository<RecordEntity>,
    @InjectRepository(DelegationEntity)
    private readonly delegationRepository: Repository<DelegationEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    @InjectRepository(VehiclePhotoEntity)
    private readonly vehiclePhotoRepository: Repository<VehiclePhotoEntity>,
    private readonly auditLogsService: AuditLogsService,
    private readonly realtimeGateway: RealtimeGateway,
    private readonly storageService: StorageService,
    private readonly recordsService: RecordsService,
  ) {}

  async create(dto: CreateRecordDto, authUser: AuthUser, photos?: UploadedFile[]) {
    const createdBy = await this.userRepository.findOne({
      where: { id: authUser.sub },
      relations: {
        region: true,
        delegation: {
          region: true,
        },
      },
    });
    const delegation = await this.delegationRepository.findOne({
      where: { id: dto.delegationId },
      relations: { region: true },
    });

    if (!createdBy || !delegation) {
      throw new NotFoundException('No se encontro el usuario o la delegacion.');
    }

    if (createdBy.role === Role.Enlace && createdBy.delegation?.id !== delegation.id) {
      throw new ForbiddenException('El enlace solo puede usar su delegacion asignada.');
    }

    const normalizedValues = this.normalizeCreateValues(
      dto,
      delegation.region.name,
      delegation.name,
    );

    const catalogError = this.validateCatalogFields(normalizedValues);
    if (catalogError) {
      throw new BadRequestException(catalogError);
    }

    await this.ensureNoDuplicateRecords(normalizedValues);

    const record = await this.recordRepository.save(
      this.recordRepository.create({
        ...normalizedValues,
        delegation,
        createdBy,
      }),
    );

    if (photos?.length) {
      const storedPhotos = await Promise.all(
        photos.map((photo) =>
          this.storageService.saveFile({
            folder: 'vehicle-photos',
            file: {
              originalname: photo.originalname,
              mimetype: photo.mimetype,
              buffer: photo.buffer,
              size: photo.size,
            },
          }),
        ),
      );

      await this.vehiclePhotoRepository.save(
        storedPhotos.map((storedPhoto) =>
          this.vehiclePhotoRepository.create({
            fileName: storedPhoto.originalName,
            filePath: storedPhoto.fileName,
            objectKey: storedPhoto.objectKey,
            publicUrl: storedPhoto.publicUrl,
            mimeType: storedPhoto.mimeType,
            size: storedPhoto.size,
            storageProvider: storedPhoto.storageProvider,
            record,
            uploadedBy: createdBy,
          }),
        ),
      );
    }

    const hydratedRecord = await this.recordsService.findOne(record.id);

    await this.auditLogsService.register({
      actorId: authUser.sub,
      action: 'RECORD_CREATED',
      entityType: 'record',
      entityId: record.id,
      metadata: {
        delegationId: delegation.id,
        regionId: delegation.region.id,
      },
    });

    this.realtimeGateway.emitRecordCreated(hydratedRecord);
    return hydratedRecord;
  }

  private normalizeCreateValues(
    dto: CreateRecordDto,
    regionName: string,
    delegationName: string,
  ): NormalizedCreateValues {
    const plateFields = {
      previousPlates: normalizePlateSourceValue(dto.previousPlates),
      plates2024: normalizePlateSourceValue(dto.plates2024),
      plates2025: normalizePlateSourceValue(dto.plates2025),
      plates2026: normalizePlateSourceValue(dto.plates2026),
      plates: normalizePlateSourceValue(dto.plates),
    };

    return {
      civ: normalizeCode(dto.civ),
      ...plateFields,
      plates: resolveMainPlate(plateFields),
      brand: normalizeCatalogText(dto.brand),
      type: normalizeCatalogText(dto.type),
      useType: normalizeCatalogText(dto.useType),
      vehicleClass: normalizeCatalogText(dto.vehicleClass),
      model: normalizeText(dto.model).toUpperCase().replace(/\.0$/u, ''),
      cylinders: normalizeText(dto.cylinders).toUpperCase().replace(/,/gu, '.').replace(/\.0+$/u, ''),
      fuelCapacityLiters: normalizeText(dto.fuelCapacityLiters)
        .toUpperCase()
        .replace(/,/gu, '.')
        .replace(/\.0+$/u, ''),
      engineNumber: normalizeCode(dto.engineNumber),
      serialNumber: normalizeCode(dto.serialNumber),
      regionName: normalizeCatalogText(regionName),
      delegationName: normalizeCatalogText(delegationName),
      adscription: normalizeCatalogText(dto.adscription),
      custodian: normalizeText(dto.custodian).toUpperCase(),
      patrolNumber: normalizeCode(dto.patrolNumber),
      color: normalizeCatalogText(dto.color),
      physicalStatus: normalizeCatalogText(dto.physicalStatus),
      status: normalizeCatalogText(dto.status),
      rawCirculationStatus: normalizeCatalogText(dto.rawCirculationStatus),
      assetClassification: normalizeCatalogText(dto.assetClassification),
      rawAssetClassification: normalizeCatalogText(dto.rawAssetClassification),
      observation: normalizeText(dto.observation),
      realLocation: normalizeCatalogText(dto.realLocation),
      sourceSection: normalizeCatalogText(dto.sourceSection),
      sourceRowNumber: dto.sourceRowNumber ?? null,
    };
  }

  private validateCatalogFields(values: NormalizedCreateValues) {
    for (const field of catalogValidatedFields) {
      const value = values[field];
      if (!value || value.trim().length === 0) {
        continue;
      }

      const catalogEntry = RECORD_FIELD_CATALOG[field];
      const validValues: string[] = catalogEntry.options.map((option) => option.value);

      if (!validValues.includes(value) && !catalogEntry.allowsCustom) {
        return `${catalogEntry.label}: '${value}' no es una opcion valida. Valores permitidos: ${validValues.join(', ')}.`;
      }
    }

    return null;
  }

  private async ensureNoDuplicateRecords(values: NormalizedCreateValues) {
    const uniqueFields = ['plates', 'civ', 'engineNumber', 'serialNumber'] as const;
    const conflicts: string[] = [];

    for (const field of uniqueFields) {
      const fieldValue = values[field];
      if (!fieldValue) {
        continue;
      }

      if (
        (field === 'engineNumber' || field === 'serialNumber') &&
        isGenericIdentifierValue(fieldValue)
      ) {
        continue;
      }

      const existing = await this.recordRepository
        .createQueryBuilder('record')
        .where(`record.${field} = :value`, { value: fieldValue })
        .andWhere('record.deletedAt IS NULL')
        .getOne();

      if (existing) {
        const fieldLabel =
          field === 'plates'
            ? 'Las placas'
            : field === 'civ'
              ? 'El CIV'
              : field === 'engineNumber'
                ? 'El numero de motor'
                : 'El numero de serie';
        conflicts.push(`${fieldLabel} '${fieldValue}' ya esta en uso en una captura activa.`);
      }
    }

    if (conflicts.length > 0) {
      throw new ConflictException(conflicts.join(' '));
    }
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

function resolveMainPlate(values: {
  previousPlates: string;
  plates2024: string;
  plates2025: string;
  plates2026: string;
  plates: string;
}) {
  return (
    values.plates2026 ||
    values.plates2025 ||
    values.plates2024 ||
    values.previousPlates ||
    values.plates ||
    ''
  );
}

function isGenericIdentifierValue(value: unknown) {
  const normalized = normalizeCode(value).replace(/[\s.-]+/gu, '');
  return GENERIC_IDENTIFIER_VALUES.has(normalized);
}
