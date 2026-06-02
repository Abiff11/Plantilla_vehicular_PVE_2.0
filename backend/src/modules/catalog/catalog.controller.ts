import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { RequireRoles } from 'src/common/auth/roles.decorator';
import { RolesGuard } from 'src/common/auth/roles.guard';
import { Role } from 'src/common/enums/role.enum';
import { JwtAuthGuard } from 'src/modules/auth/jwt-auth.guard';
import { CatalogService } from './catalog.service';
import { CreateCatalogAliasDto } from './dto/create-catalog-alias.dto';
import { CreateCatalogGroupDto } from './dto/create-catalog-group.dto';
import { CreateCatalogItemDto } from './dto/create-catalog-item.dto';
import { UpdateCatalogItemDto } from './dto/update-catalog-item.dto';

const CATALOG_ADMIN_ROLES = [
  Role.PlantillaVehicular,
  Role.SuperAdmin,
  Role.Coordinacion,
];

@Controller('catalog')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get('regions')
  findAllRegions() {
    return this.catalogService.findAllRegions();
  }

  @Get('record-fields')
  getRecordFieldCatalog() {
    return this.catalogService.getRecordFieldCatalog();
  }

  @Get('groups')
  findAllCatalogGroups() {
    return this.catalogService.findAllCatalogGroups();
  }

  @Post('groups')
  @RequireRoles(...CATALOG_ADMIN_ROLES)
  createCatalogGroup(@Body() dto: CreateCatalogGroupDto) {
    return this.catalogService.createCatalogGroup(dto);
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
  ) {
    return this.catalogService.createCatalogItem(code, dto);
  }

  @Patch('items/:id')
  @RequireRoles(...CATALOG_ADMIN_ROLES)
  updateCatalogItem(
    @Param('id') id: string,
    @Body() dto: UpdateCatalogItemDto,
  ) {
    return this.catalogService.updateCatalogItem(id, dto);
  }

  @Delete('items/:id')
  @RequireRoles(...CATALOG_ADMIN_ROLES)
  softDeleteCatalogItem(@Param('id') id: string) {
    return this.catalogService.softDeleteCatalogItem(id);
  }

  @Post('items/:id/aliases')
  @RequireRoles(...CATALOG_ADMIN_ROLES)
  createCatalogAlias(
    @Param('id') id: string,
    @Body() dto: CreateCatalogAliasDto,
  ) {
    return this.catalogService.createCatalogAlias(id, dto);
  }
}
