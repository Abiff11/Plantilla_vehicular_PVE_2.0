import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RecordEntity } from 'src/modules/records/entities/record.entity';
import { UserEntity } from 'src/modules/users/entities/user.entity';
import { REGION_CATALOG } from './catalog.seed';
import { DYNAMIC_CATALOG_SEED } from './dynamic-catalog.seed';
import { CatalogAliasEntity } from './entities/catalog-alias.entity';
import { CatalogGroupEntity } from './entities/catalog-group.entity';
import { CatalogItemEntity } from './entities/catalog-item.entity';
import { DelegationEntity } from './entities/delegation.entity';
import { RegionEntity } from './entities/region.entity';
import { RECORD_FIELD_CATALOG } from './record-field-catalog';

@Injectable()
export class CatalogService implements OnApplicationBootstrap {
  private readonly logger = new Logger(CatalogService.name);

  constructor(
    @InjectRepository(RegionEntity)
    private readonly regionRepository: Repository<RegionEntity>,
    @InjectRepository(DelegationEntity)
    private readonly delegationRepository: Repository<DelegationEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    @InjectRepository(RecordEntity)
    private readonly recordRepository: Repository<RecordEntity>,
    @InjectRepository(CatalogGroupEntity)
    private readonly catalogGroupRepository: Repository<CatalogGroupEntity>,
    @InjectRepository(CatalogItemEntity)
    private readonly catalogItemRepository: Repository<CatalogItemEntity>,
    @InjectRepository(CatalogAliasEntity)
    private readonly catalogAliasRepository: Repository<CatalogAliasEntity>,
  ) {}

  async onApplicationBootstrap() {
    await this.removeObsoleteCatalog();
    await this.seedRegionCatalog();
    await this.seedDynamicCatalogs();
  }

  private async seedRegionCatalog() {
    for (const regionSeed of REGION_CATALOG) {
      const existingRegion = await this.regionRepository.findOne({
        where: [{ code: regionSeed.code }, { name: regionSeed.name }],
      });

      const region = await this.regionRepository.save(
        this.regionRepository.create({
          id: existingRegion?.id,
          code: regionSeed.code,
          name: regionSeed.name,
          sortOrder: regionSeed.sortOrder,
        }),
      );

      for (const delegationSeed of regionSeed.delegations) {
        const existingDelegation = await this.delegationRepository.findOne({
          where: {
            name: delegationSeed.name,
            region: {
              id: region.id,
            },
          },
          relations: {
            region: true,
          },
        });

        await this.delegationRepository.save(
          this.delegationRepository.create({
            id: existingDelegation?.id,
            name: delegationSeed.name,
            sortOrder: delegationSeed.sortOrder,
            region,
          }),
        );
      }
    }
  }

  private async seedDynamicCatalogs() {
    for (const groupSeed of DYNAMIC_CATALOG_SEED) {
      const existingGroup = await this.catalogGroupRepository.findOne({
        where: { code: groupSeed.code },
      });

      const group = await this.catalogGroupRepository.save(
        this.catalogGroupRepository.create({
          id: existingGroup?.id,
          code: groupSeed.code,
          name: existingGroup?.name ?? groupSeed.name,
          description: existingGroup?.description ?? groupSeed.description,
          isSystem: true,
          sortOrder: existingGroup?.sortOrder ?? groupSeed.sortOrder,
        }),
      );

      for (const itemSeed of groupSeed.items) {
        const existingItem = await this.catalogItemRepository.findOne({
          where: {
            group: { id: group.id },
            code: itemSeed.code,
          },
          relations: {
            group: true,
          },
        });

        const item = await this.catalogItemRepository.save(
          this.catalogItemRepository.create({
            id: existingItem?.id,
            group,
            code: itemSeed.code,
            label: existingItem?.label ?? itemSeed.label,
            normalizedValue:
              existingItem?.normalizedValue ?? itemSeed.normalizedValue ?? itemSeed.label,
            metadata: existingItem?.metadata ?? itemSeed.metadata ?? {},
            isActive: existingItem?.isActive ?? true,
            sortOrder: existingItem?.sortOrder ?? itemSeed.sortOrder ?? 0,
          }),
        );

        for (const aliasSeed of itemSeed.aliases ?? []) {
          const normalizedRawValue = normalizeCatalogValue(aliasSeed.rawValue);
          const existingAlias = await this.catalogAliasRepository.findOne({
            where: {
              catalogItem: { id: item.id },
              normalizedRawValue,
            },
            relations: {
              catalogItem: true,
            },
          });

          if (existingAlias) {
            continue;
          }

          await this.catalogAliasRepository.save(
            this.catalogAliasRepository.create({
              catalogItem: item,
              rawValue: aliasSeed.rawValue,
              normalizedRawValue,
              source: aliasSeed.source ?? 'seed',
            }),
          );
        }
      }
    }
  }

  private async removeObsoleteCatalog() {
    const allowedRegionCodes = new Set<string>(REGION_CATALOG.map((region) => region.code));
    const allowedDelegationNamesByRegion = new Map<string, Set<string>>(
      REGION_CATALOG.map((region) => [
        region.code,
        new Set<string>(region.delegations.map((delegation) => delegation.name)),
      ]),
    );

    const regions = await this.regionRepository.find({
      relations: {
        delegations: true,
      },
    });

    for (const region of regions) {
      const shouldKeepRegion = allowedRegionCodes.has(region.code);

      for (const delegation of region.delegations) {
        const shouldKeepDelegation =
          shouldKeepRegion &&
          (allowedDelegationNamesByRegion.get(region.code)?.has(delegation.name) ?? false);

        if (shouldKeepDelegation) {
          continue;
        }

        const [usersCount, recordsCount] = await Promise.all([
          this.userRepository.count({
            where: {
              delegation: {
                id: delegation.id,
              },
            },
          }),
          this.recordRepository.count({
            where: {
              delegation: {
                id: delegation.id,
              },
            },
          }),
        ]);

        if (usersCount === 0 && recordsCount === 0) {
          await this.delegationRepository.remove(delegation);
          continue;
        }

        this.logger.warn(
          `Delegation "${delegation.name}" was kept because it has ${usersCount} users and ${recordsCount} records.`,
        );
      }

      if (shouldKeepRegion) {
        continue;
      }

      const remainingDelegations = await this.delegationRepository.count({
        where: {
          region: {
            id: region.id,
          },
        },
      });
      const usersCount = await this.userRepository.count({
        where: {
          region: {
            id: region.id,
          },
        },
      });

      if (remainingDelegations === 0 && usersCount === 0) {
        await this.regionRepository.remove(region);
        continue;
      }

      this.logger.warn(
        `Region "${region.name}" was kept because it still has ${remainingDelegations} delegations or ${usersCount} users.`,
      );
    }
  }

  findAllRegions() {
    return this.regionRepository.find({
      relations: {
        delegations: true,
      },
      order: {
        sortOrder: 'ASC',
        delegations: {
          sortOrder: 'ASC',
        },
      },
    });
  }

  getRecordFieldCatalog() {
    return RECORD_FIELD_CATALOG;
  }
}

function normalizeCatalogValue(value: string) {
  return value.trim().replace(/\s+/g, ' ').toUpperCase();
}
