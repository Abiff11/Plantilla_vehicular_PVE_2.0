import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLogsService } from 'src/modules/audit-logs/audit-logs.service';
import { RecordEntity } from 'src/modules/records/entities/record.entity';
import { UserEntity } from 'src/modules/users/entities/user.entity';
import { REGION_CATALOG } from './catalog.seed';
import { CreateCatalogAliasDto } from './dto/create-catalog-alias.dto';
import { CreateCatalogGroupDto } from './dto/create-catalog-group.dto';
import { CreateCatalogItemDto } from './dto/create-catalog-item.dto';
import { UpdateCatalogItemDto } from './dto/update-catalog-item.dto';
import { DYNAMIC_CATALOG_SEED } from './dynamic-catalog.seed';
import { CatalogAliasEntity } from './entities/catalog-alias.entity';
import { CatalogGroupEntity } from './entities/catalog-group.entity';
import { CatalogItemEntity } from './entities/catalog-item.entity';
import { DelegationEntity } from './entities/delegation.entity';
import { RegionEntity } from './entities/region.entity';
import { RECORD_FIELD_CATALOG } from './record-field-catalog';

type AuthUser = {
  sub: string;
};

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
    private readonly auditLogsService: AuditLogsService,
  ) {}

  async onApplicationBootstrap() {
    await this.removeObsoleteCatalog();
    await this.seedRegionCatalog();
    await this.seedDynamicCatalogs();
  }

  findAllCatalogGroups() {
    return this.catalogGroupRepository.find({
      relations: {
        items: {
          aliases: true,
        },
      },
      order: {
        sortOrder: 'ASC',
        items: {
          sortOrder: 'ASC',
          label: 'ASC',
        },
      },
    });
  }

  async createCatalogGroup(dto: CreateCatalogGroupDto, actor: AuthUser) {
    const code = normalizeCatalogCode(dto.code);
    const existingGroup = await this.catalogGroupRepository.findOne({
      where: { code },
      withDeleted: true,
    });

    if (existingGroup) {
      throw new ConflictException(`El catalogo '${code}' ya existe.`);
    }

    const group = await this.catalogGroupRepository.save(
      this.catalogGroupRepository.create({
        code,
        name: normalizeCatalogLabel(dto.name),
        description: normalizeCatalogText(dto.description ?? ''),
        isSystem: false,
      }),
    );

    await this.auditLogsService.register({
      actorId: actor.sub,
      action: 'CATALOG_GROUP_CREATED',
      entityType: 'catalog_group',
      entityId: group.id,
      metadata: {
        code: group.code,
        name: group.name,
      },
    });

    return group;
  }

  async findCatalogItemsByGroupCode(groupCode: string) {
    const group = await this.findCatalogGroupByCodeOrFail(groupCode);

    return this.catalogItemRepository.find({
      where: {
        group: { id: group.id },
      },
      relations: {
        group: true,
        aliases: true,
      },
      order: {
        sortOrder: 'ASC',
        label: 'ASC',
      },
    });
  }

  async createCatalogItem(groupCode: string, dto: CreateCatalogItemDto, actor: AuthUser) {
    const group = await this.findCatalogGroupByCodeOrFail(groupCode);
    const code = normalizeCatalogCode(dto.code);
    const existingItem = await this.catalogItemRepository.findOne({
      where: {
        group: { id: group.id },
        code,
      },
      relations: {
        group: true,
      },
      withDeleted: true,
    });

    if (existingItem) {
      throw new ConflictException(
        `El valor '${code}' ya existe en el catalogo '${group.code}'.`,
      );
    }

    const item = await this.catalogItemRepository.save(
      this.catalogItemRepository.create({
        group,
        code,
        label: normalizeCatalogLabel(dto.label),
        normalizedValue: normalizeCatalogLabel(dto.normalizedValue ?? dto.label),
        metadata: dto.metadata ?? {},
        isActive: dto.isActive ?? true,
      }),
    );

    await this.auditLogsService.register({
      actorId: actor.sub,
      action: 'CATALOG_ITEM_CREATED',
      entityType: 'catalog_item',
      entityId: item.id,
      metadata: {
        groupCode: group.code,
        code: item.code,
        label: item.label,
      },
    });

    return item;
  }

  async updateCatalogItem(id: string, dto: UpdateCatalogItemDto, actor: AuthUser) {
    const item = await this.catalogItemRepository.findOne({
      where: { id },
      relations: {
        group: true,
        aliases: true,
      },
    });

    if (!item) {
      throw new NotFoundException('No se encontro el valor del catalogo.');
    }

    const before = {
      label: item.label,
      normalizedValue: item.normalizedValue,
      metadata: item.metadata,
      isActive: item.isActive,
    };

    if (dto.label !== undefined) {
      item.label = normalizeCatalogLabel(dto.label);
    }

    if (dto.normalizedValue !== undefined) {
      item.normalizedValue = normalizeCatalogLabel(dto.normalizedValue);
    }

    if (dto.metadata !== undefined) {
      item.metadata = dto.metadata;
    }

    if (dto.isActive !== undefined) {
      item.isActive = dto.isActive;
    }

    const savedItem = await this.catalogItemRepository.save(item);

    await this.auditLogsService.register({
      actorId: actor.sub,
      action: 'CATALOG_ITEM_UPDATED',
      entityType: 'catalog_item',
      entityId: savedItem.id,
      metadata: {
        groupCode: savedItem.group.code,
        code: savedItem.code,
        before,
        after: {
          label: savedItem.label,
          normalizedValue: savedItem.normalizedValue,
          metadata: savedItem.metadata,
          isActive: savedItem.isActive,
        },
      },
    });

    return savedItem;
  }

  async softDeleteCatalogItem(id: string, actor: AuthUser) {
    const item = await this.catalogItemRepository.findOne({
      where: { id },
      relations: {
        group: true,
      },
    });

    if (!item) {
      throw new NotFoundException('No se encontro el valor del catalogo.');
    }

    await this.catalogItemRepository.softDelete(id);

    await this.auditLogsService.register({
      actorId: actor.sub,
      action: 'CATALOG_ITEM_DELETED',
      entityType: 'catalog_item',
      entityId: item.id,
      metadata: {
        groupCode: item.group.code,
        code: item.code,
        label: item.label,
      },
    });

    return { success: true };
  }

  async createCatalogAlias(itemId: string, dto: CreateCatalogAliasDto, actor: AuthUser) {
    const item = await this.catalogItemRepository.findOne({
      where: { id: itemId },
      relations: {
        group: true,
      },
    });

    if (!item) {
      throw new NotFoundException('No se encontro el valor del catalogo.');
    }

    const rawValue = normalizeCatalogText(dto.rawValue);
    const normalizedRawValue = normalizeCatalogValue(rawValue);
    const existingAlias = await this.catalogAliasRepository.findOne({
      where: {
        catalogItem: { id: item.id },
        normalizedRawValue,
      },
      relations: {
        catalogItem: true,
      },
      withDeleted: true,
    });

    if (existingAlias) {
      throw new ConflictException('El alias ya existe para este valor de catalogo.');
    }

    const alias = await this.catalogAliasRepository.save(
      this.catalogAliasRepository.create({
        catalogItem: item,
        rawValue,
        normalizedRawValue,
        source: normalizeCatalogText(dto.source ?? 'manual'),
      }),
    );

    await this.auditLogsService.register({
      actorId: actor.sub,
      action: 'CATALOG_ALIAS_CREATED',
      entityType: 'catalog_alias',
      entityId: alias.id,
      metadata: {
        groupCode: item.group.code,
        itemCode: item.code,
        rawValue: alias.rawValue,
        normalizedRawValue: alias.normalizedRawValue,
        source: alias.source,
      },
    });

    return alias;
  }

  private async findCatalogGroupByCodeOrFail(code: string) {
    const group = await this.catalogGroupRepository.findOne({
      where: { code: normalizeCatalogCode(code) },
    });

    if (!group) {
      throw new NotFoundException('No se encontro el catalogo solicitado.');
    }

    return group;
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

function normalizeCatalogText(value: string) {
  return value.trim().replace(/\s+/g, ' ');
}

function normalizeCatalogLabel(value: string) {
  return normalizeCatalogText(value).toUpperCase();
}

function normalizeCatalogCode(value: string) {
  return normalizeCatalogValue(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '')
    .replace(/[^A-Z0-9]+/gu, '_')
    .replace(/^_+|_+$/gu, '');
}
