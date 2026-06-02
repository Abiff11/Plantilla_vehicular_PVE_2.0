import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLogsModule } from 'src/modules/audit-logs/audit-logs.module';
import { AuditLogEntity } from 'src/modules/audit-logs/entities/audit-log.entity';
import { CatalogAliasEntity } from 'src/modules/catalog/entities/catalog-alias.entity';
import { CatalogGroupEntity } from 'src/modules/catalog/entities/catalog-group.entity';
import { CatalogItemEntity } from 'src/modules/catalog/entities/catalog-item.entity';
import { DelegationEntity } from 'src/modules/catalog/entities/delegation.entity';
import { UserEntity } from 'src/modules/users/entities/user.entity';
import { RecordEntity } from './entities/record.entity';
import { VehicleImportBatchEntity } from './entities/vehicle-import-batch.entity';
import { VehicleImportErrorEntity } from './entities/vehicle-import-error.entity';
import { VehiclePhotoEntity } from './entities/vehicle-photo.entity';
import { VehicleRosterReportEntity } from './entities/vehicle-roster-report.entity';
import { VehicleTransferEntity } from './entities/vehicle-transfer.entity';
import { RecordsImportController } from './imports/records-import.controller';
import { RecordsImportService } from './imports/records-import.service';
import { RecordsController } from './records.controller';
import { RecordsService } from './records.service';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AuditLogEntity,
      CatalogAliasEntity,
      CatalogGroupEntity,
      CatalogItemEntity,
      DelegationEntity,
      RecordEntity,
      UserEntity,
      VehicleImportBatchEntity,
      VehicleImportErrorEntity,
      VehiclePhotoEntity,
      VehicleRosterReportEntity,
      VehicleTransferEntity,
    ]),
    AuditLogsModule,
    StorageModule,
  ],
  controllers: [RecordsController, RecordsImportController],
  providers: [RecordsService, RecordsImportService],
})
export class RecordsModule {}
