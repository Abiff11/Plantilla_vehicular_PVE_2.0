import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { PaginatedMeta, PaginatedResponse } from 'src/common/dto/paginated-query.dto';
import { RealtimeGateway } from 'src/modules/realtime/realtime.gateway';
import { UserEntity } from 'src/modules/users/entities/user.entity';
import { AuditLogEntity } from './entities/audit-log.entity';

type AuditPayload = {
  actorId?: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown>;
};

const SENSITIVE_METADATA_KEYS = [
  /password/i,
  /token/i,
  /secret/i,
  /cookie/i,
  /authorization/i,
  /session/i,
];

function sanitizeMetadataValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeMetadataValue(item));
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, entry]) => {
      if (SENSITIVE_METADATA_KEYS.some((pattern) => pattern.test(key))) {
        return [key, '[REDACTED]'];
      }

      return [key, sanitizeMetadataValue(entry)];
    }),
  );
}

@Injectable()
export class AuditLogsService {
  constructor(
    @InjectRepository(AuditLogEntity)
    private readonly auditLogRepository: Repository<AuditLogEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    private readonly realtimeGateway: RealtimeGateway,
  ) {}

  async register(payload: AuditPayload) {
    const actor = payload.actorId
      ? await this.userRepository.findOneBy({ id: payload.actorId })
      : null;
    const metadata = sanitizeMetadataValue(payload.metadata ?? {});

    const auditLog = await this.auditLogRepository.save(
      this.auditLogRepository.create({
        actor,
        action: payload.action,
        entityType: payload.entityType,
        entityId: payload.entityId,
        metadata: metadata as Record<string, unknown>,
      }),
    );

    this.realtimeGateway.emitAuditCreated(auditLog);

    return auditLog;
  }

  async findAll(page?: number, limit?: number): Promise<AuditLogEntity[] | PaginatedResponse<AuditLogEntity>> {
    const query = this.auditLogRepository
      .createQueryBuilder('auditLog')
      .leftJoinAndSelect('auditLog.actor', 'actor')
      .orderBy('auditLog.createdAt', 'DESC');

    if (page !== undefined && limit !== undefined) {
      const total = await query.getCount();
      const skip = (page - 1) * limit;
      query.skip(skip).take(limit);

      const logs = await query.getMany();
      const totalPages = Math.ceil(total / limit);

      const meta: PaginatedMeta = {
        page,
        limit,
        totalItems: total,
        totalPages,
      };

      return { items: logs, meta };
    }

    return query.take(200).getMany();
  }
}
