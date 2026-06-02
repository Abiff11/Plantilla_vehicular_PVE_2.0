import { Role } from '../enums/role.enum';

export const VEHICLE_ADMIN_ROLES = [
  Role.PlantillaVehicular,
  Role.SuperAdmin,
  Role.Coordinacion,
] as const;

export const CATALOG_ADMIN_ROLES = VEHICLE_ADMIN_ROLES;
export const IMPORT_ADMIN_ROLES = VEHICLE_ADMIN_ROLES;
