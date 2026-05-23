import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role } from 'src/common/enums/role.enum';
import { AuditLogsService } from 'src/modules/audit-logs/audit-logs.service';
import { DelegationEntity } from 'src/modules/catalog/entities/delegation.entity';
import { RegionEntity } from 'src/modules/catalog/entities/region.entity';
import { UserEntity } from './entities/user.entity';
import { UsersService } from './users.service';

function createMockUser(overrides: Partial<UserEntity> = {}): UserEntity {
  return {
    id: 'test-user-id',
    firstName: 'TEST',
    lastName: 'USER',
    grade: 'OFFICER',
    phone: '1234567890',
    email: 'test@example.com',
    passwordHash: 'hashed',
    role: Role.Enlace,
    isActive: true,
    sessionVersion: 0,
    region: null,
    delegation: null,
    createdRecords: [],
    auditLogs: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  } as UserEntity;
}

describe('UsersService', () => {
  let service: UsersService;
  let userRepository: jest.Mocked<Repository<UserEntity>>;

  beforeEach(async () => {
    const mockUserRepo = {
      findOne: jest.fn(),
      findOneBy: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      softDelete: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(UserEntity),
          useValue: mockUserRepo,
        },
        {
          provide: getRepositoryToken(RegionEntity),
          useValue: { findOneBy: jest.fn() },
        },
        {
          provide: getRepositoryToken(DelegationEntity),
          useValue: { findOne: jest.fn(), findOneBy: jest.fn() },
        },
        {
          provide: AuditLogsService,
          useValue: {
            register: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    userRepository = module.get(getRepositoryToken(UserEntity));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('throws ConflictException when email already exists', async () => {
      userRepository.findOne.mockResolvedValue(createMockUser());

      await expect(
        service.create({
          firstName: 'New',
          lastName: 'User',
          grade: 'OFFICER',
          phone: '0000000000',
          email: 'test@example.com',
          password: 'StrongP@ss1',
          role: Role.Enlace,
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('throws ConflictException when soft-deleted email exists', async () => {
      userRepository.findOne.mockResolvedValue(
        createMockUser({ deletedAt: new Date() }),
      );

      await expect(
        service.create({
          firstName: 'New',
          lastName: 'User',
          grade: 'OFFICER',
          phone: '0000000000',
          email: 'test@example.com',
          password: 'StrongP@ss1',
          role: Role.Enlace,
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('update', () => {
    it('throws ConflictException when updating to an existing email', async () => {
      const currentUser = createMockUser({ email: 'old@example.com' });
      const existingOtherUser = createMockUser({ email: 'new@example.com' });

      userRepository.findOne
        .mockResolvedValueOnce(currentUser)
        .mockResolvedValueOnce(existingOtherUser);

      await expect(
        service.update('user-id', { email: 'new@example.com' }),
      ).rejects.toThrow(ConflictException);
    });

    it('throws ForbiddenException when editing superadmin', async () => {
      const superadmin = createMockUser({ role: Role.SuperAdmin });
      userRepository.findOne.mockResolvedValue(superadmin);

      await expect(
        service.update('user-id', { firstName: 'New' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException when user does not exist', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(
        service.update('nonexistent', { firstName: 'New' }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});