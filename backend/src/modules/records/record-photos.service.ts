import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Role } from "src/common/enums/role.enum";
import { AuditLogsService } from "src/modules/audit-logs/audit-logs.service";
import { RealtimeGateway } from "src/modules/realtime/realtime.gateway";
import { UserEntity } from "src/modules/users/entities/user.entity";
import { StorageService } from "src/modules/storage/storage.service";
import { RecordEntity } from "./entities/record.entity";
import { VehiclePhotoEntity } from "./entities/vehicle-photo.entity";
import { RecordsService } from "./records.service";

type UploadedFile = {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
};

type AuthUser = {
  sub: string;
  role: Role;
  regionId: string | null;
  delegationId: string | null;
};

@Injectable()
export class RecordPhotosService {
  constructor(
    @InjectRepository(RecordEntity)
    private readonly recordRepository: Repository<RecordEntity>,
    @InjectRepository(VehiclePhotoEntity)
    private readonly photoRepository: Repository<VehiclePhotoEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    private readonly storageService: StorageService,
    private readonly auditLogsService: AuditLogsService,
    private readonly realtimeGateway: RealtimeGateway,
    private readonly recordsService: RecordsService,
  ) {}

  async addPhotos(recordId: string, photos: UploadedFile[], authUser: AuthUser) {
    const record = await this.findRecord(recordId);
    this.ensureAccess(record, authUser);

    const uploadedBy = await this.userRepository.findOneBy({ id: authUser.sub });
    if (!uploadedBy) {
      throw new NotFoundException("No se encontro el usuario.");
    }

    const hasPrimary = record.photos.some((photo) => photo.isPrimary);
    const storedPhotos = await Promise.all(
      photos.map((photo) =>
        this.storageService.saveFile({
          folder: "vehicle-photos",
          file: photo,
        }),
      ),
    );

    const entities = storedPhotos.map((storedPhoto, index) =>
      this.photoRepository.create({
        fileName: storedPhoto.originalName,
        filePath: storedPhoto.fileName,
        objectKey: storedPhoto.objectKey,
        publicUrl: storedPhoto.publicUrl,
        mimeType: storedPhoto.mimeType,
        size: storedPhoto.size,
        storageProvider: storedPhoto.storageProvider,
        isPrimary: !hasPrimary && index === 0,
        record,
        uploadedBy,
      }),
    );

    await this.photoRepository.save(entities);

    await this.auditLogsService.register({
      actorId: authUser.sub,
      action: "RECORD_PHOTOS_ADDED",
      entityType: "record",
      entityId: record.id,
      metadata: {
        photoIds: entities.map((photo) => photo.id),
        count: entities.length,
      },
    });

    return this.emitAndReturn(record.id);
  }

  async setPrimary(recordId: string, photoId: string, authUser: AuthUser) {
    const record = await this.findRecord(recordId);
    this.ensureAccess(record, authUser);
    const photo = this.findPhoto(record, photoId);

    await this.photoRepository.manager.transaction(async (manager) => {
      await manager
        .createQueryBuilder()
        .update(VehiclePhotoEntity)
        .set({ isPrimary: false })
        .where('"recordId" = :recordId', { recordId })
        .andWhere('"deletedAt" IS NULL')
        .execute();

      await manager.update(VehiclePhotoEntity, photo.id, { isPrimary: true });
    });

    await this.auditLogsService.register({
      actorId: authUser.sub,
      action: "RECORD_PRIMARY_PHOTO_CHANGED",
      entityType: "record",
      entityId: record.id,
      metadata: { photoId: photo.id },
    });

    return this.emitAndReturn(record.id);
  }

  async replacePhoto(
    recordId: string,
    photoId: string,
    replacement: UploadedFile,
    authUser: AuthUser,
  ) {
    const record = await this.findRecord(recordId);
    this.ensureAccess(record, authUser);
    const photo = this.findPhoto(record, photoId);
    const oldObjectKey = photo.objectKey;

    const storedPhoto = await this.storageService.saveFile({
      folder: "vehicle-photos",
      file: replacement,
    });

    await this.photoRepository.update(photo.id, {
      fileName: storedPhoto.originalName,
      filePath: storedPhoto.fileName,
      objectKey: storedPhoto.objectKey,
      publicUrl: storedPhoto.publicUrl,
      mimeType: storedPhoto.mimeType,
      size: storedPhoto.size,
      storageProvider: storedPhoto.storageProvider,
    });

    try {
      await this.storageService.deleteObject(oldObjectKey);
    } catch {
      // La sustitucion ya es consistente en BD; un archivo antiguo huerfano no debe revertirla.
    }

    await this.auditLogsService.register({
      actorId: authUser.sub,
      action: "RECORD_PHOTO_REPLACED",
      entityType: "record",
      entityId: record.id,
      metadata: { photoId: photo.id },
    });

    return this.emitAndReturn(record.id);
  }

  async deletePhoto(recordId: string, photoId: string, authUser: AuthUser) {
    const record = await this.findRecord(recordId);
    this.ensureAccess(record, authUser);
    const photo = this.findPhoto(record, photoId);
    const wasPrimary = photo.isPrimary;

    await this.storageService.deleteObject(photo.objectKey);
    await this.photoRepository.softDelete(photo.id);

    if (wasPrimary) {
      const nextPhoto = await this.photoRepository.findOne({
        where: { record: { id: recordId } },
        order: { createdAt: "ASC" },
      });

      if (nextPhoto) {
        await this.photoRepository.update(nextPhoto.id, { isPrimary: true });
      }
    }

    await this.auditLogsService.register({
      actorId: authUser.sub,
      action: "RECORD_PHOTO_DELETED",
      entityType: "record",
      entityId: record.id,
      metadata: { photoId: photo.id, wasPrimary },
    });

    return this.emitAndReturn(record.id);
  }

  private async findRecord(recordId: string) {
    const record = await this.recordRepository.findOne({
      where: { id: recordId },
      relations: {
        delegation: { region: true },
        photos: { uploadedBy: true },
      },
    });

    if (!record) {
      throw new NotFoundException("No se encontro la captura vehicular.");
    }

    return record;
  }

  private findPhoto(record: RecordEntity, photoId: string) {
    const photo = record.photos.find((item) => item.id === photoId);

    if (!photo) {
      throw new NotFoundException("No se encontro la fotografia en este expediente.");
    }

    return photo;
  }

  private ensureAccess(record: RecordEntity, authUser: AuthUser) {
    if (authUser.role === Role.Enlace && authUser.delegationId !== record.delegation.id) {
      throw new ForbiddenException("No puedes modificar fotografias de otra delegacion.");
    }
  }

  private async emitAndReturn(recordId: string) {
    const updatedRecord = await this.recordsService.findOne(recordId);
    this.realtimeGateway.emitRecordChanged(updatedRecord);
    return updatedRecord;
  }
}
