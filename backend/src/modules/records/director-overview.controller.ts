import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { RequireRoles } from 'src/common/auth/roles.decorator';
import { RolesGuard } from 'src/common/auth/roles.guard';
import { Role } from 'src/common/enums/role.enum';
import { JwtAuthGuard } from 'src/modules/auth/jwt-auth.guard';
import { DirectorOverviewService } from './director-overview.service';

@Controller('records/director-safe')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DirectorOverviewController {
  constructor(private readonly directorOverviewService: DirectorOverviewService) {}

  @Get('overview')
  @RequireRoles(
    Role.DirectorGeneral,
    Role.PlantillaVehicular,
    Role.SuperAdmin,
    Role.Coordinacion,
  )
  findOverview(
    @Query('regionId') regionId?: string,
    @Query('delegationId') delegationId?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.directorOverviewService.findOverview(regionId, delegationId, dateFrom, dateTo);
  }

  @Get('delegations/:delegationId/vehicles')
  @RequireRoles(
    Role.DirectorGeneral,
    Role.PlantillaVehicular,
    Role.SuperAdmin,
    Role.Coordinacion,
  )
  findDelegationVehicles(
    @Param('delegationId') delegationId: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.directorOverviewService.findDelegationVehicles(delegationId, dateFrom, dateTo);
  }
}
