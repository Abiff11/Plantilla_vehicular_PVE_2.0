import { resolveVehicleDisplayPlate } from "../../lib/vehicle-plates";
import type { RecordFormValues, VehicleRecord } from "../../types";

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
