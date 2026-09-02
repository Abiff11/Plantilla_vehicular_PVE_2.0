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

  function createLegacyQuery(items: any[]) {
    return {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue(items),
    };
  }

  function createLookupRepo(stable: any[] = [], legacy: any[] = []) {
    const legacyQuery = createLegacyQuery(legacy);
    return {
      repo: {
        find: jest.fn().mockResolvedValue(stable),
        createQueryBuilder: jest.fn().mockReturnValue(legacyQuery),
      } as any,
      legacyQuery,
    };
  }

  it('returns UUID linked vehicles and marks each item source', async () => {
    const { repo } = createLookupRepo([{ ...baseRecord, custodianOficialId: officerId }]);
    const { service } = createService(repo);
    const result = await service.findVehiclesByOfficer(officerId, 'OFICIAL PRUEBA');
    expect(result.matchSource).toBe('UUID');
    expect(result.items).toHaveLength(1);
    expect(result.items[0].linkSource).toBe('UUID');
  });

  it('uses the legacy custodian name only for unlinked vehicles', async () => {
    const { repo, legacyQuery } = createLookupRepo([], [{ ...baseRecord, custodianOficialId: null }]);
    const { service } = createService(repo);
    const result = await service.findVehiclesByOfficer(officerId, 'OFICIAL PRUEBA');
    expect(result.matchSource).toBe('NOMBRE');
    expect(result.items[0].linkSource).toBe('NOMBRE');
    expect(repo.find).toHaveBeenCalledTimes(1);
    expect(legacyQuery.andWhere).toHaveBeenCalledWith(
      expect.stringContaining('STRING_AGG'),
      { nameSignature: 'OFICIAL PRUEBA' },
    );
  });

  it('keeps UUID-linked and pending legacy vehicles together', async () => {
    const secondRecord = { ...baseRecord, id: '33333333-3333-4333-8333-333333333333', patrolNumber: 'PV-002', custodianOficialId: null };
    const { repo } = createLookupRepo([{ ...baseRecord, custodianOficialId: officerId }], [secondRecord]);
    const { service } = createService(repo);
    const result = await service.findVehiclesByOfficer(officerId, 'OFICIAL PRUEBA');
    expect(result.matchSource).toBe('MIXTO');
    expect(result.items).toHaveLength(2);
    expect(result.items.map((item) => item.linkSource)).toEqual(['UUID', 'NOMBRE']);
  });

  it('does not attempt the legacy lookup without an officer name', async () => {
    const { repo } = createLookupRepo();
    const { service } = createService(repo);
    const result = await service.findVehiclesByOfficer(officerId);
    expect(result.matchSource).toBe('NINGUNO');
    expect(result.items).toEqual([]);
    expect(repo.find).toHaveBeenCalledTimes(1);
    expect(repo.createQueryBuilder).not.toHaveBeenCalled();
  });

  it.each([
    ['JOSÉ PÉREZ', 'JOSE PEREZ'],
    ['josé pérez', 'JOSE PEREZ'],
    ['  JOSÉ   PÉREZ  ', 'JOSE PEREZ'],
  ])('normalizes historical names before lookup: %s', async (officerName, expectedNameSignature) => {
    const { repo, legacyQuery } = createLookupRepo([], [{ ...baseRecord, custodian: 'JOSÉ PÉREZ', custodianOficialId: null }]);
    const { service } = createService(repo);

    const result = await service.findVehiclesByOfficer(officerId, officerName);

    expect(result.matchSource).toBe('NOMBRE');
    expect(result.items[0].linkSource).toBe('NOMBRE');
    expect(legacyQuery.andWhere).toHaveBeenCalledWith(
      expect.stringContaining('STRING_AGG'),
      { nameSignature: expectedNameSignature },
    );
  });

  it('matches any token order and strips only known legacy ranks', async () => {
    const record = {
      ...baseRecord,
      custodian: 'CMDTE. HUMBERTO JARQUIN VILLALOBOS',
      custodianOficialId: null,
    };
    const { repo, legacyQuery } = createLookupRepo([], [record]);
    const { service } = createService(repo);

    const result = await service.findVehiclesByOfficer(officerId, 'VILLALOBOS JARQUIN HUMBERTO');

    expect(result.matchSource).toBe('NOMBRE');
    expect(result.items[0].linkSource).toBe('NOMBRE');
    expect(legacyQuery.andWhere).toHaveBeenCalledWith(
      expect.stringContaining('(CMDTE|CMTE|COMANDANTE|OF)'),
      { nameSignature: 'HUMBERTO JARQUIN VILLALOBOS' },
    );
  });

  it.each(['OF. HUMBERTO JARQUIN VILLALOBOS', 'OF HUMBERTO JARQUIN VILLALOBOS'])(
    'reconoce el prefijo legacy %s sin afectar el nombre del oficial',
    async (custodian) => {
      const record = {
        ...baseRecord,
        custodian,
        custodianOficialId: null,
      };
      const { repo } = createLookupRepo([], [record]);
      const { service } = createService(repo);

      const result = await service.findVehiclesByOfficer(officerId, 'VILLALOBOS JARQUIN HUMBERTO');

      expect(result.matchSource).toBe('NOMBRE');
      expect(result.items[0].linkSource).toBe('NOMBRE');
      expect((service as any).namesEquivalent(custodian, 'VILLALOBOS JARQUIN HUMBERTO')).toBe(true);
    },
  );

  it('does not return a historical vehicle for a different normalized name', async () => {
    const { repo, legacyQuery } = createLookupRepo();
    const { service } = createService(repo);

    const result = await service.findVehiclesByOfficer(officerId, 'JOSE PEREZ GARCIA');

    expect(result.matchSource).toBe('NINGUNO');
    expect(result.items).toEqual([]);
    expect(legacyQuery.andWhere).toHaveBeenCalledWith(
      expect.stringContaining('STRING_AGG'),
      { nameSignature: 'GARCIA JOSE PEREZ' },
    );
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
    expect(result.item.linkSource).toBe('UUID');
    expect(repo.save).toHaveBeenCalledTimes(1);
    expect(auditLogs.register).toHaveBeenCalledWith(expect.objectContaining({
      action: 'LINK_CONTROL_PERSONAL_CUSTODIAN',
      entityId: record.id,
    }));
  });

  it('accepts a confirmed UUID link when the legacy custodian has a known rank and any name order', async () => {
    const record = {
      ...baseRecord,
      custodian: 'CMDTE. HUMBERTO JARQUIN VILLALOBOS',
      custodianOficialId: null,
    };
    const repo = {
      findOne: jest.fn().mockResolvedValue(record),
      save: jest.fn().mockImplementation(async (value) => value),
    } as any;
    const { service } = createService(repo);

    const result = await service.linkVehicleToOfficer(record.id, officerId, 'VILLALOBOS JARQUIN HUMBERTO');

    expect(record.custodianOficialId).toBe(officerId);
    expect(result.matchSource).toBe('UUID');
    expect(repo.save).toHaveBeenCalledTimes(1);
  });

  it('rejects linking a vehicle already linked to another officer', async () => {
    const repo = {
      findOne: jest.fn().mockResolvedValue({ ...baseRecord, custodianOficialId: '44444444-4444-4444-8444-444444444444' }),
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

  it('accepts arbitrary token permutations as the same person', async () => {
    const record = {
      ...baseRecord,
      custodian: 'CMDTE. VILLALOBOS HUMBERTO JARQUIN',
      custodianOficialId: null,
    };
    const repo = {
      findOne: jest.fn().mockResolvedValue(record),
      save: jest.fn().mockImplementation(async (value) => value),
    } as any;
    const { service } = createService(repo);

    const result = await service.linkVehicleToOfficer(baseRecord.id, officerId, 'VILLALOBOS JARQUIN HUMBERTO');

    expect(result.matchSource).toBe('UUID');
    expect(record.custodianOficialId).toBe(officerId);
    expect(repo.save).toHaveBeenCalledTimes(1);
  });

  it('does not discard an unknown leading token while comparing people', async () => {
    const repo = {
      findOne: jest.fn().mockResolvedValue({
        ...baseRecord,
        custodian: 'OTRO HUMBERTO VILLALOBOS JARQUIN',
        custodianOficialId: null,
      }),
    } as any;
    const { service } = createService(repo);

    await expect(service.linkVehicleToOfficer(baseRecord.id, officerId, 'VILLALOBOS JARQUIN HUMBERTO'))
      .rejects.toBeInstanceOf(BadRequestException);
  });
});
