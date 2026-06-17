import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
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
import { CreateConversationDto } from "./dto/create-conversation.dto";
import { MarkReadDto } from "./dto/mark-read.dto";
import { SendMessageDto } from "./dto/send-message.dto";
import { MessagesService } from "./messages.service";

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
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_FILES = 5;

function messagePhotoFileFilter(
  _req: Express.Request,
  file: UploadedFile,
  callback: (error: Error | null, acceptFile: boolean) => void,
) {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    callback(null, true);
  } else {
    callback(
      new Error(
        "Solo se permiten imagenes (JPG, JPEG, PNG, WEBP) o documentos (PDF, XLSX, DOCX). Maximo 10MB por archivo.",
      ),
      false,
    );
  }
}

type AuthUser = {
  sub: string;
  role: Role;
};

@Controller("messages")
@UseGuards(JwtAuthGuard, RolesGuard)
@RequireRoles(
  Role.Enlace,
  Role.PlantillaVehicular,
  Role.DirectorOperativo,
  Role.DirectorGeneral,
  Role.SuperAdmin,
  Role.Coordinacion,
)
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Post("conversations")
  createConversation(
    @Body() dto: CreateConversationDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.messagesService.createConversation(dto, user);
  }

  @Get("conversations")
  getMyConversations(@CurrentUser() user: AuthUser) {
    return this.messagesService.getMyConversations(user);
  }

  @Get("partners")
  getMessagingPartners(@CurrentUser() user: AuthUser) {
    return this.messagesService.getMessagingPartners(user);
  }

  @Get("conversations/:id/messages")
  getConversationMessages(
    @Param("id") id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.messagesService.getConversationMessages(id, user);
  }

  @Post()
  sendMessage(@Body() dto: SendMessageDto, @CurrentUser() user: AuthUser) {
    return this.messagesService.sendMessage(dto, user);
  }

  @Post("with-photos")
  @UseInterceptors(
    FilesInterceptor("photos", MAX_FILES, {
      storage: memoryStorage(),
      fileFilter: messagePhotoFileFilter,
      limits: { fileSize: MAX_FILE_SIZE },
    }),
  )
  sendMessageWithPhotos(
    @Body() dto: SendMessageDto,
    @CurrentUser() user: AuthUser,
    @UploadedFiles() photos?: UploadedFile[],
  ) {
    return this.messagesService.sendMessage(dto, user, photos);
  }

  @Patch("read")
  markMessageAsRead(@Body() dto: MarkReadDto, @CurrentUser() user: AuthUser) {
    return this.messagesService.markMessageAsRead(dto, user);
  }

  @Patch("conversations/:id/read-all")
  markAllConversationAsRead(
    @Param("id") id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.messagesService.markAllConversationAsRead(id, user);
  }
}
