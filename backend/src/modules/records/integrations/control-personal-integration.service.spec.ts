import { BadRequestException, ConflictException } from '@nestjs/common';
import { ControlPersonalIntegrationService } from './control-personal-integration.service';

describe('ControlPersonalIntegrationService', () => {
  const officerId = '11111111-1111-4111-8111-111111111111';
  const baseRecord = {
    id: '22222222-2222-4222-8222-222222222222',
    patrolNumber: 'PV-001',
    plates: 'ABC123',
    brand: 'DODGE',
    type: 'CHARGER',
    vehicleClass: 'PATRULLA',
    model: '2024',
    serialNumber: 'SERIE-1',
    physicalStatus: 'BUENO',
    status: 'ACTIVO',
    adscription: 'PLAZA',
    realLocation: 'CUARTEL',
    custodian: 'OFICIAL PRUEBA',
  } as any;

  function createService(repo: any) {
    const auditLogs = { register: jest.fn().mockResolvedValue(undefined) } as any;
    return { service: new ControlPersonalIntegrationService(repo, auditLogs), auditLogs };
  }

  it('prioritizes the stable Control Personal UUID link', async () => {
    const repo = { find: jest.fn().mockResolvedValueOnce([{ ...baseRecord, custodianOficialId: officerId }]) } as any;
    const { service } = createService(repo);
    const result = await service.findVehiclesByOfficer(officerId, 'OFICIAL PRUEBA');
    expect(result.matchSource).toBe('UUID');
    expect(result.items).toHaveLength(1);
    expect(repo.find).toHaveBeenCalledTimes(1);
  });

  it('uses the legacy custodian name only when no UUID link exists', async () => {
    const repo = {
      find: jest.fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ ...baseRecord, custodianOficialId: null }]),
    } as any;
    const { service } = createService(repo);
    const result = await service.findVehiclesByOfficer(officerId, 'OFICIAL PRUEBA');
    expect(result.matchSource).toBe('NOMBRE');
    expect(result.items[0].patrolNumber).toBe('PV-001');
    expect(repo.find).toHaveBeenCalledTimes(2);
  });

  it('does not attempt the legacy lookup without an officer name', async () => {
    const repo = { find: jest.fn().mockResolvedValueOnce([]) } as any;
    const { service } = createService(repo);
    const result = await service.findVehiclesByOfficer(officerId);
    expect(result.matchSource).toBe('UUID');
    expect(result.items).toEqual([]);
    expect(repo.find).toHaveBeenCalledTimes(1);
  });

  it('persists a confirmed UUID link and audits it', async () => {
    const record = { ...baseRecord, custodianOficialId: null };
    const repo = {
      findOne: jest.fn().mockResolvedValue(record),
      save: jest.fn().mockImplementation(async (value) => value),
    } as any;
    const { service, auditLogs } = createService(repo);

    const result = await service.linkVehicleToOfficer(record.id, officerId, 'Oficial Prueba');

    expect(record.custodianOficialId).toBe(officerId);
    expect(result.matchSource).toBe('UUID');
    expect(repo.save).toHaveBeenCalledTimes(1);
    expect(auditLogs.register).toHaveBeenCalledWith(expect.objectContaining({
      action: 'LINK_CONTROL_PERSONAL_CUSTODIAN',
      entityId: record.id,
    }));
  });

  it('rejects linking a vehicle already linked to another officer', async () => {
    const repo = {
      findOne: jest.fn().mockResolvedValue({ ...baseRecord, custodianOficialId: '33333333-3333-4333-8333-333333333333' }),
    } as any;
    const { service } = createService(repo);

    await expect(service.linkVehicleToOfficer(baseRecord.id, officerId, 'OFICIAL PRUEBA'))
      .rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects a confirmation when the visible custodian does not match', async () => {
    const repo = {
      findOne: jest.fn().mockResolvedValue({ ...baseRecord, custodian: 'OTRO RESGUARDANTE', custodianOficialId: null }),
    } as any;
    const { service } = createService(repo);

    await expect(service.linkVehicleToOfficer(baseRecord.id, officerId, 'OFICIAL PRUEBA'))
      .rejects.toBeInstanceOf(BadRequestException);
  });
});
