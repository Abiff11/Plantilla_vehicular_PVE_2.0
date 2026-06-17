import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";
import { Role } from "src/common/enums/role.enum";
import { AuditLogsService } from "src/modules/audit-logs/audit-logs.service";
import { RealtimeGateway } from "src/modules/realtime/realtime.gateway";
import { UserEntity } from "src/modules/users/entities/user.entity";
import { CreateConversationDto } from "./dto/create-conversation.dto";
import { MarkReadDto } from "./dto/mark-read.dto";
import { SendMessageDto } from "./dto/send-message.dto";
import { ConversationEntity } from "./entities/conversation.entity";
import { MessageEntity } from "./entities/message.entity";
import { MessagePhotoEntity } from "./entities/message-photo.entity";
import { StorageService } from "src/modules/storage/storage.service";

type UploadedFile = {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
};

const ALLOWED_ROLES = [
  Role.Enlace,
  Role.PlantillaVehicular,
  Role.DirectorOperativo,
  Role.DirectorGeneral,
  Role.SuperAdmin,
  Role.Coordinacion,
];

type AuthUser = {
  sub: string;
  role: Role;
};

@Injectable()
export class MessagesService {
  constructor(
    @InjectRepository(ConversationEntity)
    private readonly conversationRepository: Repository<ConversationEntity>,
    @InjectRepository(MessageEntity)
    private readonly messageRepository: Repository<MessageEntity>,
    @InjectRepository(MessagePhotoEntity)
    private readonly messagePhotoRepository: Repository<MessagePhotoEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    private readonly auditLogsService: AuditLogsService,
    private readonly realtimeGateway: RealtimeGateway,
    private readonly storageService: StorageService,
  ) {}

  async createConversation(dto: CreateConversationDto, authUser: AuthUser) {
    this.validateRoleAccess(authUser.role);

    const participants = await this.userRepository.findBy({
      id: In(dto.participantIds),
    });

    if (participants.length !== dto.participantIds.length) {
      throw new NotFoundException("No se encontro uno o mas participantes.");
    }

    const creator = await this.userRepository.findOneBy({ id: authUser.sub });
    if (!creator) {
      throw new NotFoundException("No se encontro el usuario autenticado.");
    }

    if (!participants.some((p) => p.id === authUser.sub)) {
      participants.push(creator);
    }

    const participantIds = participants.map((p) => p.id);
    const existingConversation =
      await this.findExistingDirectConversation(participantIds);

    if (existingConversation) {
      return this.findOneConversation(existingConversation.id);
    }

    const conversation = this.conversationRepository.create({
      title: dto.title ?? null,
      isGroup: participants.length > 2,
      participants,
      lastMessageAt: new Date(),
    });

    const savedConversation =
      await this.conversationRepository.save(conversation);

    await this.auditLogsService.register({
      actorId: authUser.sub,
      action: "CONVERSATION_CREATED",
      entityType: "conversation",
      entityId: savedConversation.id,
      metadata: {
        participantIds,
        isGroup: participants.length > 2,
      },
    });

    const hydratedConversation = await this.findOneConversation(
      savedConversation.id,
    );

    this.realtimeGateway.emitConversationCreated(hydratedConversation);

    return hydratedConversation;
  }

  async getMessagingPartners(authUser: AuthUser) {
    this.validateRoleAccess(authUser.role);

    return this.userRepository.find({
      where: {
        role: In(ALLOWED_ROLES),
        isActive: true,
      },
      order: { firstName: "ASC" },
    }).then((users) =>
      users.map((user) => ({
        ...user,
        isOnline: this.realtimeGateway.isUserOnline(user.id),
      })),
    );
  }

  async getMyConversations(authUser: AuthUser) {
    const conversations = await this.conversationRepository
      .createQueryBuilder("conversation")
      .innerJoin(
        "conversation.participants",
        "filterParticipant",
        "filterParticipant.id = :userId",
        { userId: authUser.sub },
      )
      .leftJoinAndSelect("conversation.participants", "participants")
      .orderBy("conversation.lastMessageAt", "DESC")
      .getMany();

    const result = await Promise.all(
      conversations.map(async (conv) => {
        const lastMessage = await this.messageRepository.findOne({
          where: { conversation: { id: conv.id } },
          relations: { sender: true, photos: { uploadedBy: true } },
          order: { createdAt: "DESC" },
        });

        const unreadCount = await this.messageRepository
          .createQueryBuilder("message")
          .leftJoin("message.sender", "sender")
          .where("message.conversationId = :convId", { convId: conv.id })
          .andWhere("message.isRead = false")
          .andWhere("sender.id != :userId", { userId: authUser.sub })
          .getCount();

        return {
          ...conv,
          unreadCount,
          lastMessage: lastMessage ?? null,
        };
      }),
    );

    return result;
  }

  async getConversationMessages(conversationId: string, authUser: AuthUser) {
    const conversation = await this.findOneConversation(conversationId);

    this.validateConversationAccess(conversation, authUser.sub);

    return this.messageRepository.find({
      where: { conversation: { id: conversationId } },
      relations: { sender: true, photos: { uploadedBy: true } },
      order: { createdAt: "ASC" },
    });
  }

  async sendMessage(
    dto: SendMessageDto,
    authUser: AuthUser,
    photos?: UploadedFile[],
  ) {
    const conversation = await this.findOneConversation(dto.conversationId);

    this.validateConversationAccess(conversation, authUser.sub);

    const sender = await this.userRepository.findOneBy({ id: authUser.sub });

    if (!sender) {
      throw new NotFoundException("No se encontro el usuario.");
    }

    const message = await this.messageRepository.save(
      this.messageRepository.create({
        conversation,
        sender,
        content: dto.content.trim(),
        isRead: false,
      }),
    );

    if (photos && photos.length > 0) {
      const storedPhotos = await Promise.all(
        photos.map((photo) =>
          this.storageService.saveFile({
            folder: "message-photos",
            file: {
              originalname: photo.originalname,
              mimetype: photo.mimetype,
              buffer: photo.buffer,
              size: photo.size,
            },
          }),
        ),
      );

      const photoEntities = storedPhotos.map((storedPhoto) =>
        this.messagePhotoRepository.create({
          fileName: storedPhoto.originalName,
          filePath: storedPhoto.fileName,
          objectKey: storedPhoto.objectKey,
          publicUrl: storedPhoto.publicUrl,
          mimeType: storedPhoto.mimeType,
          size: storedPhoto.size,
          storageProvider: storedPhoto.storageProvider,
          message,
          uploadedBy: sender,
        }),
      );

      await this.messagePhotoRepository.save(photoEntities);
    }
    conversation.lastMessageAt = new Date();
    await this.conversationRepository.save(conversation);

    const hydratedMessage = await this.findOneMessage(message.id);

    await this.auditLogsService.register({
      actorId: authUser.sub,
      action: "MESSAGE_SENT",
      entityType: "message",
      entityId: message.id,
      metadata: {
        conversationId: dto.conversationId,
        recipientIds: conversation.participants
          .filter((p) => p.id !== authUser.sub)
          .map((p) => p.id),
        photoCount: photos?.length ?? 0,
      },
    });

    const recipientIds = conversation.participants
      .filter((p) => p.id !== authUser.sub)
      .map((p) => p.id);

    this.realtimeGateway.emitMessageSent(hydratedMessage, recipientIds);

    return hydratedMessage;
  }

  async markMessageAsRead(dto: MarkReadDto, authUser: AuthUser) {
    const message = await this.messageRepository.findOne({
      where: { id: dto.messageId },
      relations: { conversation: { participants: true }, sender: true },
    });

    if (!message) {
      throw new NotFoundException("No se encontro el mensaje.");
    }

    this.validateConversationAccess(message.conversation, authUser.sub);

    if (message.sender.id === authUser.sub) {
      throw new ForbiddenException(
        "No puedes marcar como leido un mensaje propio.",
      );
    }

    message.isRead = true;
    message.readAt = new Date();
    await this.messageRepository.save(message);

    this.realtimeGateway.emitMessageRead(message, [message.sender.id]);

    return message;
  }

  async markAllConversationAsRead(conversationId: string, authUser: AuthUser) {
    const conversation = await this.findOneConversation(conversationId);

    this.validateConversationAccess(conversation, authUser.sub);

    await this.messageRepository
      .createQueryBuilder()
      .update(MessageEntity)
      .set({ isRead: true, readAt: new Date() })
      .where("conversationId = :conversationId", { conversationId })
      .andWhere("senderId != :userId", { userId: authUser.sub })
      .andWhere("isRead = false")
      .execute();

    this.realtimeGateway.emitConversationRead(conversationId, [authUser.sub]);
  }

  async findOneConversation(id: string) {
    const conversation = await this.conversationRepository.findOne({
      where: { id },
      relations: { participants: true },
    });

    if (!conversation) {
      throw new NotFoundException("No se encontro la conversacion.");
    }

    return conversation;
  }

  private async findOneMessage(id: string) {
    const message = await this.messageRepository.findOne({
      where: { id },
      relations: {
        conversation: { participants: true },
        sender: true,
        photos: { uploadedBy: true },
      },
    });

    if (!message) {
      throw new NotFoundException("No se encontro el mensaje.");
    }

    return message;
  }

  private async findExistingDirectConversation(participantIds: string[]) {
    if (participantIds.length !== 2) {
      return null;
    }

    const conversations = await this.conversationRepository
      .createQueryBuilder("conversation")
      .leftJoinAndSelect("conversation.participants", "participants")
      .where("conversation.isGroup = :isGroup", { isGroup: false })
      .andWhere("participants.id IN (:...ids)", { ids: participantIds })
      .getMany();

    for (const conv of conversations) {
      const convParticipantIds = conv.participants.map((p) => p.id);
      if (
        convParticipantIds.length === 2 &&
        participantIds.every((id) => convParticipantIds.includes(id))
      ) {
        return conv;
      }
    }

    return null;
  }

  private validateRoleAccess(role: Role) {
    if (!ALLOWED_ROLES.includes(role)) {
      throw new ForbiddenException(
        "Tu rol no tiene permiso para usar la mensajeria.",
      );
    }
  }

  private validateConversationAccess(
    conversation: ConversationEntity,
    userId: string,
  ) {
    const isParticipant = conversation.participants.some(
      (p) => p.id === userId,
    );

    if (!isParticipant) {
      throw new ForbiddenException("No formas parte de esta conversacion.");
    }
  }
}
