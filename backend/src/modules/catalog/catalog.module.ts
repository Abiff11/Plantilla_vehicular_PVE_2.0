import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RecordEntity } from 'src/modules/records/entities/record.entity';
import { UserEntity } from 'src/modules/users/entities/user.entity';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';
import { CatalogAliasEntity } from './entities/catalog-alias.entity';
import { CatalogGroupEntity } from './entities/catalog-group.entity';
import { CatalogItemEntity } from './entities/catalog-item.entity';
import { DelegationEntity } from './entities/delegation.entity';
import { RegionEntity } from './entities/region.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CatalogAliasEntity,
      CatalogGroupEntity,
      CatalogItemEntity,
      RegionEntity,
      DelegationEntity,
      UserEntity,
      RecordEntity,
    ]),
  ],
  controllers: [CatalogController],
  providers: [CatalogService],
  exports: [CatalogService, TypeOrmModule],
})
export class CatalogModule {}
