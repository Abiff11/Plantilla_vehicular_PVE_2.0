import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { AuditLogsService } from 'src/modules/audit-logs/audit-logs.service';
import { RecordEntity } from '../entities/record.entity';

@Injectable()
export class ControlPersonalIntegrationService {
  constructor(
    @InjectRepository(RecordEntity) private readonly recordsRepo: Repository<RecordEntity>,
    private readonly auditLogs: AuditLogsService,
  ) {}

  async findVehiclesByOfficer(officerId: string, officerName?: string) {
    const stable = await this.recordsRepo.find({ where: { custodianOficialId: officerId }, order: { patrolNumber: 'ASC' } });
    if (stable.length || !officerName?.trim()) return { matchSource: 'UUID', items: stable.map((item) => this.toView(item)) };

    const legacy = await this.recordsRepo.find({ where: { custodian: ILike(officerName.trim()) }, order: { patrolNumber: 'ASC' } });
    return { matchSource: legacy.length ? 'NOMBRE' : 'NINGUNO', items: legacy.map((item) => this.toView(item)) };
  }

  async linkVehicleToOfficer(recordId: string, officerId: string, officerName: string) {
    const record = await this.recordsRepo.findOne({ where: { id: recordId } });
    if (!record) throw new NotFoundException('Vehículo no encontrado');

    if (record.custodianOficialId && record.custodianOficialId !== officerId) {
      throw new ConflictException('El vehículo ya está vinculado a otro oficial');
    }

    if (this.normalizeName(record.custodian) !== this.normalizeName(officerName)) {
      throw new BadRequestException('El resguardante del vehículo no coincide con el oficial que se intenta vincular');
    }

    if (record.custodianOficialId === officerId) {
      return { matchSource: 'UUID' as const, item: this.toView(record) };
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

    return { matchSource: 'UUID' as const, item: this.toView(saved) };
  }

  private normalizeName(value: string) {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/gu, '')
      .replace(/\s+/gu, ' ')
      .trim()
      .toUpperCase();
  }

  private toView(record: RecordEntity) {
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
    };
  }
}
