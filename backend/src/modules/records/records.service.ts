import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import { InjectRepository } from "@nestjs/typeorm";
import { Brackets, In, Repository } from "typeorm";
import { Role } from "src/common/enums/role.enum";
import { AuditLogsService } from "src/modules/audit-logs/audit-logs.service";
import { AuditLogEntity } from "src/modules/audit-logs/entities/audit-log.entity";
import { RECORD_FIELD_CATALOG } from "src/modules/catalog/record-field-catalog";
import { DelegationEntity } from "src/modules/catalog/entities/delegation.entity";
import { RegionEntity } from "src/modules/catalog/entities/region.entity";
import { RealtimeGateway } from "src/modules/realtime/realtime.gateway";
import { UserEntity } from "src/modules/users/entities/user.entity";
import { CreateRecordDto } from "./dto/create-record.dto";
import { SubmitRosterReportDto } from "./dto/submit-roster-report.dto";
import { TransferRecordDto } from "./dto/transfer-record.dto";
import { UpdateRecordDto } from "./dto/update-record.dto";
import { RecordEntity } from "./entities/record.entity";
import {
  VehicleRosterReportEntity,
  type VehicleRosterReportScope,
} from "./entities/vehicle-roster-report.entity";
import { VehiclePhotoEntity } from "./entities/vehicle-photo.entity";
import { VehicleTransferEntity } from "./entities/vehicle-transfer.entity";
import { StorageService } from "../storage/storage.service";

type UploadedFile = {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
};

const catalogValidatedFields = [
  "useType",
  "vehicleClass",
  "physicalStatus",
  "status",
  "assetClassification",
] as const;
type CatalogValidatedField = (typeof catalogValidatedFields)[number];
type CatalogValidatedValues = Pick<
  EditableRecordValues,
  CatalogValidatedField
>;
type DuplicateCheckValues = Pick<
  EditableRecordValues,
  "plates" | "engineNumber" | "serialNumber"
> & {
  civ?: string;
};

function validateCatalogFields(values: CatalogValidatedValues): string | null {
  for (const field of catalogValidatedFields) {
    const value = values[field];

    if (!value || value.trim().length === 0) {
      continue;
    }

    const catalogEntry = RECORD_FIELD_CATALOG[field];
    const validValues = catalogEntry.options.map(
      (opt: { value: string }) => opt.value,
    );

    if (!validValues.includes(value)) {
      if (catalogEntry.allowsCustom) {
        continue;
      }

      const fieldLabel = catalogEntry.label;
      return `${fieldLabel}: '${value}' no es una opcion valida. Valores permitidos: ${validValues.join(", ")}.`;
    }
  }

  return null;
}

function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeUpper(value: string) {
  return normalizeText(value).toUpperCase();
}

function stripDiacritics(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/gu, "").trim();
}

function normalizePlateSourceValue(value: string) {
  const normalized = stripDiacritics(normalizeUpper(value));

  if (!normalized || ["", "-", "N/A", "NA", "S/P", "SP", "SINPLACA", "SINPLACAS"].includes(normalized)) {
    return "";
  }

  const compacted = normalized.replace(/[\s-]+/gu, "");

  if (!compacted || /^\d+$/u.test(compacted) || !/[A-Z]/u.test(compacted) || compacted.length < 5) {
    return "";
  }

  return compacted;
}

function resolveMainPlates(values: {
  plates: string;
  previousPlates: string;
  plates2024: string;
  plates2025: string;
  plates2026: string;
}) {
  return (
    normalizePlateSourceValue(values.plates2026) ||
    normalizePlateSourceValue(values.plates2025) ||
    normalizePlateSourceValue(values.plates2024) ||
    normalizePlateSourceValue(values.previousPlates) ||
    normalizePlateSourceValue(values.plates)
  );
}

function calculateNetActive(
  totalUnits: number,
  statusBreakdown: Record<string, number>,
) {
  return Math.max(
    totalUnits -
      (statusBreakdown.INCATIVO ?? 0) -
      (statusBreakdown.SINIESTRADO ?? 0) -
      (statusBreakdown["PARA BAJA"] ?? 0) -
      (statusBreakdown["OTRO"] ?? 0),
    0,
  );
}

type AuthUser = {
  sub: string;
  role: Role;
  regionId: string | null;
  delegationId: string | null;
};
type LiveAuthUser = {
  sub: string;
  role: Role;
  regionId: string | null;
  delegationId: string | null;
};

const reportableMovementActions = [
  "RECORD_CREATED",
  "RECORD_UPDATED",
  "RECORD_SOFT_DELETED",
  "RECORD_TRANSFERRED",
];

const editableRecordFields = [
  "plates",
  "civ",
  "previousPlates",
  "plates2024",
  "plates2025",
  "plates2026",
  "brand",
  "type",
  "useType",
  "vehicleClass",
  "model",
  "cylinders",
  "fuelCapacityLiters",
  "engineNumber",
  "serialNumber",
  "custodian",
  "patrolNumber",
  "color",
  "adscription",
  "realLocation",
  "physicalStatus",
  "status",
  "rawCirculationStatus",
  "assetClassification",
  "rawAssetClassification",
  "sourceSection",
  "sourceRowNumber",
  "observation",
] as const;

type EditableRecordField = (typeof editableRecordFields)[number];
type EditableRecordValues = Pick<RecordEntity, EditableRecordField>;
type BaseRecordValues = Pick<
  RecordEntity,
  | "plates"
  | "brand"
  | "type"
  | "useType"
  | "vehicleClass"
  | "model"
  | "engineNumber"
  | "serialNumber"
  | "custodian"
  | "patrolNumber"
  | "physicalStatus"
  | "status"
  | "assetClassification"
  | "observation"
> & {
  rawAssetClassification?: string;
};
type ScopedRecordFilters = {
  scopeDelegationIds: string[];
  dateFrom?: string;
  dateTo?: string;
};
type ViewDelegation = {
  id: string;
  name: string;
  sortOrder: number;
  region: {
    id: string;
    name: string;
    sortOrder: number;
  };
};
type RecordTransferView = {
  id: string;
  movedAt: string;
  reason: string;
  fromDelegation: ViewDelegation;
  toDelegation: ViewDelegation;
  movedBy: UserEntity;
};
type RecordEditView = {
  id: string;
  editedAt: string;
  changedFields: string[];
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  actor: UserEntity | null;
};
type RecordView = RecordEntity & {
  viewDelegation: ViewDelegation;
  recordState: "CURRENT" | "TRANSFERRED_OUT";
  latestTransfer: RecordTransferView | null;
  latestEdit: RecordEditView | null;
  transferHistory: RecordTransferView[];
  editHistory: RecordEditView[];
};
type DelegationReportOverviewRow = {
  delegationId: string;
  delegationName: string;
  regionId: string;
  regionName: string;
  status:
    | "NOT_REPORTED"
    | "PENDING_CHANGES"
    | "REPORTED_WITH_CHANGES"
    | "REPORTED_WITHOUT_CHANGES";
  pendingChanges: number;
  lastReport: VehicleRosterReportEntity | null;
};
type RegionReportOverviewRow = {
  regionId: string;
  regionName: string;
  status:
    | "NOT_REPORTED"
    | "PENDING_CHANGES"
    | "REPORTED_WITH_CHANGES"
    | "REPORTED_WITHOUT_CHANGES";
  totalDelegations: number;
  confirmedDelegationReports: number;
  pendingDelegationReports: number;
  lastReport: VehicleRosterReportEntity | null;
};

@Injectable()
export class RecordsService {
  constructor(
    @InjectRepository(RecordEntity)
    private readonly recordRepository: Repository<RecordEntity>,
    @InjectRepository(AuditLogEntity)
    private readonly auditLogRepository: Repository<AuditLogEntity>,
    @InjectRepository(DelegationEntity)
    private readonly delegationRepository: Repository<DelegationEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    @InjectRepository(VehicleRosterReportEntity)
    private readonly rosterReportRepository: Repository<VehicleRosterReportEntity>,
    @InjectRepository(VehicleTransferEntity)
    private readonly vehicleTransferRepository: Repository<VehicleTransferEntity>,
    @InjectRepository(VehiclePhotoEntity)
    private readonly vehiclePhotoRepository: Repository<VehiclePhotoEntity>,
    private readonly auditLogsService: AuditLogsService,
    private readonly realtimeGateway: RealtimeGateway,
    private readonly storageService: StorageService,
  ) {}

  async create(
    dto: CreateRecordDto,
    authUser: AuthUser,
    photos?: UploadedFile[],
  ) {
    const liveAuthUser = await this.resolveLiveAuthUser(authUser);
    const createdBy = await this.userRepository.findOneBy({ id: authUser.sub });
    const delegation = await this.delegationRepository.findOne({
      where: { id: dto.delegationId },
      relations: { region: true },
    });

    if (!createdBy || !delegation) {
      throw new NotFoundException("No se encontro el usuario o la delegacion.");
    }

    this.ensureEnlaceDelegationAccess(liveAuthUser, delegation.id);

    const normalizedDto = {
      ...this.normalizeBaseRecordValues(dto),
      delegationId: dto.delegationId,
    };

    const catalogError = validateCatalogFields(normalizedDto);

    if (catalogError) {
      throw new BadRequestException(catalogError);
    }

    await this.ensureNoDuplicateRecords(normalizedDto);

    const record = await this.recordRepository.save(
      this.recordRepository.create({
        ...normalizedDto,
        delegation,
        createdBy,
      }),
    );

    if (photos && photos.length > 0) {
      const storedPhotos = await Promise.all(
        photos.map((photo) =>
          this.storageService.saveFile({
            folder: "vehicle-photos",
            file: {
              originalname: photo.originalname,
              mimetype: photo.mimetype,
              buffer: photo.buffer,
              size: photo.size,
            },
          }),
        ),
      );

      const photoEntities = storedPhotos.map((storedPhoto) =>
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
      );

      await this.vehiclePhotoRepository.save(photoEntities);
    }

    const hydratedRecord = await this.findOne(record.id);

    await this.auditLogsService.register({
      actorId: authUser.sub,
      action: "RECORD_CREATED",
      entityType: "record",
      entityId: record.id,
      metadata: {
        delegationId: delegation.id,
        regionId: delegation.region.id,
      },
    });

    this.realtimeGateway.emitRecordCreated(hydratedRecord);

    return hydratedRecord;
  }

  async update(id: string, dto: UpdateRecordDto, authUser: AuthUser) {
    const liveAuthUser = await this.resolveLiveAuthUser(authUser);
    const record = await this.findOne(id);
    this.ensureRecordEditAccess(record, liveAuthUser);

    const before = this.pickRecordValues(record);
    const normalizedValues = this.normalizeEditableRecordValues(
      this.mergeDefinedRecordValues(before, dto),
    );
    const changedFields = editableRecordFields.filter(
      (fieldName) => before[fieldName] !== normalizedValues[fieldName],
    );

    if (changedFields.length === 0) {
      return record;
    }

    const catalogError = validateCatalogFields(normalizedValues);

    if (catalogError) {
      throw new BadRequestException(catalogError);
    }

    await this.ensureNoDuplicateRecords(normalizedValues, id);

    await this.recordRepository.update(id, normalizedValues);
    const updatedRecord = await this.findOne(id);

    await this.auditLogsService.register({
      actorId: authUser.sub,
      action: "RECORD_UPDATED",
      entityType: "record",
      entityId: id,
      metadata: {
        delegationId: record.delegation.id,
        regionId: record.delegation.region.id,
        changedFields,
        before: Object.fromEntries(
          changedFields.map((fieldName) => [fieldName, before[fieldName]]),
        ),
        after: Object.fromEntries(
          changedFields.map((fieldName) => [
            fieldName,
            normalizedValues[fieldName],
          ]),
        ),
      },
    });

    this.realtimeGateway.emitRecordChanged(updatedRecord);

    return updatedRecord;
  }

  async transfer(id: string, dto: TransferRecordDto, authUser: AuthUser) {
    const liveAuthUser = await this.resolveLiveAuthUser(authUser);
    const record = await this.findOne(id);
    const movedBy = await this.userRepository.findOneBy({ id: authUser.sub });
    const toDelegation = await this.delegationRepository.findOne({
      where: { id: dto.delegationId },
      relations: { region: true },
    });

    if (!movedBy || !toDelegation) {
      throw new NotFoundException(
        "No se encontro el usuario o la delegacion de destino.",
      );
    }

    this.ensureRecordTransferAccess(record, toDelegation, liveAuthUser);

    if (record.delegation.id === toDelegation.id) {
      throw new BadRequestException(
        "La delegacion de destino debe ser diferente.",
      );
    }

    const fromDelegation = record.delegation;
    const movedAt = new Date();

    await this.vehicleTransferRepository.save(
      this.vehicleTransferRepository.create({
        record,
        fromDelegation,
        toDelegation,
        movedBy,
        movedAt,
        reason: normalizeText(dto.reason),
      }),
    );

    record.delegation = toDelegation;
    await this.recordRepository.save(record);
    const updatedRecord = await this.findOne(id);

    await this.auditLogsService.register({
      actorId: authUser.sub,
      action: "RECORD_TRANSFERRED",
      entityType: "record",
      entityId: id,
      metadata: {
        delegationId: toDelegation.id,
        fromDelegationId: fromDelegation.id,
        fromRegionId: fromDelegation.region.id,
        toDelegationId: toDelegation.id,
        toRegionId: toDelegation.region.id,
        reason: normalizeText(dto.reason),
      },
    });

    this.realtimeGateway.emitRecordChanged(updatedRecord);

    return updatedRecord;
  }

  async submitRosterReport(dto: SubmitRosterReportDto, authUser: AuthUser) {
    const liveAuthUser = await this.resolveLiveAuthUser(authUser);

    if (!liveAuthUser.delegationId) {
      throw new ForbiddenException(
        "El usuario no tiene una delegacion asignada.",
      );
    }

    const submittedBy = await this.userRepository.findOneBy({
      id: authUser.sub,
    });
    const delegation = await this.delegationRepository.findOne({
      where: { id: liveAuthUser.delegationId },
      relations: { region: true },
    });

    if (!submittedBy || !delegation) {
      throw new NotFoundException("No se encontro el usuario o la delegacion.");
    }

    const lastReport = await this.findLastRosterReportByDelegation(
      delegation.id,
    );
    const changesSinceLastReport = await this.countDelegationMovementsSince(
      delegation.id,
      lastReport?.submittedAt ?? null,
    );
    const report = await this.rosterReportRepository.save(
      this.rosterReportRepository.create({
        reportScope: "DELEGATION",
        delegation,
        region: delegation.region,
        submittedBy,
        hasChanges: changesSinceLastReport > 0,
        changesSinceLastReport,
        confirmedDelegationReports: 0,
        notes: normalizeText(dto.notes ?? ""),
        submittedAt: new Date(),
      }),
    );

    await this.auditLogsService.register({
      actorId: authUser.sub,
      action:
        changesSinceLastReport > 0
          ? "DELEGATION_ROSTER_REPORT_SUBMITTED_WITH_CHANGES"
          : "DELEGATION_ROSTER_REPORT_SUBMITTED_WITHOUT_CHANGES",
      entityType: "vehicle_roster_report",
      entityId: report.id,
      metadata: {
        delegationId: delegation.id,
        regionId: delegation.region.id,
        changesSinceLastReport,
        reportScope: "DELEGATION",
      },
    });

    const hydratedReport = await this.findRosterReport(report.id);
    this.realtimeGateway.emitRosterReportSubmitted(hydratedReport);

    return hydratedReport;
  }

  async submitRegionalRosterReport(
    dto: SubmitRosterReportDto,
    authUser: AuthUser,
  ) {
    if (!dto.regionId) {
      throw new BadRequestException(
        "Se requiere regionId para confirmar el cierre mensual por región.",
      );
    }

    const submittedBy = await this.userRepository.findOne({
      where: { id: authUser.sub },
      relations: { region: true },
    });
    const region = await this.delegationRepository.manager.findOne(
      RegionEntity,
      {
        where: { id: dto.regionId },
      },
    );

    if (!submittedBy || !region) {
      throw new NotFoundException("No se encontro el usuario o la region.");
    }

    const lastReport = await this.findLastRosterReportByRegion(
      region.id,
      "REGION",
    );
    const delegationProgress = await this.getRegionalDelegationProgress(
      region.id,
      lastReport?.submittedAt ?? null,
    );

    if (delegationProgress.pendingDelegationReports > 0) {
      throw new BadRequestException({
        message: `No se puede confirmar el cierre mensual regional porque aún hay ${delegationProgress.pendingDelegationReports} delegaciones pendientes de confirmar.`,
        totalDelegations: delegationProgress.totalDelegations,
        confirmedDelegationReports:
          delegationProgress.confirmedDelegationReports,
        pendingDelegationReports: delegationProgress.pendingDelegationReports,
      });
    }

    const confirmedDelegationReports = delegationProgress.confirmedDelegationReports;
    const report = await this.rosterReportRepository.save(
      this.rosterReportRepository.create({
        reportScope: "REGION",
        delegation: null,
        region,
        submittedBy,
        hasChanges: confirmedDelegationReports > 0,
        changesSinceLastReport: confirmedDelegationReports,
        confirmedDelegationReports,
        notes: normalizeText(dto.notes ?? ""),
        submittedAt: new Date(),
      }),
    );

    await this.auditLogsService.register({
      actorId: authUser.sub,
      action:
        confirmedDelegationReports > 0
          ? "REGION_ROSTER_REPORT_SUBMITTED_WITH_CHANGES"
          : "REGION_ROSTER_REPORT_SUBMITTED_WITHOUT_CHANGES",
      entityType: "vehicle_roster_report",
      entityId: report.id,
      metadata: {
        regionId: region.id,
        confirmedDelegationReports,
        pendingDelegationReports: delegationProgress.pendingDelegationReports,
        reportScope: "REGION",
      },
    });

    const hydratedReport = await this.findRosterReport(report.id);
    this.realtimeGateway.emitRosterReportSubmitted(hydratedReport);

    return hydratedReport;
  }

  async findMyRosterReports(authUser: AuthUser) {
    const liveAuthUser = await this.resolveLiveAuthUser(authUser);

    if (!liveAuthUser.delegationId) {
      return [];
    }

    return this.rosterReportRepository.find({
      where: {
        reportScope: "DELEGATION",
        delegation: {
          id: liveAuthUser.delegationId,
        },
      },
      relations: {
        delegation: {
          region: true,
        },
        region: true,
        submittedBy: true,
      },
      order: {
        submittedAt: "DESC",
      },
      take: 20,
    });
  }

  async findMyRegionalRosterReports(authUser: AuthUser) {
    const liveAuthUser = await this.resolveLiveAuthUser(authUser);

    if (!liveAuthUser.regionId) {
      return [];
    }

    return this.rosterReportRepository.find({
      where: {
        reportScope: "REGION",
        region: {
          id: liveAuthUser.regionId,
        },
      },
      relations: {
        region: true,
        submittedBy: true,
      },
      order: {
        submittedAt: "DESC",
      },
      take: 20,
    });
  }

  async findRosterReportOverview(regionId?: string) {
    const regions = await this.findScopedRegions(regionId);
    return this.buildRegionRosterReportOverview(regions);
  }

  async findRegionalRosterReportOverview(
    authUser: AuthUser,
    delegationId?: string,
  ) {
    const liveAuthUser = await this.resolveLiveAuthUser(authUser);
    const delegations = await this.findScopedDelegations(
      liveAuthUser.regionId ?? "",
      delegationId,
    );
    return this.buildDelegationRosterReportOverview(delegations);
  }

  async findOne(id: string) {
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
      throw new NotFoundException("No se encontro la captura vehicular.");
    }

    return record;
  }

  async findMine(authUser: AuthUser) {
    const liveAuthUser = await this.resolveLiveAuthUser(authUser);

    if (!liveAuthUser.delegationId) {
      return [];
    }

    return this.findScopedRecordViews({
      scopeDelegationIds: [liveAuthUser.delegationId],
    });
  }

  async findRegionalView(authUser: AuthUser) {
    const liveAuthUser = await this.resolveLiveAuthUser(authUser);
    const scopeDelegationIds = await this.findDelegationIdsByRegion(
      liveAuthUser.regionId ?? "",
    );
    const records = await this.findScopedRecordViews({ scopeDelegationIds });
    return this.groupRecords(records);
  }

  async findAdminView(
    regionId?: string,
    delegationId?: string,
    dateFrom?: string,
    dateTo?: string,
  ) {
    const scopeDelegationIds = await this.resolveScopeDelegationIds(
      regionId,
      delegationId,
    );
    const records = await this.findScopedRecordViews({
      scopeDelegationIds,
      dateFrom,
      dateTo,
    });
    return this.groupRecords(records);
  }

  async findDirectorDelegationVehicles(
    delegationId: string,
    dateFrom?: string,
    dateTo?: string,
  ) {
    const delegation = await this.delegationRepository.findOne({
      where: { id: delegationId },
      relations: { region: true },
    });

    if (!delegation) {
      throw new NotFoundException("No se encontro la delegacion.");
    }

    return this.findScopedRecordViews({
      scopeDelegationIds: [delegationId],
      dateFrom,
      dateTo,
    });
  }

  async findDirectorOverview(
    regionId?: string,
    delegationId?: string,
    dateFrom?: string,
    dateTo?: string,
  ) {
    const query = this.recordRepository
      .createQueryBuilder("record")
      .leftJoinAndSelect("record.delegation", "delegation")
      .leftJoinAndSelect("delegation.region", "region")
      .leftJoinAndSelect("record.createdBy", "createdBy")
      .orderBy("record.createdAt", "DESC");

    if (regionId) {
      query.andWhere("region.id = :regionId", { regionId });
    }

    if (delegationId) {
      query.andWhere("delegation.id = :delegationId", { delegationId });
    }

    if (dateFrom) {
      query.andWhere("record.createdAt >= :dateFrom", {
        dateFrom: `${dateFrom}T00:00:00.000Z`,
      });
    }

    if (dateTo) {
      query.andWhere("record.createdAt <= :dateTo", {
        dateTo: `${dateTo}T23:59:59.999Z`,
      });
    }

    const records = await query.getMany();
    const reportOverview = await this.findRosterReportOverview(regionId);
    const reportKpis = {
      notReported: reportOverview.filter((row) => row.status === "NOT_REPORTED")
        .length,
      pendingChanges: reportOverview.filter(
        (row) => row.status === "PENDING_CHANGES",
      ).length,
      reportedWithoutChanges: reportOverview.filter(
        (row) => row.status === "REPORTED_WITHOUT_CHANGES",
      ).length,
      reportedWithChanges: reportOverview.filter(
        (row) => row.status === "REPORTED_WITH_CHANGES",
      ).length,
    };

    const statuses = ["INCATIVO", "SINIESTRADO", "PARA BAJA", "OTRO"];
    const physicalStatuses: string[] = [];
    const allowedStatusValues = new Set<string>(
      RECORD_FIELD_CATALOG.status.options.map((option) => option.value),
    );
    const vehicleClassRows = new Map<
      string,
      {
        vehicleClass: string;
        totalUnits: number;
        totalActive: number;
        statusBreakdown: Record<string, number>;
        physicalStatusBreakdown: Record<string, number>;
      }
    >();
    const delegationMapRows = new Map<
      string,
      {
        delegationId: string;
        delegationName: string;
        regionId: string;
        regionName: string;
        totalUnits: number;
        vehicleClasses: Map<
          string,
          {
            vehicleClass: string;
            totalUnits: number;
            statusBreakdown: Record<string, number>;
          }
        >;
      }
    >();
    const customStatusDescriptions: string[] = [];
    const capturedObservations: string[] = [];

    for (const record of records) {
      const vehicleClass = record.vehicleClass;
      const delegationId = record.delegation.id;

      if (!vehicleClassRows.has(vehicleClass)) {
        vehicleClassRows.set(vehicleClass, {
          vehicleClass,
          totalUnits: 0,
          totalActive: 0,
          statusBreakdown: Object.fromEntries(
            statuses.map((status) => [status, 0]),
          ),
          physicalStatusBreakdown: Object.fromEntries(
            physicalStatuses.map((status) => [status, 0]),
          ),
        });
      }

      const row = vehicleClassRows.get(vehicleClass)!;
      row.totalUnits += 1;

      if (!delegationMapRows.has(delegationId)) {
        delegationMapRows.set(delegationId, {
          delegationId: record.delegation.id,
          delegationName: record.delegation.name,
          regionId: record.delegation.region.id,
          regionName: record.delegation.region.name,
          totalUnits: 0,
          vehicleClasses: new Map(),
        });
      }

      const delegationRow = delegationMapRows.get(delegationId)!;
      delegationRow.totalUnits += 1;

      if (!delegationRow.vehicleClasses.has(vehicleClass)) {
        delegationRow.vehicleClasses.set(vehicleClass, {
          vehicleClass,
          totalUnits: 0,
          statusBreakdown: Object.fromEntries(
            statuses.map((status) => [status, 0]),
          ),
        });
      }

      const delegationVehicleClassRow =
        delegationRow.vehicleClasses.get(vehicleClass)!;
      delegationVehicleClassRow.totalUnits += 1;

      if (record.status in row.statusBreakdown) {
        row.statusBreakdown[record.status] += 1;
        delegationVehicleClassRow.statusBreakdown[record.status] += 1;
      } else if (record.status !== "ACTIVO") {
        row.statusBreakdown.OTRO += 1;
        delegationVehicleClassRow.statusBreakdown.OTRO += 1;
      }

      if (record.physicalStatus in row.physicalStatusBreakdown) {
        row.physicalStatusBreakdown[record.physicalStatus] += 1;
      }

      if (!allowedStatusValues.has(record.status)) {
        customStatusDescriptions.push(
          `PLACAS: ${resolveMainPlates(record) || record.plates || '-'} | TIPO: ${record.vehicleClass} | DELEGACIÓN: ${record.delegation.name} | OFICIAL: ${record.createdBy.firstName} ${record.createdBy.lastName} | ESTATUS CAPTURADO EN OTRO: ${record.status}`,
        );
      }

      if (record.observation.trim().length > 0) {
        capturedObservations.push(
          `PLACAS: ${resolveMainPlates(record) || record.plates || '-'} | TIPO: ${record.vehicleClass} | DELEGACIÓN: ${record.delegation.name} | OFICIAL: ${record.createdBy.firstName} ${record.createdBy.lastName} | OBSERVACIÓN: ${record.observation}`,
        );
      }
    }

    const rows = Array.from(vehicleClassRows.values())
      .map((row) => ({
        ...row,
        totalActive: calculateNetActive(row.totalUnits, row.statusBreakdown),
      }))
      .sort((left, right) =>
        left.vehicleClass.localeCompare(right.vehicleClass),
      );

    const resume = {
      totalUnits: rows.reduce((total, row) => total + row.totalUnits, 0),
      totalActive: rows.reduce((total, row) => total + row.totalActive, 0),
      statusBreakdown: Object.fromEntries(
        statuses.map((status) => [
          status,
          rows.reduce((total, row) => total + row.statusBreakdown[status], 0),
        ]),
      ),
      physicalStatusBreakdown: Object.fromEntries(
        physicalStatuses.map((status) => [
          status,
          rows.reduce(
            (total, row) => total + row.physicalStatusBreakdown[status],
            0,
          ),
        ]),
      ),
    };

    const availableFilters = await this.delegationRepository.find({
      relations: {
        region: true,
      },
      order: {
        region: {
          sortOrder: "ASC",
        },
        sortOrder: "ASC",
      },
    });

    const regionsMap = new Map<
      string,
      {
        regionId: string;
        regionName: string;
        delegations: { id: string; name: string }[];
      }
    >();

    for (const delegation of availableFilters) {
      if (!regionsMap.has(delegation.region.id)) {
        regionsMap.set(delegation.region.id, {
          regionId: delegation.region.id,
          regionName: delegation.region.name,
          delegations: [],
        });
      }

      regionsMap.get(delegation.region.id)!.delegations.push({
        id: delegation.id,
        name: delegation.name,
      });

      if (!delegationMapRows.has(delegation.id)) {
        delegationMapRows.set(delegation.id, {
          delegationId: delegation.id,
          delegationName: delegation.name,
          regionId: delegation.region.id,
          regionName: delegation.region.name,
          totalUnits: 0,
          vehicleClasses: new Map(),
        });
      }
    }

    const mapDelegations = Array.from(delegationMapRows.values())
      .map((delegationRow) => {
        const vehicleClasses = Array.from(delegationRow.vehicleClasses.values())
          .map((vehicleClassRow) => ({
            vehicleClass: vehicleClassRow.vehicleClass,
            totalUnits: vehicleClassRow.totalUnits,
            totalActive: calculateNetActive(
              vehicleClassRow.totalUnits,
              vehicleClassRow.statusBreakdown,
            ),
          }))
          .sort((left, right) => {
            if (right.totalUnits !== left.totalUnits) {
              return right.totalUnits - left.totalUnits;
            }

            return left.vehicleClass.localeCompare(right.vehicleClass);
          });

        return {
          delegationId: delegationRow.delegationId,
          delegationName: delegationRow.delegationName,
          regionId: delegationRow.regionId,
          regionName: delegationRow.regionName,
          totalUnits: delegationRow.totalUnits,
          totalActive: vehicleClasses.reduce(
            (total, row) => total + row.totalActive,
            0,
          ),
          dominantVehicleClass: vehicleClasses[0]?.vehicleClass ?? null,
          vehicleClasses,
        };
      })
      .sort((left, right) => {
        if (left.regionName !== right.regionName) {
          return left.regionName.localeCompare(right.regionName);
        }

        return left.delegationName.localeCompare(right.delegationName);
      });

    return {
      kpis: {
        totalRecords: records.length,
        totalRegions: new Set(
          records.map((record) => record.delegation.region.id),
        ).size,
        totalDelegations: new Set(records.map((record) => record.delegation.id))
          .size,
        totalActive: calculateNetActive(records.length, resume.statusBreakdown),
        ...reportKpis,
      },
      table: {
        date:
          records.length > 0
            ? records.reduce(
                (latestDate, record) =>
                  new Date(record.createdAt) > new Date(latestDate)
                    ? record.createdAt
                    : latestDate,
                records[0].createdAt,
              )
            : new Date().toISOString(),
        statuses,
        physicalStatuses,
        rows,
        resume,
        customStatusDescriptions,
        observations: capturedObservations,
      },
      map: {
        delegations: mapDelegations,
      },
      filters: {
        selectedRegionId: regionId ?? null,
        selectedDelegationId: delegationId ?? null,
        regions: Array.from(regionsMap.values()),
      },
    };
  }

  async softDelete(id: string, authUser: AuthUser) {
    const record = await this.findOne(id);
    await this.recordRepository.softDelete(id);
    const deletedRecord =
      (await this.recordRepository.findOne({
        where: { id },
        withDeleted: true,
        relations: {
          delegation: {
            region: true,
          },
          createdBy: true,
        },
      })) ?? record;

    await this.auditLogsService.register({
      actorId: authUser.sub,
      action: "RECORD_SOFT_DELETED",
      entityType: "record",
      entityId: record.id,
      metadata: {
        deletedByRole: authUser.role,
        deletedByUserId: authUser.sub,
        plates: resolveMainPlates(record) || record.plates || '-',
        delegationId: record.delegation.id,
        regionId: record.delegation.region.id,
        createdById: record.createdBy?.id ?? null,
      },
    });

    this.realtimeGateway.emitRecordChanged({
      ...deletedRecord,
    });

    return { success: true };
  }

  private async findRosterReport(id: string) {
    const report = await this.rosterReportRepository.findOne({
      where: { id },
      relations: {
        delegation: {
          region: true,
        },
        region: true,
        submittedBy: true,
      },
    });

    if (!report) {
      throw new NotFoundException("No se encontro el reporte de plantilla.");
    }

    return report;
  }

  private findLastRosterReportByDelegation(delegationId: string) {
    return this.rosterReportRepository.findOne({
      where: {
        reportScope: "DELEGATION",
        delegation: {
          id: delegationId,
        },
      },
      relations: {
        delegation: true,
        region: true,
        submittedBy: true,
      },
      order: {
        submittedAt: "DESC",
      },
    });
  }

  private findLastRosterReportByRegion(
    regionId: string,
    reportScope: VehicleRosterReportScope,
  ) {
    return this.rosterReportRepository.findOne({
      where: {
        reportScope,
        region: {
          id: regionId,
        },
      },
      relations: {
        delegation: {
          region: true,
        },
        region: true,
        submittedBy: true,
      },
      order: {
        submittedAt: "DESC",
      },
    });
  }

  private countDelegationMovementsSince(
    delegationId: string,
    since: Date | null,
  ) {
    const query = this.auditLogRepository
      .createQueryBuilder("auditLog")
      .where("auditLog.action IN (:...actions)", {
        actions: reportableMovementActions,
      })
      .andWhere(
        new Brackets((whereBuilder) => {
          whereBuilder
            .where("auditLog.metadata ->> 'delegationId' = :delegationId", {
              delegationId,
            })
            .orWhere(
              "auditLog.metadata ->> 'fromDelegationId' = :delegationId",
              { delegationId },
            )
            .orWhere("auditLog.metadata ->> 'toDelegationId' = :delegationId", {
              delegationId,
            });
        }),
      );

    if (since) {
      query.andWhere("auditLog.createdAt > :since", { since });
    }

    return query.getCount();
  }

  private async getRegionalDelegationProgress(regionId: string, since: Date | null) {
    const delegations = await this.delegationRepository.find({
      where: {
        region: {
          id: regionId,
        },
      },
    });
    let confirmedDelegationReports = 0;

    for (const delegation of delegations) {
      const reportQuery = this.rosterReportRepository
        .createQueryBuilder("report")
        .leftJoin("report.delegation", "delegation")
        .where("report.reportScope = :reportScope", {
          reportScope: "DELEGATION",
        })
        .andWhere("delegation.id = :delegationId", {
          delegationId: delegation.id,
        })
        .orderBy("report.submittedAt", "DESC");

      if (since) {
        reportQuery.andWhere("report.submittedAt > :since", { since });
      }

      const lastDelegationReport = await reportQuery.getOne();

      if (!lastDelegationReport) {
        continue;
      }

      const movementsSinceLastReport = await this.countDelegationMovementsSince(
        delegation.id,
        lastDelegationReport.submittedAt,
      );

      if (movementsSinceLastReport === 0) {
        confirmedDelegationReports += 1;
      }
    }

    const totalDelegations = delegations.length;

    return {
      totalDelegations,
      confirmedDelegationReports,
      pendingDelegationReports: Math.max(
        totalDelegations - confirmedDelegationReports,
        0,
      ),
    };
  }

  private async resolveLiveAuthUser(authUser: AuthUser): Promise<LiveAuthUser> {
    const user = await this.userRepository.findOne({
      where: { id: authUser.sub },
      relations: {
        region: true,
        delegation: {
          region: true,
        },
      },
    });

    if (!user) {
      throw new NotFoundException("No se encontro el usuario.");
    }

    return {
      sub: user.id,
      role: user.role,
      regionId: user.region?.id ?? user.delegation?.region?.id ?? null,
      delegationId: user.delegation?.id ?? null,
    };
  }

  private ensureEnlaceDelegationAccess(
    authUser: AuthUser,
    delegationId: string,
  ) {
    if (authUser.role !== Role.Enlace) {
      return;
    }

    if (authUser.delegationId !== delegationId) {
      throw new ForbiddenException(
        "El enlace solo puede usar su delegacion asignada.",
      );
    }
  }

  private async ensureNoDuplicateRecords(
    values: DuplicateCheckValues,
    excludeId?: string,
  ) {
    const uniqueFields = ["plates", "civ", "engineNumber", "serialNumber"] as const;
    const conflicts: string[] = [];

    for (const field of uniqueFields) {
      const fieldValue = values[field];

      if (!fieldValue || fieldValue.trim().length === 0) {
        continue;
      }

      const query = this.recordRepository
        .createQueryBuilder("record")
        .where(`record.${field} = :value`, { value: fieldValue })
        .andWhere("record.deletedAt IS NULL");

      if (excludeId) {
        query.andWhere("record.id != :excludeId", { excludeId });
      }

      const existing = await query.getOne();

      if (existing) {
        const fieldLabel =
          field === "plates"
            ? "Las placas"
            : field === "civ"
              ? "El CIV"
            : field === "engineNumber"
              ? "El numero de motor"
              : "El numero de serie";
        conflicts.push(
          `${fieldLabel} '${fieldValue}' ya esta en uso en una captura activa.`,
        );
      }
    }

    if (conflicts.length > 0) {
      throw new ConflictException(conflicts.join(" "));
    }
  }

  private ensureRecordEditAccess(record: RecordEntity, authUser: AuthUser) {
    if (authUser.role !== Role.Enlace) {
      return;
    }

    if (record.delegation.id !== authUser.delegationId) {
      throw new ForbiddenException(
        "El enlace solo puede editar capturas de su delegacion.",
      );
    }
  }

  private ensureRecordTransferAccess(
    record: RecordEntity,
    toDelegation: DelegationEntity,
    authUser: AuthUser,
  ) {
    if (
      authUser.role === Role.PlantillaVehicular ||
      authUser.role === Role.SuperAdmin ||
      authUser.role === Role.Coordinacion
    ) {
      return;
    }

    if (authUser.role === Role.Enlace) {
      if (record.delegation.id !== authUser.delegationId) {
        throw new ForbiddenException(
          "El enlace solo puede trasladar capturas de su delegacion.",
        );
      }

      return;
    }

    if (authUser.role === Role.DirectorOperativo) {
      if (
        record.delegation.region.id !== authUser.regionId ||
        toDelegation.region.id !== authUser.regionId
      ) {
        throw new ForbiddenException(
          "El director operativo solo puede trasladar capturas dentro de su region asignada.",
        );
      }

      return;
    }

    throw new ForbiddenException(
      "El usuario no tiene permiso para trasladar capturas.",
    );
  }

  private normalizeBaseRecordValues(
    values: BaseRecordValues,
  ): BaseRecordValues {
    return {
      plates: normalizePlateSourceValue(values.plates),
      brand: normalizeUpper(values.brand),
      type: normalizeUpper(values.type),
      useType: normalizeUpper(values.useType),
      vehicleClass: normalizeUpper(values.vehicleClass),
      model: normalizeUpper(values.model),
      engineNumber: normalizeUpper(values.engineNumber),
      serialNumber: normalizeUpper(values.serialNumber),
      custodian: normalizeUpper(values.custodian),
      patrolNumber: normalizeUpper(values.patrolNumber),
      physicalStatus: normalizeUpper(values.physicalStatus),
      status: normalizeUpper(values.status),
      assetClassification: normalizeUpper(values.assetClassification),
      rawAssetClassification: normalizeUpper(values.rawAssetClassification ?? ""),
      observation: normalizeText(values.observation),
    };
  }

  private normalizeEditableRecordValues(
    values: EditableRecordValues,
  ): EditableRecordValues {
    const normalizedPlateFields = {
      plates: normalizePlateSourceValue(values.plates),
      previousPlates: normalizePlateSourceValue(values.previousPlates),
      plates2024: normalizePlateSourceValue(values.plates2024),
      plates2025: normalizePlateSourceValue(values.plates2025),
      plates2026: normalizePlateSourceValue(values.plates2026),
    };

    return {
      ...values,
      ...normalizedPlateFields,
      plates: resolveMainPlates({
        plates: normalizedPlateFields.plates,
        previousPlates: normalizedPlateFields.previousPlates,
        plates2024: normalizedPlateFields.plates2024,
        plates2025: normalizedPlateFields.plates2025,
        plates2026: normalizedPlateFields.plates2026,
      }),
      civ: normalizeUpper(values.civ).replace(/\s+/g, ""),
      brand: normalizeUpper(values.brand),
      type: normalizeUpper(values.type),
      useType: normalizeUpper(values.useType),
      vehicleClass: normalizeUpper(values.vehicleClass),
      model: normalizeUpper(values.model),
      cylinders: normalizeUpper(values.cylinders),
      fuelCapacityLiters: normalizeUpper(values.fuelCapacityLiters),
      engineNumber: normalizeUpper(values.engineNumber),
      serialNumber: normalizeUpper(values.serialNumber),
      custodian: normalizeUpper(values.custodian),
      patrolNumber: normalizeUpper(values.patrolNumber),
      color: normalizeUpper(values.color),
      adscription: normalizeUpper(values.adscription),
      realLocation: normalizeUpper(values.realLocation),
      physicalStatus: normalizeUpper(values.physicalStatus),
      status: normalizeUpper(values.status),
      rawCirculationStatus: normalizeUpper(values.rawCirculationStatus),
      assetClassification: normalizeUpper(values.assetClassification),
      rawAssetClassification: normalizeUpper(values.rawAssetClassification),
      sourceSection: normalizeUpper(values.sourceSection),
      sourceRowNumber:
        values.sourceRowNumber === null
          ? null
          : Number.isFinite(values.sourceRowNumber)
            ? values.sourceRowNumber
            : null,
      observation: normalizeText(values.observation),
    };
  }

  private pickRecordValues(record: RecordEntity): EditableRecordValues {
    return {
      plates: record.plates,
      civ: record.civ,
      previousPlates: record.previousPlates,
      plates2024: record.plates2024,
      plates2025: record.plates2025,
      plates2026: record.plates2026,
      brand: record.brand,
      type: record.type,
      useType: record.useType,
      vehicleClass: record.vehicleClass,
      model: record.model,
      cylinders: record.cylinders,
      fuelCapacityLiters: record.fuelCapacityLiters,
      engineNumber: record.engineNumber,
      serialNumber: record.serialNumber,
      custodian: record.custodian,
      patrolNumber: record.patrolNumber,
      color: record.color,
      adscription: record.adscription,
      realLocation: record.realLocation,
      physicalStatus: record.physicalStatus,
      status: record.status,
      rawCirculationStatus: record.rawCirculationStatus,
      assetClassification: record.assetClassification,
      rawAssetClassification: record.rawAssetClassification,
      sourceSection: record.sourceSection,
      sourceRowNumber: record.sourceRowNumber,
      observation: record.observation,
    };
  }

  private mergeDefinedRecordValues(
    currentValues: EditableRecordValues,
    dto: UpdateRecordDto,
  ): EditableRecordValues {
    const mergedValues = { ...currentValues } as Record<
      EditableRecordField,
      EditableRecordValues[EditableRecordField]
    >;

    for (const fieldName of editableRecordFields) {
      const nextValue = dto[fieldName];

      if (nextValue !== undefined) {
        mergedValues[fieldName] = nextValue as EditableRecordValues[EditableRecordField];
      }
    }

    return mergedValues as EditableRecordValues;
  }

  private async findDelegationIdsByRegion(regionId: string) {
    if (!regionId) {
      return [];
    }

    const delegations = await this.delegationRepository.find({
      where: {
        region: {
          id: regionId,
        },
      },
      relations: {
        region: true,
      },
    });

    return delegations.map((delegation) => delegation.id);
  }

  private findScopedDelegations(regionId?: string, delegationId?: string) {
    const where = delegationId
      ? { id: delegationId }
      : regionId
        ? {
            region: {
              id: regionId,
            },
          }
        : {};

    return this.delegationRepository.find({
      where,
      relations: {
        region: true,
      },
      order: {
        region: {
          sortOrder: "ASC",
        },
        sortOrder: "ASC",
      },
    });
  }

  private findScopedRegions(regionId?: string) {
    return this.delegationRepository.manager.find(RegionEntity, {
      where: regionId ? { id: regionId } : {},
      order: {
        sortOrder: "ASC",
      },
    });
  }

  private async buildDelegationRosterReportOverview(
    delegations: DelegationEntity[],
  ): Promise<DelegationReportOverviewRow[]> {
    const rows: DelegationReportOverviewRow[] = [];

    for (const delegation of delegations) {
      const lastReport = await this.findLastRosterReportByDelegation(
        delegation.id,
      );
      const pendingChanges = await this.countDelegationMovementsSince(
        delegation.id,
        lastReport?.submittedAt ?? null,
      );

      rows.push({
        delegationId: delegation.id,
        delegationName: delegation.name,
        regionId: delegation.region.id,
        regionName: delegation.region.name,
        status: lastReport
          ? pendingChanges > 0
            ? "PENDING_CHANGES"
            : lastReport.hasChanges
              ? "REPORTED_WITH_CHANGES"
              : "REPORTED_WITHOUT_CHANGES"
          : "NOT_REPORTED",
        pendingChanges,
        lastReport,
      });
    }

    return rows;
  }

  private async buildRegionRosterReportOverview(
    regions: RegionEntity[],
  ): Promise<RegionReportOverviewRow[]> {
    const rows: RegionReportOverviewRow[] = [];

    for (const region of regions) {
      const lastReport = await this.findLastRosterReportByRegion(
        region.id,
        "REGION",
      );
      const delegationProgress = await this.getRegionalDelegationProgress(
        region.id,
        lastReport?.submittedAt ?? null,
      );
      const pendingDelegationReports =
        delegationProgress.pendingDelegationReports;

      rows.push({
        regionId: region.id,
        regionName: region.name,
        status: lastReport
          ? pendingDelegationReports > 0
            ? "PENDING_CHANGES"
            : lastReport.hasChanges
              ? "REPORTED_WITH_CHANGES"
              : "REPORTED_WITHOUT_CHANGES"
          : "NOT_REPORTED",
        totalDelegations: delegationProgress.totalDelegations,
        confirmedDelegationReports:
          delegationProgress.confirmedDelegationReports,
        pendingDelegationReports,
        lastReport,
      });
    }

    return rows;
  }

  private async resolveScopeDelegationIds(
    regionId?: string,
    delegationId?: string,
  ) {
    if (delegationId) {
      return [delegationId];
    }

    if (regionId) {
      return this.findDelegationIdsByRegion(regionId);
    }

    const delegations = await this.delegationRepository.find({
      select: {
        id: true,
      },
    });

    return delegations.map((delegation) => delegation.id);
  }

  private async findScopedRecordViews(filters: ScopedRecordFilters) {
    if (filters.scopeDelegationIds.length === 0) {
      return [];
    }

    const historicalRecordIds = await this.vehicleTransferRepository
      .createQueryBuilder("transfer")
      .leftJoin("transfer.record", "record")
      .select("record.id", "id")
      .where("transfer.fromDelegationId IN (:...scopeDelegationIds)", {
        scopeDelegationIds: filters.scopeDelegationIds,
      })
      .orWhere("transfer.toDelegationId IN (:...scopeDelegationIds)", {
        scopeDelegationIds: filters.scopeDelegationIds,
      })
      .getRawMany<{ id: string }>();

    const recordIds = Array.from(
      new Set(historicalRecordIds.map((row) => row.id)),
    );
    const query = this.recordRepository
      .createQueryBuilder("record")
      .leftJoinAndSelect("record.delegation", "delegation")
      .leftJoinAndSelect("delegation.region", "region")
      .leftJoinAndSelect("record.createdBy", "createdBy")
      .leftJoinAndSelect("record.photos", "photos")
      .leftJoinAndSelect("photos.uploadedBy", "photoUploadedBy")
      .where(
        new Brackets((whereBuilder) => {
          whereBuilder.where("delegation.id IN (:...scopeDelegationIds)", {
            scopeDelegationIds: filters.scopeDelegationIds,
          });

          if (recordIds.length > 0) {
            whereBuilder.orWhere("record.id IN (:...recordIds)", {
              recordIds,
            });
          }
        }),
      )
      .orderBy("record.createdAt", "DESC");

    if (filters.dateFrom) {
      query.andWhere("record.createdAt >= :dateFrom", {
        dateFrom: `${filters.dateFrom}T00:00:00.000Z`,
      });
    }

    if (filters.dateTo) {
      query.andWhere("record.createdAt <= :dateTo", {
        dateTo: `${filters.dateTo}T23:59:59.999Z`,
      });
    }

    const records = await query.getMany();
    return this.hydrateRecordViews(records, filters.scopeDelegationIds);
  }

  private async hydrateRecordViews(
    records: RecordEntity[],
    scopeDelegationIds: string[],
  ) {
    if (records.length === 0) {
      return [];
    }

    const recordIds = records.map((record) => record.id);
    const transfers = await this.vehicleTransferRepository.find({
      where: {
        record: {
          id: In(recordIds),
        },
      },
      relations: {
        record: true,
        fromDelegation: {
          region: true,
        },
        toDelegation: {
          region: true,
        },
        movedBy: true,
      },
      order: {
        movedAt: "DESC",
      },
    });
    const editLogs = await this.auditLogRepository.find({
      where: {
        entityType: "record",
        entityId: In(recordIds),
        action: "RECORD_UPDATED",
      },
      relations: {
        actor: true,
      },
      order: {
        createdAt: "DESC",
      },
    });
    const transfersByRecordId = new Map<string, VehicleTransferEntity[]>();
    const editsByRecordId = new Map<string, AuditLogEntity[]>();

    for (const transfer of transfers) {
      const current = transfersByRecordId.get(transfer.record.id) ?? [];
      current.push(transfer);
      transfersByRecordId.set(transfer.record.id, current);
    }

    for (const editLog of editLogs) {
      const current = editsByRecordId.get(editLog.entityId) ?? [];
      current.push(editLog);
      editsByRecordId.set(editLog.entityId, current);
    }

    const rows: RecordView[] = [];

    for (const record of records) {
      const recordTransfers = transfersByRecordId.get(record.id) ?? [];
      const recordEdits = editsByRecordId.get(record.id) ?? [];
      const viewDelegations = new Map<string, ViewDelegation>();

      if (scopeDelegationIds.includes(record.delegation.id)) {
        viewDelegations.set(
          record.delegation.id,
          this.mapDelegation(record.delegation),
        );
      }

      for (const transfer of recordTransfers) {
        if (scopeDelegationIds.includes(transfer.fromDelegation.id)) {
          viewDelegations.set(
            transfer.fromDelegation.id,
            this.mapDelegation(transfer.fromDelegation),
          );
        }

        if (scopeDelegationIds.includes(transfer.toDelegation.id)) {
          viewDelegations.set(
            transfer.toDelegation.id,
            this.mapDelegation(transfer.toDelegation),
          );
        }
      }

      for (const viewDelegation of viewDelegations.values()) {
        const scopedTransferHistory = recordTransfers
          .filter(
            (transfer) =>
              transfer.fromDelegation.id === viewDelegation.id ||
              transfer.toDelegation.id === viewDelegation.id,
          )
          .map((transfer) => this.mapTransfer(transfer));
        const latestTransfer =
          (record.delegation.id === viewDelegation.id
            ? scopedTransferHistory[0]
            : scopedTransferHistory.find(
                (transfer) => transfer.fromDelegation.id === viewDelegation.id,
              )) ??
          scopedTransferHistory[0] ??
          null;

        rows.push({
          ...record,
          viewDelegation,
          recordState:
            record.delegation.id === viewDelegation.id
              ? "CURRENT"
              : "TRANSFERRED_OUT",
          latestTransfer,
          latestEdit: recordEdits[0] ? this.mapEditLog(recordEdits[0]) : null,
          transferHistory: recordTransfers.map((transfer) =>
            this.mapTransfer(transfer),
          ),
          editHistory: recordEdits.map((editLog) => this.mapEditLog(editLog)),
        });
      }
    }

    return rows.sort(
      (left, right) => +new Date(right.createdAt) - +new Date(left.createdAt),
    );
  }

  private mapDelegation(delegation: DelegationEntity): ViewDelegation {
    return {
      id: delegation.id,
      name: delegation.name,
      sortOrder: delegation.sortOrder,
      region: {
        id: delegation.region.id,
        name: delegation.region.name,
        sortOrder: delegation.region.sortOrder,
      },
    };
  }

  private mapTransfer(transfer: VehicleTransferEntity): RecordTransferView {
    return {
      id: transfer.id,
      movedAt: transfer.movedAt.toISOString(),
      reason: transfer.reason,
      fromDelegation: this.mapDelegation(transfer.fromDelegation),
      toDelegation: this.mapDelegation(transfer.toDelegation),
      movedBy: transfer.movedBy,
    };
  }

  private mapEditLog(editLog: AuditLogEntity): RecordEditView {
    return {
      id: editLog.id,
      editedAt: editLog.createdAt.toISOString(),
      changedFields: Array.isArray(editLog.metadata.changedFields)
        ? editLog.metadata.changedFields.map((fieldName) => String(fieldName))
        : [],
      before:
        editLog.metadata.before && typeof editLog.metadata.before === "object"
          ? (editLog.metadata.before as Record<string, unknown>)
          : {},
      after:
        editLog.metadata.after && typeof editLog.metadata.after === "object"
          ? (editLog.metadata.after as Record<string, unknown>)
          : {},
      actor: editLog.actor ?? null,
    };
  }

  private groupRecords(records: RecordView[]) {
    const regionsMap = new Map<
      string,
      {
        regionId: string;
        regionName: string;
        regionSortOrder: number;
        delegations: Map<
          string,
          {
            delegationId: string;
            delegationName: string;
            delegationSortOrder: number;
            records: RecordView[];
          }
        >;
      }
    >();

    for (const record of records) {
      const regionId = record.viewDelegation.region.id;
      const delegationId = record.viewDelegation.id;

      if (!regionsMap.has(regionId)) {
        regionsMap.set(regionId, {
          regionId,
          regionName: record.viewDelegation.region.name,
          regionSortOrder: record.viewDelegation.region.sortOrder,
          delegations: new Map(),
        });
      }

      const region = regionsMap.get(regionId)!;

      if (!region.delegations.has(delegationId)) {
        region.delegations.set(delegationId, {
          delegationId,
          delegationName: record.viewDelegation.name,
          delegationSortOrder: record.viewDelegation.sortOrder,
          records: [],
        });
      }

      region.delegations.get(delegationId)!.records.push(record);
    }

    return Array.from(regionsMap.values())
      .sort((left, right) => left.regionSortOrder - right.regionSortOrder)
      .map((region) => ({
        regionId: region.regionId,
        regionName: region.regionName,
        delegations: Array.from(region.delegations.values()).sort(
          (left, right) => left.delegationSortOrder - right.delegationSortOrder,
        ),
      }));
  }
}
