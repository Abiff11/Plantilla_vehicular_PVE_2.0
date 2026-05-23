import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Request } from 'express';
import { UsersService } from 'src/modules/users/users.service';
import { JwtPayload } from './jwt-payload.type';

const AUTH_COOKIE_NAME = 'pve_vehicle_access_token';

function extractCookieToken(request: Request): string | null {
  const cookieHeader = request.headers.cookie;

  if (!cookieHeader) {
    return null;
  }

  const cookies = cookieHeader.split(';').map((cookie) => cookie.trim());
  const authCookie = cookies.find((cookie) => cookie.startsWith(`${AUTH_COOKIE_NAME}=`));

  if (!authCookie) {
    return null;
  }

  return decodeURIComponent(authCookie.slice(AUTH_COOKIE_NAME.length + 1));
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly usersService: UsersService,
  ) {
    const jwtSecret = configService.get<string>('JWT_SECRET');

    const knownInsecureSecrets = [
      'change_me',
      'secret',
      'jwt_secret',
      'changeme',
      'password',
      'replace_with_a_long_random_secret',
      'change_this_to_a_long_random_secret_at_least_16_chars',
    ];

    if (!jwtSecret || knownInsecureSecrets.includes(jwtSecret) || jwtSecret.length < 16) {
      throw new Error(
        'JWT_SECRET must be configured with a strong secret (minimum 16 characters, not a common placeholder).',
      );
    }

    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        extractCookieToken,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: jwtSecret,
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.usersService.findOneEntity(payload.sub);

    if (!user.isActive || user.sessionVersion !== payload.sessionVersion) {
      throw new UnauthorizedException('Sesion invalida o expirada.');
    }

    return payload;
  }
}
