import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { resolveVehicleDisplayPlate } from '../lib/vehicle-plates';
import type {
  RecordFieldCatalog,
  RecordFieldCatalogMap,
  VehicleEditPayload,
  VehicleRecord,
} from '../types';

const customCatalogFields = ['useType', 'status', 'assetClassification'] as const;

const schema = z
  .object({
    plates: z.string(),
    civ: z.string(),
    previousPlates: z.string(),
    plates2024: z.string(),
    plates2025: z.string(),
    plates2026: z.string(),
    brand: z.string(),
    type: z.string(),
    useType: z.string(),
    useTypeCustom: z.string().optional(),
    vehicleClass: z.string(),
    model: z.string(),
    cylinders: z.string(),
    fuelCapacityLiters: z.string(),
    engineNumber: z.string(),
    serialNumber: z.string(),
    custodian: z.string(),
    patrolNumber: z.string(),
    color: z.string(),
    adscription: z.string(),
    realLocation: z.string(),
    physicalStatus: z.string(),
    status: z.string(),
    statusCustom: z.string().optional(),
    rawCirculationStatus: z.string(),
    assetClassification: z.string(),
    assetClassificationCustom: z.string().optional(),
    rawAssetClassification: z.string(),
    sourceSection: z.string(),
    sourceRowNumber: z.string(),
    observation: z.string(),
  })
  .superRefine((values, context) => {
    for (const fieldName of customCatalogFields) {
      const customFieldName = `${fieldName}Custom` as const;

      if (values[fieldName] === 'OTRO' && !values[customFieldName]?.trim()) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Captura el valor personalizado.',
          path: [customFieldName],
        });
      }
    }
  });

type VehicleEditFormData = z.infer<typeof schema>;

type VehicleEditModalProps = {
  record: VehicleRecord;
  fieldCatalogs: RecordFieldCatalogMap;
  onSubmit: (values: VehicleEditPayload) => Promise<void>;
  onCancel: () => void;
};

function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, ' ');
}

function normalizeUpper(value: string) {
  return normalizeText(value).toUpperCase();
}

function splitCatalogValue(value: string, catalog: RecordFieldCatalog) {
  const exactValue = catalog.options.find((option) => option.value === value)?.value ?? '';

  if (exactValue) {
    return { value: exactValue, customValue: '' };
  }

  if (catalog.allowsCustom && value.trim()) {
    return { value: 'OTRO', customValue: value };
  }

  return { value, customValue: '' };
}

function buildFormData(
  record: VehicleRecord,
  fieldCatalogs: RecordFieldCatalogMap,
): VehicleEditFormData {
  const useType = splitCatalogValue(record.useType, fieldCatalogs.useType);
  const status = splitCatalogValue(record.status, fieldCatalogs.status);
  const assetClassification = splitCatalogValue(
    record.assetClassification,
    fieldCatalogs.assetClassification,
  );

  return {
    plates: record.plates,
    civ: record.civ,
    previousPlates: record.previousPlates,
    plates2024: record.plates2024,
    plates2025: record.plates2025,
    plates2026: record.plates2026,
    brand: record.brand,
    type: record.type,
    useType: useType.value,
    useTypeCustom: useType.customValue,
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
    status: status.value,
    statusCustom: status.customValue,
    rawCirculationStatus: record.rawCirculationStatus,
    assetClassification: assetClassification.value,
    assetClassificationCustom: assetClassification.customValue,
    rawAssetClassification: record.rawAssetClassification,
    sourceSection: record.sourceSection,
    sourceRowNumber: record.sourceRowNumber?.toString() ?? '',
    observation: record.observation,
  };
}

function buildPayload(values: VehicleEditFormData): VehicleEditPayload {
  const rowNumber = values.sourceRowNumber.trim();

  return {
    plates: normalizeUpper(values.plates),
    civ: normalizeUpper(values.civ),
    previousPlates: normalizeUpper(values.previousPlates),
    plates2024: normalizeUpper(values.plates2024),
    plates2025: normalizeUpper(values.plates2025),
    plates2026: normalizeUpper(values.plates2026),
    brand: normalizeUpper(values.brand),
    type: normalizeUpper(values.type),
    useType: normalizeUpper(values.useType === 'OTRO' ? values.useTypeCustom ?? '' : values.useType),
    vehicleClass: normalizeUpper(values.vehicleClass),
    model: normalizeUpper(values.model),
    cylinders: normalizeUpper(values.cylinders),
    fuelCapacityLiters: normalizeUpper(values.fuelCapacityLiters),
    engineNumber: normalizeUpper(values.engineNumber),
    serialNumber: normalizeUpper(values.serialNumber),
    custodian: normalizeUpper(values.custodian),
    patrolNumber: normalizeUpper(values.patrolNumber),
    color: normalizeUpper(values.color),
    adscription: normalizeUpper(values.adscription),
    realLocation: normalizeUpper(values.realLocation),
    physicalStatus: normalizeUpper(values.physicalStatus),
    status: normalizeUpper(values.status === 'OTRO' ? values.statusCustom ?? '' : values.status),
    rawCirculationStatus: normalizeUpper(values.rawCirculationStatus),
    assetClassification: normalizeUpper(
      values.assetClassification === 'OTRO'
        ? values.assetClassificationCustom ?? ''
        : values.assetClassification,
    ),
    rawAssetClassification: normalizeText(values.rawAssetClassification),
    sourceSection: normalizeUpper(values.sourceSection),
    sourceRowNumber: rowNumber && /^\d+$/u.test(rowNumber) ? Number(rowNumber) : null,
    observation: normalizeText(values.observation),
  };
}

function CatalogField({
  label,
  fieldName,
  catalog,
  register,
  selectedValue,
}: {
  label: string;
  fieldName: 'useType' | 'status' | 'assetClassification';
  catalog: RecordFieldCatalog;
  register: ReturnType<typeof useForm<VehicleEditFormData>>['register'];
  selectedValue: string;
}) {
  const customFieldName =
    fieldName === 'useType'
      ? 'useTypeCustom'
      : fieldName === 'status'
        ? 'statusCustom'
        : 'assetClassificationCustom';

  return (
    <div className="field">
      <span>{label}</span>
      <select id={fieldName} {...register(fieldName)}>
        <option value="">Selecciona una opción</option>
        {catalog.options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {catalog.allowsCustom && selectedValue === 'OTRO' && (
        <input
          id={customFieldName}
          placeholder={`Especifica ${label.toLowerCase()}`}
          {...register(customFieldName)}
        />
      )}
    </div>
  );
}

export function VehicleEditModal({
  record,
  fieldCatalogs,
  onSubmit,
  onCancel,
}: VehicleEditModalProps) {
  const initialValues = useMemo(
    () => buildFormData(record, fieldCatalogs),
    [fieldCatalogs, record],
  );
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { isSubmitting },
  } = useForm<VehicleEditFormData>({
    resolver: zodResolver(schema),
    defaultValues: initialValues,
  });

  useEffect(() => {
    reset(initialValues);
  }, [initialValues, reset]);

  const plateLabel = resolveVehicleDisplayPlate(record);
  const selectedUseType = watch('useType');
  const selectedStatus = watch('status');
  const selectedAssetClassification = watch('assetClassification');

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content vehicle-edit-modal" onClick={(event) => event.stopPropagation()}>
        <div className="vehicle-edit-header">
          <div>
            <p className="eyebrow">Edición completa</p>
            <h3>{plateLabel}</h3>
            <p>
              {record.delegation.name} · {record.viewDelegation.name}
            </p>
          </div>
          <div className="vehicle-edit-header-meta">
            <span className="record-chip is-info">
              {record.recordState === 'CURRENT' ? 'Vigente' : 'Trasladado'}
            </span>
            <span className="record-chip">{record.importBatchId ? 'Importado' : 'Manual'}</span>
          </div>
        </div>

        <form
          className="stack-md"
          onSubmit={handleSubmit(async (values) => {
            await onSubmit(buildPayload(values));
          })}
        >
          <section className="vehicle-edit-hero">
            <div>
              <span className="vehicle-detail-eyebrow">Kardex vehicular</span>
              <h4>Edición de captura</h4>
              <p>Actualiza solo los campos que vienen del Excel y los metadatos de control.</p>
            </div>
            <div className="vehicle-edit-hero-meta">
              <span className="record-chip is-info">
                {record.recordState === 'CURRENT' ? 'Vigente' : 'Trasladado'}
              </span>
              <span className="record-chip">{record.importBatchId ? 'Importado' : 'Manual'}</span>
            </div>
          </section>

          <section className="vehicle-edit-section">
            <div className="vehicle-edit-section-head">
              <h4>Placas</h4>
              <span>Placa principal: {plateLabel}</span>
            </div>
            <div className="form-grid vehicle-edit-grid">
              <label className="field">
                <span>CIV</span>
                <input id="civ" {...register('civ')} />
              </label>
              <label className="field">
                <span>Placas anteriores</span>
                <input id="previousPlates" {...register('previousPlates')} />
              </label>
              <label className="field">
                <span>Placas 2024</span>
                <input id="plates2024" {...register('plates2024')} />
              </label>
              <label className="field">
                <span>Placas 2025</span>
                <input id="plates2025" {...register('plates2025')} />
              </label>
              <label className="field">
                <span>Placas 2026</span>
                <input id="plates2026" {...register('plates2026')} />
              </label>
            </div>
          </section>

          <section className="vehicle-edit-section">
            <div className="vehicle-edit-section-head">
              <h4>Datos técnicos</h4>
            </div>
            <div className="form-grid vehicle-edit-grid">
              <label className="field">
                <span>Marca</span>
                <input id="brand" {...register('brand')} />
              </label>
              <label className="field">
                <span>Tipo</span>
                <input id="type" {...register('type')} />
              </label>
              <CatalogField
                label={fieldCatalogs.useType.label}
                fieldName="useType"
                catalog={fieldCatalogs.useType}
                register={register}
                selectedValue={selectedUseType}
              />
              <label className="field">
                <span>Clase de vehículo</span>
                <select id="vehicleClass" {...register('vehicleClass')}>
                  <option value="">Selecciona una opción</option>
                  {fieldCatalogs.vehicleClass.options.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Modelo</span>
                <input id="model" {...register('model')} />
              </label>
              <label className="field">
                <span>Cilindros</span>
                <input id="cylinders" {...register('cylinders')} />
              </label>
              <label className="field">
                <span>Capacidad litros</span>
                <input id="fuelCapacityLiters" {...register('fuelCapacityLiters')} />
              </label>
              <label className="field">
                <span>No. de motor</span>
                <input id="engineNumber" {...register('engineNumber')} />
              </label>
              <label className="field">
                <span>No. de serie</span>
                <input id="serialNumber" {...register('serialNumber')} />
              </label>
              <label className="field">
                <span>Color</span>
                <input id="color" {...register('color')} />
              </label>
            </div>
          </section>

          <section className="vehicle-edit-section">
            <div className="vehicle-edit-section-head">
              <h4>Asignación y ubicación</h4>
            </div>
            <div className="form-grid vehicle-edit-grid">
              <label className="field">
                <span>Resguardante</span>
                <input id="custodian" {...register('custodian')} />
              </label>
              <label className="field">
                <span>No. patrulla</span>
                <input id="patrolNumber" {...register('patrolNumber')} />
              </label>
              <label className="field">
                <span>Adscripción</span>
                <input id="adscription" {...register('adscription')} />
              </label>
              <label className="field">
                <span>Ubicación real</span>
                <input id="realLocation" {...register('realLocation')} />
              </label>
              <label className="field field-full">
                <span>Delegación actual</span>
                <input
                  id="delegationName"
                 
                  value={record.delegation.name}
                  readOnly
                />
              </label>
            </div>
          </section>

          <section className="vehicle-edit-section">
            <div className="vehicle-edit-section-head">
              <h4>Estado y observaciones</h4>
            </div>
            <div className="form-grid vehicle-edit-grid">
              <label className="field">
                <span>Estado físico</span>
                <select id="physicalStatus" {...register('physicalStatus')}>
                  <option value="">Selecciona una opción</option>
                  {fieldCatalogs.physicalStatus.options.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <CatalogField
                label={fieldCatalogs.status.label}
                fieldName="status"
                catalog={fieldCatalogs.status}
                register={register}
                selectedValue={selectedStatus}
              />
              <label className="field">
                <span>Estatus Excel</span>
                <input
                  id="rawCirculationStatus"
                 
                  {...register('rawCirculationStatus')}
                />
              </label>
              <label className="field">
                <span>Anotación general</span>
                <input
                  id="rawAssetClassification"
                 
                  {...register('rawAssetClassification')}
                />
              </label>
              <CatalogField
                label={fieldCatalogs.assetClassification.label}
                fieldName="assetClassification"
                catalog={fieldCatalogs.assetClassification}
                register={register}
                selectedValue={selectedAssetClassification}
              />
              <label className="field field-full">
                <span>Observación</span>
                <textarea id="observation" rows={4} {...register('observation')} />
              </label>
            </div>
          </section>

          <section className="vehicle-edit-section">
            <div className="vehicle-edit-section-head">
              <h4>Metadatos de importación</h4>
            </div>
            <div className="form-grid vehicle-edit-grid">
              <label className="field">
                <span>Sección Excel</span>
                <input id="sourceSection" {...register('sourceSection')} />
              </label>
              <label className="field">
                <span>Fila Excel</span>
                <input
                  id="sourceRowNumber"
                 
                  type="number"
                  inputMode="numeric"
                  {...register('sourceRowNumber')}
                />
              </label>
              <label className="field">
                <span>Lote importación</span>
                <input
                  id="importBatchId"
                 
                  value={record.importBatchId ?? '-'}
                  readOnly
                />
              </label>
            </div>
          </section>

          <div className="modal-actions vehicle-edit-actions">
            <button className="ghost-button" type="button" onClick={onCancel} disabled={isSubmitting}>
              Cancelar
            </button>
            <button className="primary-button" type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

