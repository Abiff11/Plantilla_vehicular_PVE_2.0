import {
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Res,
  UseGuards,
} from "@nestjs/common";
import type { Response } from "express";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { CurrentUser } from "src/common/auth/current-user.decorator";
import { Role } from "src/common/enums/role.enum";
import { JwtAuthGuard } from "src/modules/auth/jwt-auth.guard";
import { MessagePhotoEntity } from "src/modules/messages/entities/message-photo.entity";
import { VehiclePhotoEntity } from "src/modules/records/entities/vehicle-photo.entity";
import { StorageService } from "src/modules/storage/storage.service";

type AuthUser = {
  sub: string;
  role: Role;
  regionId: string | null;
  delegationId: string | null;
};

@Controller("files")
@UseGuards(JwtAuthGuard)
export class FilesController {
  constructor(
    @InjectRepository(VehiclePhotoEntity)
    private readonly vehiclePhotoRepository: Repository<VehiclePhotoEntity>,
    @InjectRepository(MessagePhotoEntity)
    private readonly messagePhotoRepository: Repository<MessagePhotoEntity>,
    private readonly storageService: StorageService,
  ) {}

  @Get("vehicle-photos/:fileName")
  async getVehiclePhoto(
    @Param("fileName") fileName: string,
    @CurrentUser() user: AuthUser,
    @Res() response: Response,
  ) {
    const objectKey = `vehicle-photos/${fileName}`;
    const photo = await this.vehiclePhotoRepository.findOne({
      where: { objectKey },
      relations: {
        record: {
          delegation: {
            region: true,
          },
          createdBy: true,
        },
      },
    });

    if (!photo) {
      throw new NotFoundException("No se encontro el archivo.");
    }

    this.assertVehiclePhotoAccess(photo, user);
    await this.sendStoredObject(photo.objectKey, photo.mimeType, response);
  }

  @Get("message-photos/:fileName")
  async getMessageAttachment(
    @Param("fileName") fileName: string,
    @CurrentUser() user: AuthUser,
    @Res() response: Response,
  ) {
    const objectKey = `message-photos/${fileName}`;
    const photo = await this.messagePhotoRepository.findOne({
      where: { objectKey },
      relations: {
        message: {
          conversation: {
            participants: true,
          },
        },
      },
    });

    if (!photo) {
      throw new NotFoundException("No se encontro el archivo.");
    }

    const hasConversationAccess = photo.message.conversation.participants.some(
      (participant) => participant.id === user.sub,
    );

    if (!hasConversationAccess) {
      throw new ForbiddenException("No tienes permiso para consultar este archivo.");
    }

    await this.sendStoredObject(photo.objectKey, photo.mimeType, response);
  }

  private assertVehiclePhotoAccess(photo: VehiclePhotoEntity, user: AuthUser) {
    if ([Role.PlantillaVehicular, Role.DirectorGeneral, Role.SuperAdmin, Role.Coordinacion].includes(user.role)) {
      return;
    }

    if (user.role === Role.Enlace && photo.record.delegation.id === user.delegationId) {
      return;
    }

    if (user.role === Role.DirectorOperativo && photo.record.delegation.region.id === user.regionId) {
      return;
    }

    throw new ForbiddenException("No tienes permiso para consultar este archivo.");
  }

  private async sendStoredObject(objectKey: string, mimeType: string, response: Response) {
    const fileObject = await this.storageService.getObject(objectKey);

    response.setHeader("Content-Type", mimeType || fileObject.mimeType);
    response.setHeader("Content-Length", String(fileObject.size));
    response.setHeader("Cache-Control", "private, no-store");
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.send(fileObject.buffer);
  }
}
