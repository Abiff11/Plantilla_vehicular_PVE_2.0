import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AuditLogsService } from 'src/modules/audit-logs/audit-logs.service';
import { RecordEntity } from '../entities/record.entity';

export type VehicleLinkSource = 'UUID' | 'NOMBRE';
export type VehicleMatchSource = 'UUID' | 'NOMBRE' | 'MIXTO' | 'NINGUNO';

type VehicleSummaryOfficerInput = {
  id?: string;
  name?: string;
};

const LEGACY_NAME_ACCENTED_CHARACTERS = 'ÀÁÂÃÄÅàáâãäåÈÉÊËèéêëÌÍÎÏìíîïÑñÒÓÔÕÖòóôõöÙÚÛÜùúûüÝýÿÇç';
const LEGACY_NAME_ASCII_CHARACTERS = 'AAAAAAaaaaaaEEEEeeeeIIIIiiiiNnOOOOOoooooUUUUuuuuYyyCc';
const LEGACY_CUSTODIAN_RANK_PREFIXES = new Set(['CMDTE', 'CMTE', 'COMANDANTE']);
const LEGACY_CUSTODIAN_RANK_PREFIX_SQL = '(CMDTE|CMTE|COMANDANTE)';
const NORMALIZED_CUSTODIAN_SQL = `UPPER(TRIM(REGEXP_REPLACE(REGEXP_REPLACE(TRANSLATE(record.custodian, '${LEGACY_NAME_ACCENTED_CHARACTERS}', '${LEGACY_NAME_ASCII_CHARACTERS}'), '[^A-Za-z0-9]+', ' ', 'g'), '[[:space:]]+', ' ', 'g')))`;
const CUSTODIAN_WITHOUT_RANK_SQL = `REGEXP_REPLACE(${NORMALIZED_CUSTODIAN_SQL}, '^${LEGACY_CUSTODIAN_RANK_PREFIX_SQL}[[:space:]]+', '')`;

@Injectable()
export class ControlPersonalIntegrationService {
  constructor(
    @InjectRepository(RecordEntity) private readonly recordsRepo: Repository<RecordEntity>,
    private readonly auditLogs: AuditLogsService,
  ) {}

  async findVehiclesByOfficer(officerId: string, officerName?: string) {
    const stable = await this.recordsRepo.find({ where: { custodianOficialId: officerId }, order: { patrolNumber: 'ASC' } });
    if (!officerName?.trim()) {
      return {
        matchSource: stable.length ? 'UUID' as const : 'NINGUNO' as const,
        items: stable.map((item) => this.toView(item, 'UUID')),
      };
    }

    const legacy = await this.findLegacyVehicles(officerName);

    const matchSource: VehicleMatchSource = stable.length && legacy.length
      ? 'MIXTO'
      : stable.length
        ? 'UUID'
        : legacy.length
          ? 'NOMBRE'
          : 'NINGUNO';

    return {
      matchSource,
      items: [
        ...stable.map((item) => this.toView(item, 'UUID')),
        ...legacy.map((item) => this.toView(item, 'NOMBRE')),
      ],
    };
  }

  async summarizeVehiclesByOfficers(officers: VehicleSummaryOfficerInput[]) {
    const unique = new Map<string, { id: string; name: string }>();
    for (const officer of Array.isArray(officers) ? officers : []) {
      const id = String(officer?.id || '').trim();
      const name = String(officer?.name || '').trim();
      if (!id) continue;
      if (!unique.has(id)) unique.set(id, { id, name });
    }

    const normalizedOfficers = Array.from(unique.values());
    if (normalizedOfficers.length > 1000) {
      throw new BadRequestException('El resumen masivo admite hasta 1000 oficiales por solicitud');
    }
    if (!normalizedOfficers.length) return { items: [] };

    const officerIds = normalizedOfficers.map((officer) => officer.id);
    const counts = new Map(officerIds.map((id) => [id, 0]));
    const stable = await this.recordsRepo.find({
      where: { custodianOficialId: In(officerIds) },
      order: { patrolNumber: 'ASC' },
    });
    for (const record of stable) {
      const officerId = String(record.custodianOficialId || '').trim();
      if (counts.has(officerId)) counts.set(officerId, (counts.get(officerId) || 0) + 1);
    }

    const candidateOwners = new Map<string, Set<string>>();
    for (const officer of normalizedOfficers) {
      if (!officer.name) continue;
      for (const candidate of this.buildNameCandidates(officer.name)) {
        const owners = candidateOwners.get(candidate) || new Set<string>();
        owners.add(officer.id);
        candidateOwners.set(candidate, owners);
      }
    }

    const normalizedOfficerNames = Array.from(candidateOwners.keys());
    if (normalizedOfficerNames.length) {
      const legacy = await this.recordsRepo
        .createQueryBuilder('record')
        .where('record."custodianOficialId" IS NULL')
        .andWhere(
          `${CUSTODIAN_WITHOUT_RANK_SQL} IN (:...normalizedOfficerNames)`,
          { normalizedOfficerNames },
        )
        .orderBy('record.patrolNumber', 'ASC')
        .getMany();

      for (const record of legacy) {
        const normalizedCustodian = this.stripLegacyRankPrefix(
          this.normalizeName(record.custodian || ''),
        );
        const owners = candidateOwners.get(normalizedCustodian);
        if (!owners || owners.size !== 1) continue;
        const [officerId] = Array.from(owners);
        counts.set(officerId, (counts.get(officerId) || 0) + 1);
      }
    }

    return {
      items: normalizedOfficers.map((officer) => ({
        officerId: officer.id,
        count: counts.get(officer.id) || 0,
      })),
    };
  }

  async linkVehicleToOfficer(recordId: string, officerId: string, officerName: string) {
    const record = await this.recordsRepo.findOne({ where: { id: recordId } });
    if (!record) throw new NotFoundException('Vehículo no encontrado');

    if (record.custodianOficialId && record.custodianOficialId !== officerId) {
      throw new ConflictException('El vehículo ya está vinculado a otro oficial');
    }

    if (!this.namesEquivalent(record.custodian, officerName)) {
      throw new BadRequestException('El resguardante del vehículo no coincide con el oficial que se intenta vincular');
    }

    if (record.custodianOficialId === officerId) {
      return { matchSource: 'UUID' as const, item: this.toView(record, 'UUID') };
    }

    const previousOfficerId = record.custodianOficialId;
    record.custodianOficialId = officerId;
    const saved = await this.recordsRepo.save(record);

    await this.auditLogs.register({
      action: 'LINK_CONTROL_PERSONAL_CUSTODIAN',
      entityType: 'RecordEntity',
      entityId: saved.id,
      metadata: {
        previousCustodianOficialId: previousOfficerId,
        custodianOficialId: officerId,
        custodian: saved.custodian,
      },
    });

    return { matchSource: 'UUID' as const, item: this.toView(saved, 'UUID') };
  }

  private normalizeName(value: string) {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/gu, '')
      .toUpperCase()
      .replace(/[^A-Z0-9]+/gu, ' ')
      .replace(/\s+/gu, ' ')
      .trim();
  }

  private stripLegacyRankPrefix(normalizedName: string) {
    const tokens = normalizedName.split(' ').filter(Boolean);
    if (tokens.length > 1 && LEGACY_CUSTODIAN_RANK_PREFIXES.has(tokens[0])) {
      return tokens.slice(1).join(' ');
    }
    return normalizedName;
  }

  private buildNameCandidates(value: string) {
    const normalized = this.stripLegacyRankPrefix(this.normalizeName(value));
    if (!normalized) return [];

    const tokens = normalized.split(' ');
    return Array.from(new Set(tokens.map((_, index) => [
      ...tokens.slice(index),
      ...tokens.slice(0, index),
    ].join(' '))));
  }

  private namesEquivalent(left: string, right: string) {
    const leftNormalized = this.stripLegacyRankPrefix(this.normalizeName(left));
    const rightNormalized = this.stripLegacyRankPrefix(this.normalizeName(right));
    if (!leftNormalized || !rightNormalized) return false;

    return this.buildNameCandidates(leftNormalized).includes(rightNormalized);
  }

  private findLegacyVehicles(officerName: string) {
    const normalizedOfficerNames = this.buildNameCandidates(officerName);
    if (!normalizedOfficerNames.length) return Promise.resolve([] as RecordEntity[]);

    return this.recordsRepo
      .createQueryBuilder('record')
      .where('record."custodianOficialId" IS NULL')
      .andWhere(
        `${CUSTODIAN_WITHOUT_RANK_SQL} IN (:...normalizedOfficerNames)`,
        { normalizedOfficerNames },
      )
      .orderBy('record.patrolNumber', 'ASC')
      .getMany();
  }

  private toView(record: RecordEntity, linkSource: VehicleLinkSource) {
    return {
      id: record.id,
      patrolNumber: record.patrolNumber,
      plates: record.plates,
      brand: record.brand,
      type: record.type,
      vehicleClass: record.vehicleClass,
      model: record.model,
      serialNumber: record.serialNumber,
      physicalStatus: record.physicalStatus,
      status: record.status,
      adscription: record.adscription,
      realLocation: record.realLocation,
      linkSource,
    };
  }
}
