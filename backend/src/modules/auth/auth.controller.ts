import { Body, Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { randomBytes } from 'crypto';
import { CurrentUser } from 'src/common/auth/current-user.decorator';
import { JwtAuthGuard } from './jwt-auth.guard';
import { LoginDto } from './dto/login.dto';
import { AuthService } from './auth.service';

const AUTH_COOKIE_NAME = 'pve_vehicle_access_token';
const CSRF_COOKIE_NAME = 'pve_vehicle_csrf_token';
const AUTH_COOKIE_MAX_AGE_MS = Number(process.env.AUTH_COOKIE_MAX_AGE_MS ?? 8 * 60 * 60 * 1000);

type AuthUser = {
  sub: string;
};

function buildAuthCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: AUTH_COOKIE_MAX_AGE_MS,
  };
}

function buildPublicCookieOptions() {
  return {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: AUTH_COOKIE_MAX_AGE_MS,
  };
}

function createPublicRequestToken() {
  return randomBytes(32).toString('hex');
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(@Body() dto: LoginDto, @Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const ipAddress = request.ip ?? request.socket.remoteAddress ?? 'unknown';
    const authResult = await this.authService.login(dto.email, dto.password, ipAddress);
    const requestToken = createPublicRequestToken();

    response.cookie(AUTH_COOKIE_NAME, authResult.accessToken, buildAuthCookieOptions());
    response.cookie(CSRF_COOKIE_NAME, requestToken, buildPublicCookieOptions());

    return {
      accessToken: '',
      csrfToken: requestToken,
      user: authResult.user,
    };
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  async logout(@CurrentUser() user: AuthUser, @Res({ passthrough: true }) response: Response) {
    response.clearCookie(AUTH_COOKIE_NAME, {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
    });
    response.clearCookie(CSRF_COOKIE_NAME, {
      path: '/',
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
    });

    await this.authService.logout(user.sub);
    return { message: 'Logged out successfully.' };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  findCurrentUser(@CurrentUser() user: AuthUser) {
    return this.authService.findCurrentUser(user.sub);
  }
}
