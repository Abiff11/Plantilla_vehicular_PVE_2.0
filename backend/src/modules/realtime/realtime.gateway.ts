import {
  Injectable,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { InjectRepository } from '@nestjs/typeorm';
import { Server, type Socket } from 'socket.io';
import { Repository } from 'typeorm';
import { Role } from 'src/common/enums/role.enum';
import type { JwtPayload } from 'src/modules/auth/jwt-payload.type';
import { UserEntity } from 'src/modules/users/entities/user.entity';

const AUTH_COOKIE_NAME = 'pve_vehicle_access_token';

function resolveRealtimeOrigins() {
  const configuredOrigins = (process.env.FRONTEND_ORIGINS ?? process.env.FRONTEND_ORIGIN ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  const defaultOrigins = ['http://localhost:5173', 'http://127.0.0.1:5173'];
  const allowedOrigins = new Set([...defaultOrigins, ...configuredOrigins]);

  return (origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) => {
    if (!origin || allowedOrigins.has(origin) || isLocalDevelopmentOrigin(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error(`Socket CORS blocked for origin ${origin}`));
  };
}

function isLocalDevelopmentOrigin(origin: string) {
  try {
    const parsedOrigin = new URL(origin);
    const hostname = parsedOrigin.hostname;
    const port = Number(parsedOrigin.port);
    const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
    const isPrivateIpv4 =
      /^10\./.test(hostname) ||
      /^192\.168\./.test(hostname) ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname);

    const isVitePort = port >= 5173 && port <= 5179;
    return parsedOrigin.protocol === 'http:' && isVitePort && (isLocalhost || isPrivateIpv4);
  } catch {
    return false;
  }
}

function extractTokenFromCookieHeader(cookieHeader: string | undefined) {
  if (!cookieHeader) {
    return null;
  }

  const authCookie = cookieHeader
    .split(';')
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(`${AUTH_COOKIE_NAME}=`));

  if (!authCookie) {
    return null;
  }

  return decodeURIComponent(authCookie.slice(AUTH_COOKIE_NAME.length + 1));
}

type AuthenticatedSocketData = {
  user: JwtPayload;
};

type RecordCreatedEvent = {
  deletedAt?: Date | null;
  createdBy?: {
    id?: string;
  };
  delegation?: {
    region?: {
      id?: string;
    };
  };
};

const REALTIME_DEBUG_ENABLED = process.env.REALTIME_DEBUG === 'true';

function realtimeDebugLog(event: string, payload?: Record<string, unknown>) {
  if (!REALTIME_DEBUG_ENABLED) {
    return;
  }

  if (payload) {
    console.info(`[realtime] ${event}`, payload);
    return;
  }

  console.info(`[realtime] ${event}`);
}

function userRoom(userId: string) {
  return `user:${userId}`;
}

function regionRoom(regionId: string) {
  return `region:${regionId}`;
}

@WebSocketGateway({
  cors: {
    origin: resolveRealtimeOrigins(),
    credentials: true,
  },
})
@Injectable()
export class RealtimeGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit
{
  private readonly onlineUsers = new Map<string, number>();

  constructor(
    private readonly jwtService: JwtService,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
  ) {}

  @WebSocketServer()
  server!: Server;

  onModuleInit() {
    this.server.use((socket, next) => {
      void this.authenticateSocket(socket)
        .then((user) => {
          (socket.data as AuthenticatedSocketData).user = user;
          realtimeDebugLog('auth_ok', {
            socketId: socket.id,
            userId: user.sub,
            role: user.role,
          });
          next();
        })
        .catch((error) => {
          realtimeDebugLog('auth_error', {
            socketId: socket.id,
            message: error instanceof Error ? error.message : 'Unknown socket auth error',
          });
          next(new UnauthorizedException('Unauthorized socket connection.'));
        });
    });
  }

  handleConnection(socket: Socket) {
    const user = (socket.data as AuthenticatedSocketData).user;

    socket.join(userRoom(user.sub));
    this.markUserOnline(user.sub);

    if (user.role === Role.DirectorOperativo && user.regionId) {
      socket.join(regionRoom(user.regionId));
    }

    if (this.canAccessAuditChannel(user.role)) {
      socket.join('role:coordinacion');
    }

    if (this.canAccessOversightRecordsChannel(user.role)) {
      socket.join('records:oversight');
    }

    this.emitPresenceUpdate();

    realtimeDebugLog('connected', {
      socketId: socket.id,
      userId: user.sub,
      role: user.role,
      rooms: Array.from(socket.rooms),
    });
  }

  handleDisconnect(socket: Socket) {
    const user = (socket.data as AuthenticatedSocketData).user;

    if (user?.sub) {
      this.markUserOffline(user.sub);
      this.emitPresenceUpdate();
    }

    realtimeDebugLog('disconnected', {
      socketId: socket.id,
      userId: user?.sub,
      role: user?.role,
    });
  }

  emitRecordCreated(payload: RecordCreatedEvent) {
    const creatorId = payload.createdBy?.id;
    const recordRegionId = payload.delegation?.region?.id;

    if (creatorId) {
      this.server.to(userRoom(creatorId)).emit('records.created', payload);
    }

    if (recordRegionId) {
      this.server.to(regionRoom(recordRegionId)).emit('records.created', payload);
    }

    this.server.to('records:oversight').emit('records.created', payload);
  }

  emitRecordChanged(payload: RecordCreatedEvent) {
    const creatorId = payload.createdBy?.id;
    const recordRegionId = payload.delegation?.region?.id;

    if (creatorId) {
      this.server.to(userRoom(creatorId)).emit('records.changed', payload);
    }

    if (recordRegionId) {
      this.server.to(regionRoom(recordRegionId)).emit('records.changed', payload);
    }

    this.server.to('records:oversight').emit('records.changed', payload);
  }

  emitAuditCreated(payload: unknown) {
    this.server.to('role:coordinacion').emit('audit.created', payload);
  }

  emitRosterReportSubmitted(payload: unknown) {
    this.server.to('records:oversight').emit('reports.submitted', payload);
  }

  emitMessageSent(payload: unknown, recipientIds: string[]) {
    realtimeDebugLog('emit_messages_new', {
      recipientIds,
    });

    for (const recipientId of recipientIds) {
      this.server.to(userRoom(recipientId)).emit('messages:new', payload);
    }
  }

  emitMessageRead(payload: unknown, recipientIds: string[]) {
    for (const recipientId of recipientIds) {
      this.server.to(userRoom(recipientId)).emit('messages:read', payload);
    }
  }

  emitConversationCreated(payload: { participants?: { id: string }[] }) {
    const participantIds =
      payload.participants?.map((p) => p.id).filter(Boolean) ?? [];

    for (const participantId of participantIds) {
      this.server.to(userRoom(participantId)).emit('conversations:updated', payload);
    }
  }

  emitConversationRead(conversationId: string, participantIds: string[]) {
    const otherParticipantIds = participantIds;
    for (const participantId of otherParticipantIds) {
      this.server.to(userRoom(participantId)).emit('conversations:read', { conversationId });
    }
  }

  isUserOnline(userId: string) {
    return (this.onlineUsers.get(userId) ?? 0) > 0;
  }

  getOnlineUserIds() {
    return [...this.onlineUsers.entries()]
      .filter(([, count]) => count > 0)
      .map(([userId]) => userId);
  }

  private async authenticateSocket(socket: Socket) {
    const token = this.extractToken(socket);

    if (!token) {
      throw new UnauthorizedException('Missing socket token.');
    }

    const payload = this.jwtService.verify<JwtPayload>(token);
    const user = await this.userRepository.findOne({
      where: { id: payload.sub },
    });

    if (!user || !user.isActive || user.sessionVersion !== payload.sessionVersion) {
      throw new UnauthorizedException('Sesion invalida o expirada.');
    }

    return payload;
  }

  private extractToken(socket: Socket) {
    const cookieToken = extractTokenFromCookieHeader(socket.handshake.headers.cookie);

    if (cookieToken) {
      return cookieToken;
    }

    const authToken = socket.handshake.auth?.token;

    if (typeof authToken === 'string' && authToken.trim().length > 0) {
      return authToken;
    }

    const authorizationHeader = socket.handshake.headers.authorization;

    if (typeof authorizationHeader === 'string' && authorizationHeader.startsWith('Bearer ')) {
      return authorizationHeader.slice(7).trim();
    }

    return null;
  }

  private canAccessOversightRecordsChannel(role: Role) {
    return [Role.PlantillaVehicular, Role.DirectorGeneral, Role.SuperAdmin, Role.Coordinacion].includes(role);
  }

  private canAccessAuditChannel(role: Role) {
    return role === Role.Coordinacion;
  }

  private markUserOnline(userId: string) {
    const currentCount = this.onlineUsers.get(userId) ?? 0;
    this.onlineUsers.set(userId, currentCount + 1);
  }

  private markUserOffline(userId: string) {
    const currentCount = this.onlineUsers.get(userId) ?? 0;

    if (currentCount <= 1) {
      this.onlineUsers.delete(userId);
      return;
    }

    this.onlineUsers.set(userId, currentCount - 1);
  }

  private emitPresenceUpdate() {
    this.server.emit('presence:updated', {
      onlineUserIds: this.getOnlineUserIds(),
    });
  }
}
