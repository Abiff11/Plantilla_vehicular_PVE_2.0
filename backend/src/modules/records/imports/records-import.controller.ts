import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { CurrentUser } from 'src/common/auth/current-user.decorator';
import { RequireRoles } from 'src/common/auth/roles.decorator';
import { RolesGuard } from 'src/common/auth/roles.guard';
import { Role } from 'src/common/enums/role.enum';
import { JwtAuthGuard } from 'src/modules/auth/jwt-auth.guard';
import { RecordsImportService } from './records-import.service';

type UploadedExcelFile = {
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

const MAX_EXCEL_SIZE = 15 * 1024 * 1024;

@Controller('records/imports')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RecordsImportController {
  constructor(private readonly recordsImportService: RecordsImportService) {}

  @Post('preview')
  @RequireRoles(Role.PlantillaVehicular, Role.SuperAdmin, Role.Coordinacion)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_EXCEL_SIZE },
    }),
  )
  preview(@UploadedFile() file?: UploadedExcelFile) {
    assertUploadedExcel(file);
    return this.recordsImportService.preview(file);
  }

  @Post('commit')
  @RequireRoles(Role.PlantillaVehicular, Role.SuperAdmin, Role.Coordinacion)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_EXCEL_SIZE },
    }),
  )
  commit(
    @UploadedFile() file: UploadedExcelFile | undefined,
    @CurrentUser() user: AuthUser,
  ) {
    assertUploadedExcel(file);
    return this.recordsImportService.commit(file, user);
  }
}

function assertUploadedExcel(file?: UploadedExcelFile): asserts file is UploadedExcelFile {
  if (!file) {
    throw new BadRequestException('Se requiere cargar un archivo Excel.');
  }
}
