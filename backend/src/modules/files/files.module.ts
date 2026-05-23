import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { MessagePhotoEntity } from "src/modules/messages/entities/message-photo.entity";
import { VehiclePhotoEntity } from "src/modules/records/entities/vehicle-photo.entity";
import { StorageModule } from "src/modules/storage/storage.module";
import { FilesController } from "./files.controller";

@Module({
  imports: [
    TypeOrmModule.forFeature([MessagePhotoEntity, VehiclePhotoEntity]),
    StorageModule,
  ],
  controllers: [FilesController],
})
export class FilesModule {}
