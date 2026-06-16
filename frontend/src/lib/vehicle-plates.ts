import type { VehicleRecord } from "../types";

const NO_PLATE_VALUES = new Set([
  "",
  "-",
  "N/A",
  "NA",
  "S/P",
  "SP",
  "SINPLACA",
  "SINPLACAS",
]);

function normalizePlateValue(value: unknown) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/gu, "")
    .replace(/[\s-]+/gu, "");
}

export function isValidVehiclePlate(value: unknown) {
  const normalized = normalizePlateValue(value);

  if (NO_PLATE_VALUES.has(normalized)) {
    return false;
  }

  if (!normalized || /^\d+$/u.test(normalized)) {
    return false;
  }

  return /[A-Z]/u.test(normalized) && normalized.length >= 5;
}

export function normalizeVehiclePlate(value: unknown) {
  const normalized = normalizePlateValue(value);
  return isValidVehiclePlate(normalized) ? normalized : "";
}

export function resolveVehicleDisplayPlate(record: VehicleRecord) {
  const candidates = [
    record.plates2026,
    record.plates2025,
    record.plates2024,
    record.previousPlates,
    record.plates,
  ];

  for (const candidate of candidates) {
    const normalized = normalizeVehiclePlate(candidate);

    if (normalized) {
      return normalized;
    }
  }

  return "S/P";
}

export function resolveVehiclePlateSourceLabel(record: VehicleRecord) {
  const candidates: Array<[string, unknown]> = [
    ["Placas 2026", record.plates2026],
    ["Placas 2025", record.plates2025],
    ["Placas 2024", record.plates2024],
    ["Placas anteriores", record.previousPlates],
    ["Placas capturadas", record.plates],
  ];

  return candidates.find(([, value]) => isValidVehiclePlate(value))?.[0] ?? "Sin placas";
}
