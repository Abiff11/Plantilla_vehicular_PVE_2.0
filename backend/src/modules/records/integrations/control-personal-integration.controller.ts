import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { ControlPersonalIntegrationGuard } from './control-personal-integration.guard';
import { ControlPersonalIntegrationService } from './control-personal-integration.service';

@Controller('integrations/control-personal')
@UseGuards(ControlPersonalIntegrationGuard)
export class ControlPersonalIntegrationController {
  constructor(private readonly service: ControlPersonalIntegrationService) {}

  @Get('officers/:officerId/vehicles')
  findVehicles(
    @Param('officerId', new ParseUUIDPipe()) officerId: string,
    @Query('name') officerName?: string,
  ) {
    return this.service.findVehiclesByOfficer(officerId, officerName);
  }
}
