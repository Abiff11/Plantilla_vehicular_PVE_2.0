import { resolveVehicleDisplayPlate } from "../../lib/vehicle-plates";
import type {
  RecordFormValues,
  VehicleEditFormValues,
  VehicleRecord,
} from "../../types";

export function recordToFormValues(record: VehicleRecord): RecordFormValues {
  return {
    delegationId: record.delegation.id,
    plates: resolveVehicleDisplayPlate(record),
    brand: record.brand,
    type: record.type,
    useType: record.useType,
    vehicleClass: record.vehicleClass,
    model: record.model,
    engineNumber: record.engineNumber,
    serialNumber: record.serialNumber,
    custodian: record.custodian,
    patrolNumber: record.patrolNumber,
    physicalStatus: record.physicalStatus,
    status: record.status,
    assetClassification: record.assetClassification,
    observation: record.observation,
  };
}

export function recordToEditFormValues(record: VehicleRecord): VehicleEditFormValues {
  return {
    civ: record.civ,
    previousPlates: record.previousPlates,
    plates2024: record.plates2024,
    plates2025: record.plates2025,
    plates2026: record.plates2026,
    plates: record.plates,
    brand: record.brand,
    type: record.type,
    useType: record.useType,
    vehicleClass: record.vehicleClass,
    model: record.model,
    cylinders: record.cylinders,
    fuelCapacityLiters: record.fuelCapacityLiters,
    engineNumber: record.engineNumber,
    serialNumber: record.serialNumber,
    custodian: record.custodian,
    patrolNumber: record.patrolNumber,
    color: record.color,
    adscription: record.adscription,
    realLocation: record.realLocation,
    physicalStatus: record.physicalStatus,
    status: record.status,
    rawCirculationStatus: record.rawCirculationStatus,
    assetClassification: record.assetClassification,
    rawAssetClassification: record.rawAssetClassification,
    sourceSection: record.sourceSection,
    sourceRowNumber: record.sourceRowNumber,
    observation: record.observation,
  };
}
