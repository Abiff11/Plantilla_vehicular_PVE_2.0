import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { Repository } from 'typeorm';
import { Role } from 'src/common/enums/role.enum';
import type { PaginatedMeta, PaginatedResponse } from 'src/common/dto/paginated-query.dto';
import { DelegationEntity } from 'src/modules/catalog/entities/delegation.entity';
import { RegionEntity } from 'src/modules/catalog/entities/region.entity';
import { AuditLogsService } from 'src/modules/audit-logs/audit-logs.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserEntity } from './entities/user.entity';

function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, ' ');
}

function normalizeEmail(value: string) {
  return normalizeText(value).toLowerCase();
}

const PRIVILEGED_ROLES = [Role.SuperAdmin, Role.Coordinacion];

function sanitizeUserAuditMetadata(dto: UpdateUserDto) {
  const { password: _password, ...safeMetadata } = dto;
  return {
    ...safeMetadata,
    passwordChanged: Boolean(dto.password),
  };
}

export type SafeUser = Omit<UserEntity, 'passwordHash'> & {
  fullName: string;
};

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    @InjectRepository(RegionEntity)
    private readonly regionRepository: Repository<RegionEntity>,
    @InjectRepository(DelegationEntity)
    private readonly delegationRepository: Repository<DelegationEntity>,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  async create(dto: CreateUserDto, actorId?: string) {
    await this.assertPrivilegedRoleChangeAllowed(dto.role, actorId);

    const normalizedEmail = normalizeEmail(dto.email);
    const existingUser = await this.userRepository.findOne({
      where: { email: normalizedEmail },
      withDeleted: true,
    });

    if (existingUser) {
      throw new ConflictException('El correo electronico ya esta registrado.');
    }

    const region = dto.regionId
      ? await this.regionRepository.findOneBy({ id: dto.regionId })
      : null;
    const delegation = dto.delegationId
      ? await this.delegationRepository.findOne({
          where: { id: dto.delegationId },
          relations: { region: true },
        })
      : null;

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const user = await this.userRepository.save(
      this.userRepository.create({
        firstName: normalizeText(dto.firstName).toUpperCase(),
        lastName: normalizeText(dto.lastName).toUpperCase(),
        grade: normalizeText(dto.grade).toUpperCase(),
        phone: normalizeText(dto.phone),
        email: normalizedEmail,
        passwordHash,
        role: dto.role,
        region,
        delegation,
      }),
    );

    await this.auditLogsService.register({
      actorId,
      action: 'USER_CREATED',
      entityType: 'user',
      entityId: user.id,
      metadata: {
        role: user.role,
        email: user.email,
      },
    });

    return this.findOne(user.id);
  }

  async findAll(page?: number, limit?: number): Promise<SafeUser[] | PaginatedResponse<SafeUser>> {
    const query = this.userRepository.createQueryBuilder('user')
      .leftJoinAndSelect('user.region', 'region')
      .leftJoinAndSelect('user.delegation', 'delegation')
      .leftJoinAndSelect('delegation.region', 'delegationRegion')
      .where('user.deletedAt IS NULL')
      .orderBy('user.firstName', 'ASC')
      .addOrderBy('user.lastName', 'ASC');

    if (page !== undefined && limit !== undefined) {
      const total = await query.getCount();
      const skip = (page - 1) * limit;
      query.skip(skip).take(limit);

      const users = await query.getMany();
      const safeUsers = users.map((user) => this.toSafeUser(user));
      const totalPages = Math.ceil(total / limit);

      const meta: PaginatedMeta = {
        page,
        limit,
        totalItems: total,
        totalPages,
      };

      return { items: safeUsers, meta };
    }

    const users = await query.getMany();
    return users.map((user) => this.toSafeUser(user));
  }

  async findOne(id: string) {
    const user = await this.userRepository.findOne({
      where: { id },
      relations: {
        region: true,
        delegation: {
          region: true,
        },
      },
    });

    if (!user) {
      throw new NotFoundException('No se encontro el usuario.');
    }

    return this.toSafeUser(user);
  }

  async findOneEntity(id: string) {
    const user = await this.userRepository.findOne({
      where: { id },
      relations: {
        region: true,
        delegation: {
          region: true,
        },
      },
    });

    if (!user) {
      throw new NotFoundException('No se encontro el usuario.');
    }

    return user;
  }

  findByEmail(email: string) {
    return this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .leftJoinAndSelect('user.region', 'region')
      .leftJoinAndSelect('user.delegation', 'delegation')
      .leftJoinAndSelect('delegation.region', 'delegationRegion')
      .where('user.email = :email', { email: email.toLowerCase() })
      .andWhere('user.deletedAt IS NULL')
      .getOne();
  }

  async update(id: string, dto: UpdateUserDto, actorId?: string) {
    const user = await this.findOneEntity(id);

    await this.assertPrivilegedUserManagementAllowed(user.role, actorId);

    if (actorId === id && dto.role && dto.role !== Role.SuperAdmin) {
      throw new ForbiddenException('El superadministrador no puede retirar su propio rol.');
    }

    if (dto.role) {
      await this.assertPrivilegedRoleChangeAllowed(dto.role, actorId);
    }

    if (dto.email) {
      const normalizedEmail = normalizeEmail(dto.email);

      if (normalizedEmail !== user.email) {
        const existingUser = await this.userRepository.findOne({
          where: { email: normalizedEmail },
          withDeleted: true,
        });

        if (existingUser) {
          throw new ConflictException('El correo electronico ya esta registrado.');
        }

        user.email = normalizedEmail;
      }
    }

    if (dto.password) {
      user.passwordHash = await bcrypt.hash(dto.password, 10);
      user.sessionVersion += 1;
    }

    if (dto.firstName) {
      user.firstName = normalizeText(dto.firstName).toUpperCase();
    }

    if (dto.lastName) {
      user.lastName = normalizeText(dto.lastName).toUpperCase();
    }

    if (dto.grade) {
      user.grade = normalizeText(dto.grade).toUpperCase();
    }

    if (dto.phone) {
      user.phone = normalizeText(dto.phone);
    }

    if (dto.role) {
      user.role = dto.role;
    }

    if (dto.regionId !== undefined) {
      user.region = dto.regionId
        ? await this.regionRepository.findOneBy({ id: dto.regionId })
        : null;
    }

    if (dto.delegationId !== undefined) {
      user.delegation = dto.delegationId
        ? await this.delegationRepository.findOneBy({ id: dto.delegationId })
        : null;
    }

    await this.userRepository.save(user);

    await this.auditLogsService.register({
      actorId,
      action: 'USER_UPDATED',
      entityType: 'user',
      entityId: user.id,
      metadata: sanitizeUserAuditMetadata(dto),
    });

    return this.findOne(id);
  }

  async softDelete(id: string, actorId?: string) {
    const user = await this.findOneEntity(id);

    if (actorId === id) {
      throw new ForbiddenException('No puedes eliminar tu propia cuenta.');
    }

    await this.assertPrivilegedUserManagementAllowed(user.role, actorId);

    user.isActive = false;
    user.sessionVersion += 1;
    await this.userRepository.save(user);
    await this.userRepository.softDelete(id);

    await this.auditLogsService.register({
      actorId,
      action: 'USER_SOFT_DELETED',
      entityType: 'user',
      entityId: user.id,
      metadata: {
        email: user.email,
      },
    });
  }

  async revokeSessions(id: string) {
    const user = await this.findOneEntity(id);
    user.sessionVersion += 1;
    await this.userRepository.save(user);
  }

  private async assertPrivilegedUserManagementAllowed(
    targetRole: Role,
    actorId?: string,
  ) {
    if (!PRIVILEGED_ROLES.includes(targetRole)) {
      return;
    }

    if (!actorId) {
      throw new ForbiddenException(
        'Solo superadmin puede administrar usuarios privilegiados.',
      );
    }

    const actor = await this.userRepository.findOne({
      where: { id: actorId },
    });

    if (!actor || actor.role !== Role.SuperAdmin) {
      throw new ForbiddenException(
        'Solo superadmin puede administrar usuarios privilegiados.',
      );
    }
  }

  private async assertPrivilegedRoleChangeAllowed(role: Role, actorId?: string) {
    if (!PRIVILEGED_ROLES.includes(role)) {
      return;
    }

    if (!actorId) {
      throw new ForbiddenException('Solo superadmin puede crear o asignar roles privilegiados.');
    }

    const actor = await this.userRepository.findOne({
      where: { id: actorId },
    });

    if (!actor || actor.role !== Role.SuperAdmin) {
      throw new ForbiddenException('Solo superadmin puede crear o asignar roles privilegiados.');
    }
  }

  private toSafeUser(user: UserEntity): SafeUser {
    const { passwordHash: _passwordHash, ...safeUser } = user;

    return {
      ...safeUser,
      fullName: `${user.firstName} ${user.lastName}`.trim(),
    };
  }
}
