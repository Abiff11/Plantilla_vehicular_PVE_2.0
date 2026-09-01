import {
  BadRequestException,
  Controller,
  Delete,
  Param,
  Patch,
  Post,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor, FilesInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import { CurrentUser } from "src/common/auth/current-user.decorator";
import { VEHICLE_ADMIN_ROLES } from "src/common/auth/role-groups";
import { RequireRoles } from "src/common/auth/roles.decorator";
import { RolesGuard } from "src/common/auth/roles.guard";
import { Role } from "src/common/enums/role.enum";
import { assertValidImageSignature } from "src/common/security/upload-validation";
import { JwtAuthGuard } from "src/modules/auth/jwt-auth.guard";
import { RecordPhotosService } from "./record-photos.service";

type PhotoUpload = {
  fieldname: string;
  originalname: string;
  encoding: string;
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

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAX_FILES_PER_REQUEST = 5;

function photoFileFilter(
  _req: Express.Request,
  file: PhotoUpload,
  callback: (error: Error | null, acceptFile: boolean) => void,
) {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    callback(null, true);
    return;
  }

  callback(new Error("Solo se permiten imagenes JPG, JPEG, PNG o WEBP."), false);
}

function assertPhoto(file?: PhotoUpload) {
  if (!file) {
    throw new BadRequestException("Selecciona una fotografia.");
  }

  try {
    assertValidImageSignature(file);
  } catch (error) {
    throw new BadRequestException(
      error instanceof Error ? error.message : "El archivo no coincide con una imagen valida.",
    );
  }
}

function assertPhotos(files?: PhotoUpload[]) {
  if (!files?.length) {
    throw new BadRequestException("Selecciona al menos una fotografia.");
  }

  files.forEach((file) => assertPhoto(file));
}

@Controller("records/:recordId/photos")
@UseGuards(JwtAuthGuard, RolesGuard)
@RequireRoles(Role.Enlace, ...VEHICLE_ADMIN_ROLES)
export class RecordPhotosController {
  constructor(private readonly recordPhotosService: RecordPhotosService) {}

  @Post()
  @UseInterceptors(
    FilesInterceptor("photos", MAX_FILES_PER_REQUEST, {
      storage: memoryStorage(),
      fileFilter: photoFileFilter,
      limits: { fileSize: MAX_FILE_SIZE },
    }),
  )
  addPhotos(
    @Param("recordId") recordId: string,
    @CurrentUser() user: AuthUser,
    @UploadedFiles() photos?: PhotoUpload[],
  ) {
    assertPhotos(photos);
    return this.recordPhotosService.addPhotos(recordId, photos!, user);
  }

  @Patch(":photoId/primary")
  setPrimary(
    @Param("recordId") recordId: string,
    @Param("photoId") photoId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.recordPhotosService.setPrimary(recordId, photoId, user);
  }

  @Post(":photoId/replace")
  @UseInterceptors(
    FileInterceptor("photo", {
      storage: memoryStorage(),
      fileFilter: photoFileFilter,
      limits: { fileSize: MAX_FILE_SIZE },
    }),
  )
  replacePhoto(
    @Param("recordId") recordId: string,
    @Param("photoId") photoId: string,
    @CurrentUser() user: AuthUser,
    @UploadedFile() photo?: PhotoUpload,
  ) {
    assertPhoto(photo);
    return this.recordPhotosService.replacePhoto(recordId, photoId, photo!, user);
  }

  @Delete(":photoId")
  deletePhoto(
    @Param("recordId") recordId: string,
    @Param("photoId") photoId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.recordPhotosService.deletePhoto(recordId, photoId, user);
  }
}
