import type { Role } from "../types";

// All roles in the system
export const ALL_ROLES: Role[] = [
  "enlace",
  "director_operativo",
  "plantilla_vehicular",
  "director_general",
  "superadmin",
  "coordinacion",
];

// Roles that can use the messenger
export const MESSENGER_ROLES: Role[] = [
  "enlace",
  "plantilla_vehicular",
  "coordinacion",
];

// Route-level role requirements (matches backend guards)
export const ROUTE_ROLES = {
  workspace: ["enlace"] as Role[],
  archive: ["enlace"] as Role[],
  monitor: ["director_operativo"] as Role[],
  overview: ["plantilla_vehicular", "superadmin", "coordinacion"] as Role[],
  vehicleImports: ["plantilla_vehicular", "superadmin", "coordinacion"] as Role[],
  reportsDelegations: ["director_operativo"] as Role[],
  reportsRegional: [
    "plantilla_vehicular",
    "director_general",
    "superadmin",
    "coordinacion",
  ] as Role[],
  insights: [
    "director_general",
    "plantilla_vehicular",
    "superadmin",
    "coordinacion",
  ] as Role[],
  insightsMap: ["director_general", "superadmin", "coordinacion"] as Role[],
  control: ["superadmin", "coordinacion"] as Role[],
  catalogs: ["plantilla_vehicular", "superadmin", "coordinacion"] as Role[],
  controlActivity: ["superadmin", "coordinacion"] as Role[],
} as const;
export function hasAnyRole(userRole: Role, allowed: Role[]): boolean {
  return allowed.includes(userRole);
}
