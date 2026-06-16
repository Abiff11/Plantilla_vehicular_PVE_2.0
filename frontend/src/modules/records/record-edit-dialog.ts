import Swal from 'sweetalert2';
import { api } from '../../lib/api';
import { resolveVehicleDisplayPlate } from '../../lib/vehicle-plates';
import type {
  RecordFieldCatalogMap,
  VehicleRecord,
  VehicleRecordUpdateValues,
} from '../../types';

type EditableFieldName = keyof VehicleRecordUpdateValues;

type EditField = {
  name: EditableFieldName;
  label: string;
  type?: 'text' | 'number' | 'textarea' | 'select';
  section: 'identity' | 'technical' | 'assignment' | 'status' | 'metadata';
  readonly?: boolean;
};

type OpenRecordEditDialogParams = {
  record: VehicleRecord;
  fieldCatalogs: RecordFieldCatalogMap;
  token: string;
  onUpdated: () => Promise<void> | void;
};

const fields: EditField[] = [
  { section: 'identity', name: 'plates', label: 'Placa principal' },
  { section: 'identity', name: 'previousPlates', label: 'Placas anteriores' },
  { section: 'identity', name: 'plates2024', label: 'Placas 2024' },
  { section: 'identity', name: 'plates2025', label: 'Placas 2025' },
  { section: 'identity', name: 'plates2026', label: 'Placas 2026' },
  { section: 'identity', name: 'civ', label: 'CIV' },
  { section: 'technical', name: 'brand', label: 'Marca' },
  { section: 'technical', name: 'type', label: 'Tipo' },
  { section: 'technical', name: 'useType', label: 'Uso', type: 'select' },
  { section: 'technical', name: 'vehicleClass', label: 'Clase de vehículo', type: 'select' },
  { section: 'technical', name: 'model', label: 'Modelo' },
  { section: 'technical', name: 'cylinders', label: 'Cilindros' },
  { section: 'technical', name: 'fuelCapacityLiters', label: 'Capacidad litros' },
  { section: 'technical', name: 'engineNumber', label: 'Número de motor' },
  { section: 'technical', name: 'serialNumber', label: 'Número de serie' },
  { section: 'technical', name: 'color', label: 'Color' },
  { section: 'assignment', name: 'regionName', label: 'Región Excel' },
  { section: 'assignment', name: 'delegationName', label: 'Delegación Excel' },
  { section: 'assignment', name: 'adscription', label: 'Adscripción' },
  { section: 'assignment', name: 'realLocation', label: 'Ubicación real' },
  { section: 'assignment', name: 'custodian', label: 'Resguardante' },
  { section: 'assignment', name: 'patrolNumber', label: 'No. patrulla' },
  { section: 'status', name: 'physicalStatus', label: 'Estado físico', type: 'select' },
  { section: 'status', name: 'status', label: 'Estatus sistema', type: 'select' },
  { section: 'status', name: 'rawCirculationStatus', label: 'Estatus Excel' },
  { section: 'status', name: 'assetClassification', label: 'Clasificación del bien', type: 'select' },
  { section: 'status', name: 'observation', label: 'Observación', type: 'textarea' },
  { section: 'metadata', name: 'sourceSection', label: 'Sección Excel' },
  { section: 'metadata', name: 'sourceRowNumber', label: 'Fila Excel', type: 'number' },
];

const sectionTitles: Record<EditField['section'], string> = {
  identity: 'Identificación y placas',
  technical: 'Datos técnicos',
  assignment: 'Asignación y ubicación',
  status: 'Estado y observaciones',
  metadata: 'Metadatos de importación',
};

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function inputId(fieldName: EditableFieldName) {
  return `vehicle-edit-${String(fieldName)}`;
}

function resolveFieldValue(record: VehicleRecord, fieldName: EditableFieldName) {
  const value = record[fieldName as keyof VehicleRecord];
  return value === null || value === undefined ? '' : String(value);
}

function renderSelect(
  field: EditField,
  value: string,
  fieldCatalogs: RecordFieldCatalogMap,
) {
  const catalog =
    field.name === 'useType'
      ? fieldCatalogs.useType
      : field.name === 'vehicleClass'
        ? fieldCatalogs.vehicleClass
        : field.name === 'physicalStatus'
          ? fieldCatalogs.physicalStatus
          : field.name === 'status'
            ? fieldCatalogs.status
            : field.name === 'assetClassification'
              ? fieldCatalogs.assetClassification
              : null;

  if (!catalog) {
    return `<input id="${inputId(field.name)}" value="${escapeHtml(value)}" />`;
  }

  const hasCurrentOption = catalog.options.some((option) => option.value === value);
  const options = [
    '<option value="">Selecciona una opción</option>',
    !hasCurrentOption && value
      ? `<option value="${escapeHtml(value)}" selected>${escapeHtml(value)} (actual)</option>`
      : '',
    ...catalog.options.map(
      (option) =>
        `<option value="${escapeHtml(option.value)}" ${option.value === value ? 'selected' : ''}>${escapeHtml(option.label)}</option>`,
    ),
  ].join('');

  return `<select id="${inputId(field.name)}">${options}</select>`;
}

function renderField(
  field: EditField,
  record: VehicleRecord,
  fieldCatalogs: RecordFieldCatalogMap,
) {
  const value = resolveFieldValue(record, field.name);
  const readonly = field.readonly ? 'readonly disabled' : '';

  if (field.type === 'textarea') {
    return `
      <label class="vehicle-edit-field vehicle-edit-field-full">
        <span>${escapeHtml(field.label)}</span>
        <textarea id="${inputId(field.name)}" rows="4" ${readonly}>${escapeHtml(value)}</textarea>
      </label>
    `;
  }

  if (field.type === 'select') {
    return `
      <label class="vehicle-edit-field">
        <span>${escapeHtml(field.label)}</span>
        ${renderSelect(field, value, fieldCatalogs)}
      </label>
    `;
  }

  return `
    <label class="vehicle-edit-field">
      <span>${escapeHtml(field.label)}</span>
      <input id="${inputId(field.name)}" type="${field.type ?? 'text'}" value="${escapeHtml(value)}" ${readonly} />
    </label>
  `;
}

function renderSection(
  section: EditField['section'],
  record: VehicleRecord,
  fieldCatalogs: RecordFieldCatalogMap,
) {
  const sectionFields = fields.filter((field) => field.section === section);

  return `
    <section class="vehicle-edit-section">
      <h3>${escapeHtml(sectionTitles[section])}</h3>
      <div class="vehicle-edit-grid">
        ${sectionFields.map((field) => renderField(field, record, fieldCatalogs)).join('')}
      </div>
    </section>
  `;
}

function readModalValues(): VehicleRecordUpdateValues {
  const values: VehicleRecordUpdateValues = {};
  const mutableValues = values as Record<string, unknown>;

  for (const field of fields) {
    const element = document.getElementById(inputId(field.name)) as
      | HTMLInputElement
      | HTMLTextAreaElement
      | HTMLSelectElement
      | null;

    if (!element || field.readonly) {
      continue;
    }

    if (field.name === 'sourceRowNumber') {
      values.sourceRowNumber = element.value.trim() ? Number(element.value) : null;
      continue;
    }

    mutableValues[field.name] = element.value;
  }

  return values;
}

function validateModalValues(values: VehicleRecordUpdateValues) {
  const requiredFields: Array<[keyof VehicleRecordUpdateValues, string]> = [
    ['brand', 'Marca'],
    ['type', 'Tipo'],
    ['useType', 'Uso'],
    ['vehicleClass', 'Clase de vehículo'],
    ['model', 'Modelo'],
    ['engineNumber', 'Número de motor'],
    ['serialNumber', 'Número de serie'],
    ['custodian', 'Resguardante'],
    ['patrolNumber', 'No. patrulla'],
    ['physicalStatus', 'Estado físico'],
    ['status', 'Estatus sistema'],
    ['assetClassification', 'Clasificación del bien'],
  ];

  for (const [fieldName, label] of requiredFields) {
    const value = values[fieldName];

    if (typeof value !== 'string' || !value.trim()) {
      return `Captura el campo obligatorio: ${label}.`;
    }
  }

  if (
    values.sourceRowNumber !== null &&
    values.sourceRowNumber !== undefined &&
    (!Number.isInteger(values.sourceRowNumber) || values.sourceRowNumber < 1)
  ) {
    return 'La fila Excel debe ser un número entero mayor a cero.';
  }

  return null;
}

export async function openRecordEditDialog({
  record,
  fieldCatalogs,
  token,
  onUpdated,
}: OpenRecordEditDialogParams) {
  const result = await Swal.fire({
    title: 'Editar vehículo',
    width: 1080,
    showCancelButton: true,
    confirmButtonText: 'Guardar cambios',
    cancelButtonText: 'Cancelar',
    focusConfirm: false,
    customClass: {
      popup: 'vehicle-edit-popup',
      htmlContainer: 'vehicle-edit-html',
      actions: 'vehicle-edit-actions',
      confirmButton: 'vehicle-edit-save-button',
    },
    html: `
      <div class="vehicle-edit-shell">
        <div class="vehicle-edit-summary">
          <div>
            <span>Vehículo</span>
            <strong>${escapeHtml(resolveVehicleDisplayPlate(record))}</strong>
          </div>
          <div>
            <span>Unidad</span>
            <strong>${escapeHtml(`${record.brand} ${record.type} · Modelo ${record.model}`)}</strong>
          </div>
          <div>
            <span>Delegación actual</span>
            <strong>${escapeHtml(record.delegation.name)}</strong>
          </div>
        </div>
        ${renderSection('identity', record, fieldCatalogs)}
        ${renderSection('technical', record, fieldCatalogs)}
        ${renderSection('assignment', record, fieldCatalogs)}
        ${renderSection('status', record, fieldCatalogs)}
        ${renderSection('metadata', record, fieldCatalogs)}
      </div>
    `,
    preConfirm: async () => {
      const values = readModalValues();
      const validationMessage = validateModalValues(values);

      if (validationMessage) {
        Swal.showValidationMessage(validationMessage);
        return false;
      }

      try {
        await api.updateRecord(record.id, values, token);
        return true;
      } catch (error) {
        Swal.showValidationMessage((error as Error).message);
        return false;
      }
    },
  });

  if (!result.isConfirmed) {
    return false;
  }

  await onUpdated();

  await Swal.fire({
    icon: 'success',
    title: 'Vehículo actualizado',
    text: 'Los cambios se guardaron correctamente en la bitácora.',
    confirmButtonText: 'Entendido',
  });

  return true;
}
