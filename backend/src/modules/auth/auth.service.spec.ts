import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import { UsersService } from 'src/modules/users/users.service';
import { AuditLogsService } from 'src/modules/audit-logs/audit-logs.service';

describe('AuthService E2E-style', () => {
  let service: AuthService;
  let jwtService: jest.Mocked<JwtService>;
  let usersService: jest.Mocked<UsersService>;
  let auditLogsService: jest.Mocked<AuditLogsService>;

  const testPassword = 'Str0ng@Pass1';
  const hashedPassword = bcrypt.hashSync(testPassword, 10);

  beforeEach(async () => {
    const mockUsersService = {
      findByEmail: jest.fn(),
      findOne: jest.fn(),
      revokeSessions: jest.fn().mockResolvedValue(undefined),
    };

    const mockAuditLogsService = {
      register: jest.fn().mockResolvedValue(undefined),
    };

    const mockJwtService = {
      signAsync: jest.fn().mockResolvedValue('mocked-access-token'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: mockUsersService },
        { provide: AuditLogsService, useValue: mockAuditLogsService },
        { provide: JwtService, useValue: mockJwtService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    usersService = module.get(UsersService);
    auditLogsService = module.get(AuditLogsService);
    jwtService = module.get(JwtService);
  });

  describe('login success flow', () => {
    it('returns access token and user on valid credentials', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        passwordHash: hashedPassword,
        role: 'capturist',
        firstName: 'TEST',
        lastName: 'USER',
        grade: 'OFFICIAL',
        phone: '5550000001',
        region: null,
        delegation: null,
        isActive: true,
        sessionVersion: 0,
      } as never;

      usersService.findByEmail.mockResolvedValue(mockUser);
      usersService.findOne.mockResolvedValue(mockUser);

      const result = await service.login('test@example.com', testPassword, '127.0.0.1');

      expect(result.accessToken).toBe('mocked-access-token');
      expect(jwtService.signAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          sub: 'user-1',
          email: 'test@example.com',
          role: 'capturist',
          sessionVersion: 0,
        }),
      );
      expect(auditLogsService.register).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'USER_LOGGED_IN',
          actorId: 'user-1',
        }),
      );
    });

    it('normalizes email before lookup', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        passwordHash: hashedPassword,
        role: 'capturist',
        firstName: 'TEST',
        lastName: 'USER',
        grade: 'OFFICIAL',
        phone: '5550000001',
        region: null,
        delegation: null,
        isActive: true,
        sessionVersion: 0,
      } as never;

      usersService.findByEmail.mockResolvedValue(mockUser);
      usersService.findOne.mockResolvedValue(mockUser);

      await service.login('  TEST@Example.COM  ', testPassword, '127.0.0.1');

      expect(usersService.findByEmail).toHaveBeenCalledWith('test@example.com');
    });
  });

  describe('login failure flows', () => {
    it('throws UnauthorizedException for non-existent user', async () => {
      usersService.findByEmail.mockResolvedValue(null);

      await expect(
        service.login('unknown@example.com', 'any-password', '127.0.0.1'),
      ).rejects.toThrow(UnauthorizedException);

      expect(auditLogsService.register).not.toHaveBeenCalled();
    });

    it('throws UnauthorizedException for wrong password', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        passwordHash: hashedPassword,
        role: 'capturist',
        firstName: 'TEST',
        lastName: 'USER',
        grade: 'OFFICIAL',
        phone: '5550000001',
        region: null,
        delegation: null,
        isActive: true,
        sessionVersion: 0,
      } as never;

      usersService.findByEmail.mockResolvedValue(mockUser);

      await expect(
        service.login('test@example.com', 'wrong-password', '127.0.0.1'),
      ).rejects.toThrow(UnauthorizedException);

      expect(auditLogsService.register).not.toHaveBeenCalled();
    });
  });

  describe('logout flow', () => {
    it('revokes sessions and registers USER_LOGGED_OUT audit event', async () => {
      await service.logout('user-1');

      expect(usersService.revokeSessions).toHaveBeenCalledWith('user-1');
      expect(auditLogsService.register).toHaveBeenCalledWith({
        actorId: 'user-1',
        action: 'USER_LOGGED_OUT',
        entityType: 'user',
        entityId: 'user-1',
      });
    });
  });

  describe('login rate limiting', () => {
    it('allows 5 attempts then blocks', async () => {
      usersService.findByEmail.mockResolvedValue(null);

      for (let i = 0; i < 5; i += 1) {
        await expect(
          service.login('test@example.com', 'wrong', '127.0.0.1'),
        ).rejects.toThrow(UnauthorizedException);
      }

      await expect(
        service.login('test@example.com', 'wrong', '127.0.0.1'),
      ).rejects.toThrow('Demasiados intentos de inicio de sesion');
    });
  });
});