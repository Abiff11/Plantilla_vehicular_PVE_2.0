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
  } as any;

  it('prioritizes the stable Control Personal UUID link', async () => {
    const repo = { find: jest.fn().mockResolvedValueOnce([{ ...baseRecord, custodianOficialId: officerId }]) } as any;
    const service = new ControlPersonalIntegrationService(repo);
    const result = await service.findVehiclesByOfficer(officerId, 'OFICIAL PRUEBA');
    expect(result.matchSource).toBe('UUID');
    expect(result.items).toHaveLength(1);
    expect(repo.find).toHaveBeenCalledTimes(1);
  });

  it('uses the legacy custodian name only when no UUID link exists', async () => {
    const repo = {
      find: jest.fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ ...baseRecord, custodianOficialId: null, custodian: 'OFICIAL PRUEBA' }]),
    } as any;
    const service = new ControlPersonalIntegrationService(repo);
    const result = await service.findVehiclesByOfficer(officerId, 'OFICIAL PRUEBA');
    expect(result.matchSource).toBe('NOMBRE');
    expect(result.items[0].patrolNumber).toBe('PV-001');
    expect(repo.find).toHaveBeenCalledTimes(2);
  });

  it('does not attempt the legacy lookup without an officer name', async () => {
    const repo = { find: jest.fn().mockResolvedValueOnce([]) } as any;
    const service = new ControlPersonalIntegrationService(repo);
    const result = await service.findVehiclesByOfficer(officerId);
    expect(result.matchSource).toBe('UUID');
    expect(result.items).toEqual([]);
    expect(repo.find).toHaveBeenCalledTimes(1);
  });
});
