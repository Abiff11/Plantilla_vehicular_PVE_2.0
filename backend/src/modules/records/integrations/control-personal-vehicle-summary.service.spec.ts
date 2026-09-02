import { BadRequestException } from '@nestjs/common';
import { ControlPersonalIntegrationService } from './control-personal-integration.service';

describe('ControlPersonalIntegrationService vehicle summary', () => {
  const officerA = { id: '11111111-1111-4111-8111-111111111111', name: 'OFICIAL PRUEBA' };
  const officerB = { id: '22222222-2222-4222-8222-222222222222', name: 'VILLALOBOS JARQUIN HUMBERTO' };

  function createService(stable: any[] = [], legacy: any[] = []) {
    const query = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue(legacy),
    };
    const repo = {
      find: jest.fn().mockResolvedValue(stable),
      createQueryBuilder: jest.fn().mockReturnValue(query),
    } as any;
    const auditLogs = { register: jest.fn() } as any;
    return {
      service: new ControlPersonalIntegrationService(repo, auditLogs),
      repo,
      query,
    };
  }

  it('combina vínculos UUID y resguardantes legacy en un solo resumen masivo', async () => {
    const stable = [
      { id: 'v1', patrolNumber: 'PV-001', custodianOficialId: officerA.id },
      { id: 'v2', patrolNumber: 'PV-002', custodianOficialId: officerA.id },
    ];
    const legacy = [
      {
        id: 'v3',
        patrolNumber: 'PV-003',
        custodianOficialId: null,
        custodian: 'CMDTE. HUMBERTO VILLALOBOS JARQUIN',
      },
    ];
    const { service, repo } = createService(stable, legacy);

    const result = await service.summarizeVehiclesByOfficers([officerA, officerB]);

    expect(result.items).toEqual([
      { officerId: officerA.id, count: 2 },
      { officerId: officerB.id, count: 1 },
    ]);
    expect(repo.find).toHaveBeenCalledTimes(1);
    expect(repo.createQueryBuilder).toHaveBeenCalledTimes(1);
  });

  it('considera equivalente el nombre completo aunque sus palabras estén en cualquier orden', async () => {
    const officer = {
      id: officerB.id,
      name: 'CARREÑO ARMENTA HIRAM',
    };
    const legacy = [
      {
        id: 'v-order',
        patrolNumber: 'PV-ORDER',
        custodianOficialId: null,
        custodian: 'CMDTE. HIRAM ARMENTA CARREÑO',
      },
    ];
    const { service } = createService([], legacy);

    const result = await service.summarizeVehiclesByOfficers([officer]);

    expect(result.items).toEqual([
      { officerId: officer.id, count: 1 },
    ]);
    expect((service as any).namesEquivalent(
      'HIRAM CARREÑO ARMENTA',
      'ARMENTA HIRAM CARREÑO',
    )).toBe(true);
  });

  it('no atribuye un resguardo legacy cuando el nombre resulta ambiguo entre oficiales', async () => {
    const { service } = createService([], [
      {
        id: 'v1',
        patrolNumber: 'PV-001',
        custodianOficialId: null,
        custodian: 'JOSE PEREZ',
      },
    ]);

    const result = await service.summarizeVehiclesByOfficers([
      { id: officerA.id, name: 'JOSE PEREZ' },
      { id: officerB.id, name: 'PEREZ JOSE' },
    ]);

    expect(result.items).toEqual([
      { officerId: officerA.id, count: 0 },
      { officerId: officerB.id, count: 0 },
    ]);
  });

  it('limita el tamaño de la solicitud masiva', async () => {
    const { service } = createService();
    const officers = Array.from({ length: 1001 }, (_, index) => ({
      id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
      name: `OFICIAL ${index}`,
    }));

    await expect(service.summarizeVehiclesByOfficers(officers))
      .rejects.toBeInstanceOf(BadRequestException);
  });
});
