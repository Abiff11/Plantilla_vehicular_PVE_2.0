import { CanActivate, ExecutionContext, Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'node:crypto';

@Injectable()
export class ControlPersonalIntegrationGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext) {
    const expected = this.config.get<string>('CONTROL_PERSONAL_INTEGRATION_TOKEN')?.trim();
    if (!expected) {
      throw new ServiceUnavailableException('La integración con Control de Personal no está configurada');
    }

    const request = context.switchToHttp().getRequest();
    const provided = String(request.headers['x-integration-token'] || '').trim();
    if (!provided || !this.matches(expected, provided)) {
      throw new UnauthorizedException('Token de integración inválido');
    }

    return true;
  }

  private matches(expected: string, provided: string) {
    const expectedBuffer = Buffer.from(expected);
    const providedBuffer = Buffer.from(provided);
    if (expectedBuffer.length !== providedBuffer.length) return false;
    return timingSafeEqual(expectedBuffer, providedBuffer);
  }
}
