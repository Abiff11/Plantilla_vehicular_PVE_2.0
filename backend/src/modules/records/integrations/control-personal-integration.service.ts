import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { RecordEntity } from '../entities/record.entity';

@Injectable()
export class ControlPersonalIntegrationService {
  constructor(@InjectRepository(RecordEntity) private readonly recordsRepo: Repository<RecordEntity>) {}

  async findVehiclesByOfficer(officerId: string, officerName?: string) {
    const stable = await this.recordsRepo.find({ where: { custodianOficialId: officerId }, order: { patrolNumber: 'ASC' } });
    if (stable.length || !officerName?.trim()) return { matchSource: 'UUID', items: stable.map((item) => this.toView(item)) };

    const legacy = await this.recordsRepo.find({ where: { custodian: ILike(officerName.trim()) }, order: { patrolNumber: 'ASC' } });
    return { matchSource: legacy.length ? 'NOMBRE' : 'NINGUNO', items: legacy.map((item) => this.toView(item)) };
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
