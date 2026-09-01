import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CatalogGroupEntity } from './entities/catalog-group.entity';

type VehicleFormCatalogDefinition = {
  groupCode: string;
  label: string;
  allowsCustom: boolean;
};

const VEHICLE_FORM_CATALOGS = {
  useType: { groupCode: 'vehicle_use', label: 'Uso', allowsCustom: true },
  vehicleClass: { groupCode: 'vehicle_class', label: 'Clase de vehiculo', allowsCustom: false },
  physicalStatus: { groupCode: 'physical_status', label: 'Estado fisico', allowsCustom: false },
  status: { groupCode: 'system_status', label: 'Estatus', allowsCustom: true },
  assetClassification: {
    groupCode: 'asset_classification',
    label: 'Clasificacion del bien',
    allowsCustom: true,
  },
  brand: { groupCode: 'vehicle_brand', label: 'Marca', allowsCustom: false },
  type: { groupCode: 'vehicle_type', label: 'Tipo', allowsCustom: false },
  color: { groupCode: 'vehicle_color', label: 'Color', allowsCustom: false },
  adscription: { groupCode: 'adscription', label: 'Adscripcion', allowsCustom: false },
  realLocation: { groupCode: 'real_location', label: 'Ubicacion real', allowsCustom: false },
  rawCirculationStatus: {
    groupCode: 'circulation_status',
    label: 'Estatus Excel',
    allowsCustom: false,
  },
  sourceSection: {
    groupCode: 'excel_section',
    label: 'Seccion Excel',
    allowsCustom: false,
  },
} satisfies Record<string, VehicleFormCatalogDefinition>;

@Injectable()
export class VehicleFormCatalogService {
  constructor(
    @InjectRepository(CatalogGroupEntity)
    private readonly catalogGroupRepository: Repository<CatalogGroupEntity>,
  ) {}

  async getRecordFieldCatalog() {
    const groupCodes = Object.values(VEHICLE_FORM_CATALOGS).map((entry) => entry.groupCode);
    const groups = await this.catalogGroupRepository.find({
      where: groupCodes.map((code) => ({ code })),
      relations: { items: true },
      order: {
        items: {
          sortOrder: 'ASC',
          label: 'ASC',
        },
      },
    });

    const groupsByCode = new Map(groups.map((group) => [group.code, group]));

    return Object.fromEntries(
      Object.entries(VEHICLE_FORM_CATALOGS).map(([fieldName, definition]) => {
        const group = groupsByCode.get(definition.groupCode);
        const options = (group?.items ?? [])
          .filter((item) => item.isActive)
          .map((item) => ({
            value: item.normalizedValue || item.label,
            label: item.label,
          }));

        return [
          fieldName,
          {
            label: definition.label,
            allowsCustom: definition.allowsCustom,
            options,
          },
        ];
      }),
    );
  }
}
