import {
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { AuditLogsService } from 'src/modules/audit-logs/audit-logs.service';
import { UsersService } from 'src/modules/users/users.service';

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

type LoginAttempt = {
  firstAttemptAt: number;
  attempts: number;
};

const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_WINDOW_MS = 10 * 60 * 1000;

@Injectable()
export class AuthService {
  private readonly loginAttempts = new Map<string, LoginAttempt>();
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  async login(email: string, password: string, ipAddress: string) {
    const normalizedEmail = normalizeEmail(email);
    const attemptKey = `${ipAddress}:${normalizedEmail}`;
    this.assertRateLimit(attemptKey);

    const user = await this.usersService.findByEmail(normalizedEmail);

    if (!user || !user.isActive) {
      this.registerFailedAttempt(attemptKey);
      throw new UnauthorizedException('Credenciales invalidas.');
    }

    const isValidPassword = await bcrypt.compare(password, user.passwordHash);

    if (!isValidPassword) {
      this.registerFailedAttempt(attemptKey);
      throw new UnauthorizedException('Credenciales invalidas.');
    }

    this.clearAttempt(attemptKey);

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      regionId: user.region?.id ?? user.delegation?.region?.id ?? null,
      delegationId: user.delegation?.id ?? null,
      sessionVersion: user.sessionVersion,
    };

    await this.auditLogsService.register({
      actorId: user.id,
      action: 'USER_LOGGED_IN',
      entityType: 'user',
      entityId: user.id,
      metadata: {
        email: user.email,
      },
    });

    return {
      accessToken: await this.jwtService.signAsync(payload),
      user: await this.usersService.findOne(user.id),
    };
  }

  findCurrentUser(userId: string) {
    return this.usersService.findOne(userId);
  }

  async logout(userId: string) {
    await this.usersService.revokeSessions(userId);

    await this.auditLogsService.register({
      actorId: userId,
      action: 'USER_LOGGED_OUT',
      entityType: 'user',
      entityId: userId,
    });
  }

  private assertRateLimit(attemptKey: string) {
    this.cleanupStaleAttempts();
    const currentAttempt = this.loginAttempts.get(attemptKey);

    if (!currentAttempt) {
      return;
    }

    const now = Date.now();

    if (now - currentAttempt.firstAttemptAt > LOGIN_WINDOW_MS) {
      this.loginAttempts.delete(attemptKey);
      return;
    }

    if (currentAttempt.attempts >= MAX_LOGIN_ATTEMPTS) {
      throw new HttpException(
        'Demasiados intentos de inicio de sesion. Intenta nuevamente mas tarde.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private registerFailedAttempt(attemptKey: string) {
    this.cleanupStaleAttempts();
    const now = Date.now();
    const currentAttempt = this.loginAttempts.get(attemptKey);

    if (!currentAttempt || now - currentAttempt.firstAttemptAt > LOGIN_WINDOW_MS) {
      this.loginAttempts.set(attemptKey, {
        firstAttemptAt: now,
        attempts: 1,
      });
      return;
    }

    this.loginAttempts.set(attemptKey, {
      firstAttemptAt: currentAttempt.firstAttemptAt,
      attempts: currentAttempt.attempts + 1,
    });
  }

  private clearAttempt(attemptKey: string) {
    this.loginAttempts.delete(attemptKey);
  }

  private cleanupStaleAttempts() {
    const now = Date.now();

    for (const [attemptKey, attempt] of this.loginAttempts.entries()) {
      if (now - attempt.firstAttemptAt > LOGIN_WINDOW_MS) {
        this.loginAttempts.delete(attemptKey);
      }
    }
  }
}
