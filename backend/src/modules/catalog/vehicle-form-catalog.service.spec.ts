import { VehicleFormCatalogService } from './vehicle-form-catalog.service';

describe('VehicleFormCatalogService', () => {
  it('builds form options only from active managed catalog items', async () => {
    const repository = {
      find: jest.fn().mockResolvedValue([
        {
          code: 'adscription',
          items: [
            {
              label: 'GRUPO MOTORIZADO',
              normalizedValue: 'GRUPO MOTORIZADO',
              isActive: true,
            },
            {
              label: 'ADSCRIPCION INACTIVA',
              normalizedValue: 'ADSCRIPCION INACTIVA',
              isActive: false,
            },
          ],
        },
      ]),
    };

    const service = new VehicleFormCatalogService(repository as never);
    const result = await service.getRecordFieldCatalog();

    expect(result.adscription).toEqual({
      label: 'Adscripción',
      allowsCustom: true,
      options: [
        {
          value: 'GRUPO MOTORIZADO',
          label: 'GRUPO MOTORIZADO',
        },
      ],
    });
    expect(result.brand.options).toEqual([]);
  });
});
