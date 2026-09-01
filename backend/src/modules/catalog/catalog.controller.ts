import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from 'src/common/auth/current-user.decorator';
import { CATALOG_ADMIN_ROLES } from 'src/common/auth/role-groups';
import { RequireRoles } from 'src/common/auth/roles.decorator';
import { RolesGuard } from 'src/common/auth/roles.guard';
import { JwtAuthGuard } from 'src/modules/auth/jwt-auth.guard';
import { CatalogService } from './catalog.service';
import { CreateCatalogAliasDto } from './dto/create-catalog-alias.dto';
import { CreateCatalogGroupDto } from './dto/create-catalog-group.dto';
import { CreateCatalogItemDto } from './dto/create-catalog-item.dto';
import { UpdateCatalogItemDto } from './dto/update-catalog-item.dto';
import { VehicleFormCatalogService } from './vehicle-form-catalog.service';

type AuthUser = {
  sub: string;
};

@Controller('catalog')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CatalogController {
  constructor(
    private readonly catalogService: CatalogService,
    private readonly vehicleFormCatalogService: VehicleFormCatalogService,
  ) {}

  @Get('regions')
  findAllRegions() {
    return this.catalogService.findAllRegions();
  }

  @Get('record-fields')
  getRecordFieldCatalog() {
    return this.vehicleFormCatalogService.getRecordFieldCatalog();
  }

  @Get('groups')
  findAllCatalogGroups() {
    return this.catalogService.findAllCatalogGroups();
  }

  @Post('groups')
  @RequireRoles(...CATALOG_ADMIN_ROLES)
  createCatalogGroup(
    @Body() dto: CreateCatalogGroupDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.catalogService.createCatalogGroup(dto, user);
  }

  @Get('groups/:code/items')
  findCatalogItemsByGroupCode(@Param('code') code: string) {
    return this.catalogService.findCatalogItemsByGroupCode(code);
  }

  @Post('groups/:code/items')
  @RequireRoles(...CATALOG_ADMIN_ROLES)
  createCatalogItem(
    @Param('code') code: string,
    @Body() dto: CreateCatalogItemDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.catalogService.createCatalogItem(code, dto, user);
  }

  @Patch('items/:id')
  @RequireRoles(...CATALOG_ADMIN_ROLES)
  updateCatalogItem(
    @Param('id') id: string,
    @Body() dto: UpdateCatalogItemDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.catalogService.updateCatalogItem(id, dto, user);
  }

  @Delete('items/:id')
  @RequireRoles(...CATALOG_ADMIN_ROLES)
  softDeleteCatalogItem(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.catalogService.softDeleteCatalogItem(id, user);
  }

  @Post('items/:id/aliases')
  @RequireRoles(...CATALOG_ADMIN_ROLES)
  createCatalogAlias(
    @Param('id') id: string,
    @Body() dto: CreateCatalogAliasDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.catalogService.createCatalogAlias(id, dto, user);
  }
}
