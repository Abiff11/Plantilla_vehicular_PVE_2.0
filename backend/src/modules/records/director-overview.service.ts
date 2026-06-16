import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RECORD_FIELD_CATALOG } from 'src/modules/catalog/record-field-catalog';
import { DelegationEntity } from 'src/modules/catalog/entities/delegation.entity';
import { RecordEntity } from './entities/record.entity';

const DIRECTOR_STATUSES = ['INCATIVO', 'SINIESTRADO', 'PARA BAJA', 'OTRO'];

function calculateNetActive(totalUnits: number, statusBreakdown: Record<string, number>) {
  return Math.max(
    totalUnits -
      (statusBreakdown.INCATIVO ?? 0) -
      (statusBreakdown.SINIESTRADO ?? 0) -
      (statusBreakdown['PARA BAJA'] ?? 0) -
      (statusBreakdown.OTRO ?? 0),
    0,
  );
}

function buildEmptyStatusBreakdown() {
  return Object.fromEntries(DIRECTOR_STATUSES.map((status) => [status, 0])) as Record<string, number>;
}

@Injectable()
export class DirectorOverviewService {
  constructor(
    @InjectRepository(RecordEntity)
    private readonly recordRepository: Repository<RecordEntity>,
    @InjectRepository(DelegationEntity)
    private readonly delegationRepository: Repository<DelegationEntity>,
  ) {}

  async findOverview(regionId?: string, delegationId?: string, dateFrom?: string, dateTo?: string) {
    const query = this.recordRepository
      .createQueryBuilder('record')
      .innerJoinAndSelect('record.delegation', 'delegation')
      .innerJoinAndSelect('delegation.region', 'region')
      .leftJoinAndSelect('record.createdBy', 'createdBy')
      .orderBy('record.createdAt', 'DESC');

    if (regionId) {
      query.andWhere('region.id = :regionId', { regionId });
    }

    if (delegationId) {
      query.andWhere('delegation.id = :delegationId', { delegationId });
    }

    if (dateFrom) {
      query.andWhere('record.createdAt >= :dateFrom', { dateFrom: `${dateFrom}T00:00:00.000Z` });
    }

    if (dateTo) {
      query.andWhere('record.createdAt <= :dateTo', { dateTo: `${dateTo}T23:59:59.999Z` });
    }

    const records = await query.getMany();
    const allowedStatusValues = new Set<string>(
      RECORD_FIELD_CATALOG.status.options.map((option) => option.value),
    );
    const vehicleClassRows = new Map<string, { vehicleClass: string; totalUnits: number; totalActive: number; statusBreakdown: Record<string, number>; physicalStatusBreakdown: Record<string, number> }>();
    const delegationRows = new Map<string, { delegationId: string; delegationName: string; regionId: string; regionName: string; totalUnits: number; vehicleClasses: Map<string, { vehicleClass: string; totalUnits: number; statusBreakdown: Record<string, number> }> }>();
    const customStatusDescriptions: string[] = [];
    const observations: string[] = [];

    for (const record of records) {
      if (!record.delegation || !record.delegation.region) {
        continue;
      }

      const vehicleClass = record.vehicleClass || 'SIN CLASE';
      const delegation = record.delegation;
      const region = delegation.region;
      const delegationIdKey = delegation.id;

      if (!vehicleClassRows.has(vehicleClass)) {
        vehicleClassRows.set(vehicleClass, {
          vehicleClass,
          totalUnits: 0,
          totalActive: 0,
          statusBreakdown: buildEmptyStatusBreakdown(),
          physicalStatusBreakdown: {},
        });
      }

      const vehicleClassRow = vehicleClassRows.get(vehicleClass)!;
      vehicleClassRow.totalUnits += 1;

      if (!delegationRows.has(delegationIdKey)) {
        delegationRows.set(delegationIdKey, {
          delegationId: delegation.id,
          delegationName: delegation.name,
          regionId: region.id,
          regionName: region.name,
          totalUnits: 0,
          vehicleClasses: new Map(),
        });
      }

      const delegationRow = delegationRows.get(delegationIdKey)!;
      delegationRow.totalUnits += 1;

      if (!delegationRow.vehicleClasses.has(vehicleClass)) {
        delegationRow.vehicleClasses.set(vehicleClass, {
          vehicleClass,
          totalUnits: 0,
          statusBreakdown: buildEmptyStatusBreakdown(),
        });
      }

      const delegationVehicleClass = delegationRow.vehicleClasses.get(vehicleClass)!;
      delegationVehicleClass.totalUnits += 1;

      if (record.status in vehicleClassRow.statusBreakdown) {
        vehicleClassRow.statusBreakdown[record.status] += 1;
        delegationVehicleClass.statusBreakdown[record.status] += 1;
      } else if (record.status !== 'ACTIVO') {
        vehicleClassRow.statusBreakdown.OTRO += 1;
        delegationVehicleClass.statusBreakdown.OTRO += 1;
      }

      if (record.physicalStatus) {
        vehicleClassRow.physicalStatusBreakdown[record.physicalStatus] =
          (vehicleClassRow.physicalStatusBreakdown[record.physicalStatus] ?? 0) + 1;
      }

      const actorName = record.createdBy
        ? `${record.createdBy.firstName ?? ''} ${record.createdBy.lastName ?? ''}`.trim()
        : 'SIN USUARIO';

      if (record.status && !allowedStatusValues.has(record.status)) {
        customStatusDescriptions.push(
          `PLACAS: ${record.plates || '-'} | TIPO: ${vehicleClass} | DELEGACIÓN: ${delegation.name} | OFICIAL: ${actorName} | ESTATUS CAPTURADO EN OTRO: ${record.status}`,
        );
      }

      if (record.observation?.trim()) {
        observations.push(
          `PLACAS: ${record.plates || '-'} | TIPO: ${vehicleClass} | DELEGACIÓN: ${delegation.name} | OFICIAL: ${actorName} | OBSERVACIÓN: ${record.observation}`,
        );
      }
    }

    const tableRows = Array.from(vehicleClassRows.values())
      .map((row) => ({ ...row, totalActive: calculateNetActive(row.totalUnits, row.statusBreakdown) }))
      .sort((left, right) => left.vehicleClass.localeCompare(right.vehicleClass));

    const resume = {
      totalUnits: tableRows.reduce((total, row) => total + row.totalUnits, 0),
      totalActive: tableRows.reduce((total, row) => total + row.totalActive, 0),
      statusBreakdown: Object.fromEntries(
        DIRECTOR_STATUSES.map((status) => [
          status,
          tableRows.reduce((total, row) => total + (row.statusBreakdown[status] ?? 0), 0),
        ]),
      ),
      physicalStatusBreakdown: {},
    };

    const availableFilters = await this.delegationRepository.find({
      relations: { region: true },
      order: { region: { sortOrder: 'ASC' }, sortOrder: 'ASC', name: 'ASC' },
    });

    const regionsMap = new Map<string, { regionId: string; regionName: string; delegations: { id: string; name: string }[] }>();

    for (const delegation of availableFilters) {
      if (!delegation.region) {
        continue;
      }

      if (!regionsMap.has(delegation.region.id)) {
        regionsMap.set(delegation.region.id, {
          regionId: delegation.region.id,
          regionName: delegation.region.name,
          delegations: [],
        });
      }

      regionsMap.get(delegation.region.id)!.delegations.push({ id: delegation.id, name: delegation.name });

      if (!delegationRows.has(delegation.id)) {
        delegationRows.set(delegation.id, {
          delegationId: delegation.id,
          delegationName: delegation.name,
          regionId: delegation.region.id,
          regionName: delegation.region.name,
          totalUnits: 0,
          vehicleClasses: new Map(),
        });
      }
    }

    const mapDelegations = Array.from(delegationRows.values())
      .map((delegationRow) => {
        const vehicleClasses = Array.from(delegationRow.vehicleClasses.values())
          .map((row) => ({
            vehicleClass: row.vehicleClass,
            totalUnits: row.totalUnits,
            totalActive: calculateNetActive(row.totalUnits, row.statusBreakdown),
          }))
          .sort((left, right) => right.totalUnits - left.totalUnits || left.vehicleClass.localeCompare(right.vehicleClass));

        return {
          delegationId: delegationRow.delegationId,
          delegationName: delegationRow.delegationName,
          regionId: delegationRow.regionId,
          regionName: delegationRow.regionName,
          totalUnits: delegationRow.totalUnits,
          totalActive: vehicleClasses.reduce((total, row) => total + row.totalActive, 0),
          dominantVehicleClass: vehicleClasses[0]?.vehicleClass ?? null,
          vehicleClasses,
        };
      })
      .sort((left, right) => left.regionName.localeCompare(right.regionName) || left.delegationName.localeCompare(right.delegationName));

    return {
      kpis: {
        totalRecords: records.length,
        totalRegions: new Set(records.map((record) => record.delegation?.region?.id).filter(Boolean)).size,
        totalDelegations: new Set(records.map((record) => record.delegation?.id).filter(Boolean)).size,
        totalActive: calculateNetActive(records.length, resume.statusBreakdown),
        notReported: 0,
        pendingChanges: 0,
        reportedWithoutChanges: 0,
        reportedWithChanges: 0,
      },
      table: {
        date: records.length > 0 ? records[0].createdAt : new Date().toISOString(),
        statuses: DIRECTOR_STATUSES,
        physicalStatuses: [],
        rows: tableRows,
        resume,
        customStatusDescriptions,
        observations,
      },
      map: { delegations: mapDelegations },
      filters: {
        selectedRegionId: regionId ?? null,
        selectedDelegationId: delegationId ?? null,
        regions: Array.from(regionsMap.values()),
      },
    };
  }

  async findDelegationVehicles(delegationId: string, dateFrom?: string, dateTo?: string) {
    const delegation = await this.delegationRepository.findOne({ where: { id: delegationId }, relations: { region: true } });

    if (!delegation) {
      throw new NotFoundException('No se encontro la delegacion.');
    }

    const query = this.recordRepository
      .createQueryBuilder('record')
      .innerJoinAndSelect('record.delegation', 'delegation')
      .innerJoinAndSelect('delegation.region', 'region')
      .leftJoinAndSelect('record.createdBy', 'createdBy')
      .leftJoinAndSelect('record.photos', 'photos')
      .where('delegation.id = :delegationId', { delegationId })
      .orderBy('record.createdAt', 'DESC');

    if (dateFrom) {
      query.andWhere('record.createdAt >= :dateFrom', { dateFrom: `${dateFrom}T00:00:00.000Z` });
    }

    if (dateTo) {
      query.andWhere('record.createdAt <= :dateTo', { dateTo: `${dateTo}T23:59:59.999Z` });
    }

    return query.getMany();
  }
}
