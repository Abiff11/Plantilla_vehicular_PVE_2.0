import { Controller, Get, HttpStatus, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { DataSource } from 'typeorm';
import { RequireRoles } from 'src/common/auth/roles.decorator';
import { RolesGuard } from 'src/common/auth/roles.guard';
import { Role } from 'src/common/enums/role.enum';
import { JwtAuthGuard } from 'src/modules/auth/jwt-auth.guard';

@Controller('health')
export class HealthController {
  constructor(private readonly dataSource: DataSource) {}

  @Get()
  async check(@Res() response: Response) {
    const dbStatus = await this.checkDatabase();
    const httpStatus = dbStatus === 'ok' ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE;

    return response.status(httpStatus).json({
      status: dbStatus,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: dbStatus,
    });
  }

  @Get('ready')
  async ready(@Res() response: Response) {
    const dbStatus = await this.checkDatabase();
    const httpStatus = dbStatus === 'ok' ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE;

    return response.status(httpStatus).json({
      status: dbStatus === 'ok' ? 'ready' : 'not_ready',
      database: dbStatus,
      timestamp: new Date().toISOString(),
    });
  }

  @Get('metrics')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequireRoles(Role.SuperAdmin)
  async metrics() {
    const dbStatus = await this.checkDatabase();
    const uptimeSeconds = Math.floor(process.uptime());
    const uptimeMinutes = Math.floor(uptimeSeconds / 60);
    const uptimeHours = Math.floor(uptimeMinutes / 60);

    return {
      process: {
        uptimeSeconds,
        uptimeHuman: `${uptimeHours}h ${uptimeMinutes % 60}m ${uptimeSeconds % 60}s`,
        nodeVersion: process.version,
        memoryUsage: process.memoryUsage(),
      },
      database: {
        status: dbStatus,
      },
    };
  }

  private async checkDatabase(): Promise<'ok' | 'error'> {
    try {
      await this.dataSource.query('SELECT 1');
      return 'ok';
    } catch {
      return 'error';
    }
  }
}
