import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ControlPersonalIntegrationGuard } from './control-personal-integration.guard';
import { ControlPersonalIntegrationService } from './control-personal-integration.service';
import { LinkControlPersonalCustodianDto } from './dto/link-control-personal-custodian.dto';

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

  @Post('officers/vehicle-summary')
  summarizeVehicles(
    @Body() body: { officers?: Array<{ id?: string; name?: string }> },
  ) {
    return this.service.summarizeVehiclesByOfficers(body?.officers || []);
  }

  @Patch('records/:recordId/custodian-link')
  linkCustodian(
    @Param('recordId', new ParseUUIDPipe()) recordId: string,
    @Body() body: LinkControlPersonalCustodianDto,
  ) {
    return this.service.linkVehicleToOfficer(recordId, body.officerId, body.officerName);
  }
}
