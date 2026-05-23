import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FilesInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import { CurrentUser } from "src/common/auth/current-user.decorator";
import { RequireRoles } from "src/common/auth/roles.decorator";
import { RolesGuard } from "src/common/auth/roles.guard";
import { Role } from "src/common/enums/role.enum";
import { JwtAuthGuard } from "src/modules/auth/jwt-auth.guard";
import { CreateRecordDto } from "./dto/create-record.dto";
import { SubmitRosterReportDto } from "./dto/submit-roster-report.dto";
import { TransferRecordDto } from "./dto/transfer-record.dto";
import { UpdateRecordDto } from "./dto/update-record.dto";
import { RecordsService } from "./records.service";

type UploadedFile = {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
};

const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
];
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAX_FILES = 3;

function photoFileFilter(
  _req: Express.Request,
  file: UploadedFile,
  callback: (error: Error | null, acceptFile: boolean) => void,
) {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    callback(null, true);
  } else {
    callback(
      new Error("Solo se permiten imagenes en formato JPG, JPEG, PNG o WEBP."),
      false,
    );
  }
}

function hasImageSignature(file: UploadedFile) {
  const buffer = file.buffer;

  if (file.mimetype === "image/jpeg" || file.mimetype === "image/jpg") {
    return buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }

  if (file.mimetype === "image/png") {
    return buffer.length > 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  }

  if (file.mimetype === "image/webp") {
    return buffer.length > 12 && buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP";
  }

  return false;
}

function assertValidPhotos(photos?: UploadedFile[]) {
  if (!photos || photos.length === 0) {
    return;
  }

  for (const photo of photos) {
    if (!hasImageSignature(photo)) {
      throw new BadRequestException("El archivo no coincide con una imagen valida.");
    }
  }
}

type AuthUser = {
  sub: string;
  role: Role;
  regionId: string | null;
  delegationId: string | null;
};

@Controller("records")
@UseGuards(JwtAuthGuard, RolesGuard)
export class RecordsController {
  constructor(private readonly recordsService: RecordsService) {}

  @Post()
  @RequireRoles(Role.Enlace)
  @UseInterceptors(
    FilesInterceptor("photos", MAX_FILES, {
      storage: memoryStorage(),
      fileFilter: photoFileFilter,
      limits: { fileSize: MAX_FILE_SIZE },
    }),
  )
  create(
    @Body() dto: CreateRecordDto,
    @CurrentUser() user: AuthUser,
    @UploadedFiles() photos?: UploadedFile[],
  ) {
    assertValidPhotos(photos);
    return this.recordsService.create(dto, user, photos);
  }

  @Get("my")
  @RequireRoles(Role.Enlace)
  findMine(@CurrentUser() user: AuthUser) {
    return this.recordsService.findMine(user);
  }

  @Get("reports/my")
  @RequireRoles(Role.Enlace)
  findMyRosterReports(@CurrentUser() user: AuthUser) {
    return this.recordsService.findMyRosterReports(user);
  }

  @Get("reports/region/my")
  @RequireRoles(Role.DirectorOperativo)
  findMyRegionalRosterReports(@CurrentUser() user: AuthUser) {
    return this.recordsService.findMyRegionalRosterReports(user);
  }

  @Post("reports")
  @RequireRoles(Role.Enlace)
  submitRosterReport(
    @Body() dto: SubmitRosterReportDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.recordsService.submitRosterReport(dto, user);
  }

  @Post("reports/region")
  @RequireRoles(
    Role.PlantillaVehicular,
    Role.SuperAdmin,
    Role.Coordinacion,
  )
  submitRegionalRosterReport(
    @Body() dto: SubmitRosterReportDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.recordsService.submitRegionalRosterReport(dto, user);
  }

  @Get("reports/overview")
  @RequireRoles(
    Role.PlantillaVehicular,
    Role.SuperAdmin,
    Role.DirectorGeneral,
    Role.Coordinacion,
  )
  findRosterReportOverview(@Query("regionId") regionId?: string) {
    return this.recordsService.findRosterReportOverview(regionId);
  }

  @Get("reports/region/overview")
  @RequireRoles(Role.DirectorOperativo)
  findRegionalRosterReportOverview(
    @CurrentUser() user: AuthUser,
    @Query("delegationId") delegationId?: string,
  ) {
    return this.recordsService.findRegionalRosterReportOverview(
      user,
      delegationId,
    );
  }

  @Get("region/live")
  @RequireRoles(Role.DirectorOperativo)
  findRegionalView(@CurrentUser() user: AuthUser) {
    return this.recordsService.findRegionalView(user);
  }

  @Get("admin/overview")
  @RequireRoles(
    Role.PlantillaVehicular,
    Role.SuperAdmin,
    Role.Coordinacion,
  )
  findAdminView(
    @Query("regionId") regionId?: string,
    @Query("delegationId") delegationId?: string,
    @Query("dateFrom") dateFrom?: string,
    @Query("dateTo") dateTo?: string,
  ) {
    return this.recordsService.findAdminView(
      regionId,
      delegationId,
      dateFrom,
      dateTo,
    );
  }

  @Get("director/overview")
  @RequireRoles(
    Role.DirectorGeneral,
    Role.PlantillaVehicular,
    Role.SuperAdmin,
    Role.Coordinacion,
  )
  findDirectorOverview(
    @Query("regionId") regionId?: string,
    @Query("delegationId") delegationId?: string,
    @Query("dateFrom") dateFrom?: string,
    @Query("dateTo") dateTo?: string,
  ) {
    return this.recordsService.findDirectorOverview(
      regionId,
      delegationId,
      dateFrom,
      dateTo,
    );
  }

  @Get("director/delegations/:delegationId/vehicles")
  @RequireRoles(
    Role.DirectorGeneral,
    Role.PlantillaVehicular,
    Role.SuperAdmin,
    Role.Coordinacion,
  )
  findDirectorDelegationVehicles(
    @Param("delegationId") delegationId: string,
    @Query("dateFrom") dateFrom?: string,
    @Query("dateTo") dateTo?: string,
  ) {
    return this.recordsService.findDirectorDelegationVehicles(
      delegationId,
      dateFrom,
      dateTo,
    );
  }

  @Delete(":id")
  @RequireRoles(Role.PlantillaVehicular, Role.SuperAdmin, Role.Coordinacion)
  softDelete(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.recordsService.softDelete(id, user);
  }

  @Patch(":id")
  @RequireRoles(
    Role.Enlace,
    Role.PlantillaVehicular,
    Role.SuperAdmin,
    Role.Coordinacion,
  )
  update(
    @Param("id") id: string,
    @Body() dto: UpdateRecordDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.recordsService.update(id, dto, user);
  }

  @Post(":id/transfer")
  @RequireRoles(
    Role.Enlace,
    Role.DirectorOperativo,
    Role.PlantillaVehicular,
    Role.SuperAdmin,
    Role.Coordinacion,
  )
  transfer(
    @Param("id") id: string,
    @Body() dto: TransferRecordDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.recordsService.transfer(id, dto, user);
  }
}
