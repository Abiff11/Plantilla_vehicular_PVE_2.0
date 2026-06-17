import { getRecordActivitySummary } from '../modules/records/record-activity';
import type { GroupedRegionRecords, VehicleRecord } from '../types';
import { resolveVehicleDisplayPlate } from './vehicle-plates';

export type ReportFieldId =
  | 'createdAt'
  | 'regionName'
  | 'delegationName'
  | 'displayPlate'
  | 'civ'
  | 'previousPlates'
  | 'plates2024'
  | 'plates2025'
  | 'plates2026'
  | 'brand'
  | 'type'
  | 'useType'
  | 'vehicleClass'
  | 'model'
  | 'cylinders'
  | 'fuelCapacityLiters'
  | 'engineNumber'
  | 'serialNumber'
  | 'custodian'
  | 'patrolNumber'
  | 'color'
  | 'adscription'
  | 'realLocation'
  | 'physicalStatus'
  | 'status'
  | 'rawCirculationStatus'
  | 'assetClassification'
  | 'rawAssetClassification'
  | 'sourceSection'
  | 'sourceRowNumber'
  | 'recordState'
  | 'observation'
  | 'activitySummary';

type ReportFieldInput = {
  regionName: string;
  delegationName: string;
  record: VehicleRecord;
};

export type ReportFieldDefinition = {
  id: ReportFieldId;
  label: string;
  group: 'Ubicación' | 'Identificación' | 'Datos técnicos' | 'Asignación' | 'Estado' | 'Control';
  getValue: (input: ReportFieldInput) => string;
};

export type ReportColumn = {
  id: ReportFieldId;
  label: string;
};

export type ReportTableRow = {
  id: string;
  cells: string[];
};

export type ReportTable = {
  columns: ReportColumn[];
  rows: ReportTableRow[];
};

export type ReportDownloadPayload = ReportTable & {
  title: string;
  contextLines: string[];
};

const EMPTY_VALUE = '-';

function display(value: unknown) {
  if (value === null || value === undefined) {
    return EMPTY_VALUE;
  }

  const normalized = String(value).trim();
  return normalized || EMPTY_VALUE;
}

function displayDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return display(value);
  }

  return date.toLocaleString('es-MX');
}

function displayRecordState(record: VehicleRecord) {
  return record.recordState === 'CURRENT' ? 'Vigente' : 'Trasladado';
}

export const REPORT_FIELDS: ReportFieldDefinition[] = [
  {
    id: 'createdAt',
    label: 'Fecha de captura',
    group: 'Control',
    getValue: ({ record }) => displayDate(record.createdAt),
  },
  {
    id: 'regionName',
    label: 'Región',
    group: 'Ubicación',
    getValue: ({ regionName }) => display(regionName),
  },
  {
    id: 'delegationName',
    label: 'Delegación',
    group: 'Ubicación',
    getValue: ({ delegationName }) => display(delegationName),
  },
  {
    id: 'displayPlate',
    label: 'Placa vigente',
    group: 'Identificación',
    getValue: ({ record }) => display(resolveVehicleDisplayPlate(record)),
  },
  {
    id: 'civ',
    label: 'CIV',
    group: 'Identificación',
    getValue: ({ record }) => display(record.civ),
  },
  {
    id: 'previousPlates',
    label: 'Placas anteriores',
    group: 'Identificación',
    getValue: ({ record }) => display(record.previousPlates),
  },
  {
    id: 'plates2024',
    label: 'Placas 2024',
    group: 'Identificación',
    getValue: ({ record }) => display(record.plates2024),
  },
  {
    id: 'plates2025',
    label: 'Placas 2025',
    group: 'Identificación',
    getValue: ({ record }) => display(record.plates2025),
  },
  {
    id: 'plates2026',
    label: 'Placas 2026',
    group: 'Identificación',
    getValue: ({ record }) => display(record.plates2026),
  },
  {
    id: 'brand',
    label: 'Marca',
    group: 'Datos técnicos',
    getValue: ({ record }) => display(record.brand),
  },
  {
    id: 'type',
    label: 'Tipo',
    group: 'Datos técnicos',
    getValue: ({ record }) => display(record.type),
  },
  {
    id: 'useType',
    label: 'Uso',
    group: 'Datos técnicos',
    getValue: ({ record }) => display(record.useType),
  },
  {
    id: 'vehicleClass',
    label: 'Clase de vehículo',
    group: 'Datos técnicos',
    getValue: ({ record }) => display(record.vehicleClass),
  },
  {
    id: 'model',
    label: 'Modelo',
    group: 'Datos técnicos',
    getValue: ({ record }) => display(record.model),
  },
  {
    id: 'cylinders',
    label: 'Cilindros',
    group: 'Datos técnicos',
    getValue: ({ record }) => display(record.cylinders),
  },
  {
    id: 'fuelCapacityLiters',
    label: 'Capacidad litros',
    group: 'Datos técnicos',
    getValue: ({ record }) => display(record.fuelCapacityLiters),
  },
  {
    id: 'engineNumber',
    label: 'No. motor',
    group: 'Datos técnicos',
    getValue: ({ record }) => display(record.engineNumber),
  },
  {
    id: 'serialNumber',
    label: 'No. serie',
    group: 'Datos técnicos',
    getValue: ({ record }) => display(record.serialNumber),
  },
  {
    id: 'custodian',
    label: 'Resguardante',
    group: 'Asignación',
    getValue: ({ record }) => display(record.custodian),
  },
  {
    id: 'patrolNumber',
    label: 'No. patrulla',
    group: 'Asignación',
    getValue: ({ record }) => display(record.patrolNumber),
  },
  {
    id: 'color',
    label: 'Color',
    group: 'Datos técnicos',
    getValue: ({ record }) => display(record.color),
  },
  {
    id: 'adscription',
    label: 'Adscripción',
    group: 'Asignación',
    getValue: ({ record }) => display(record.adscription),
  },
  {
    id: 'realLocation',
    label: 'Ubicación real',
    group: 'Ubicación',
    getValue: ({ record }) => display(record.realLocation),
  },
  {
    id: 'physicalStatus',
    label: 'Estado físico',
    group: 'Estado',
    getValue: ({ record }) => display(record.physicalStatus),
  },
  {
    id: 'status',
    label: 'Estatus sistema',
    group: 'Estado',
    getValue: ({ record }) => display(record.status),
  },
  {
    id: 'rawCirculationStatus',
    label: 'Estatus Excel',
    group: 'Estado',
    getValue: ({ record }) => display(record.rawCirculationStatus),
  },
  {
    id: 'assetClassification',
    label: 'Clasificación',
    group: 'Estado',
    getValue: ({ record }) => display(record.assetClassification),
  },
  {
    id: 'rawAssetClassification',
    label: 'Anotación general',
    group: 'Estado',
    getValue: ({ record }) => display(record.rawAssetClassification),
  },
  {
    id: 'sourceSection',
    label: 'Sección Excel',
    group: 'Control',
    getValue: ({ record }) => display(record.sourceSection),
  },
  {
    id: 'sourceRowNumber',
    label: 'Fila Excel',
    group: 'Control',
    getValue: ({ record }) => display(record.sourceRowNumber),
  },
  {
    id: 'recordState',
    label: 'Estado registro',
    group: 'Control',
    getValue: ({ record }) => displayRecordState(record),
  },
  {
    id: 'observation',
    label: 'Observación',
    group: 'Estado',
    getValue: ({ record }) => display(record.observation),
  },
  {
    id: 'activitySummary',
    label: 'Actividad',
    group: 'Control',
    getValue: ({ record }) => display(getRecordActivitySummary(record)),
  },
];

export const DEFAULT_REPORT_FIELD_IDS: ReportFieldId[] = [
  'createdAt',
  'regionName',
  'delegationName',
  'displayPlate',
  'brand',
  'type',
  'vehicleClass',
  'model',
  'custodian',
  'physicalStatus',
  'status',
  'recordState',
];

export function getReportFieldsByIds(fieldIds: ReportFieldId[]) {
  const selectedIds = new Set(fieldIds);
  return REPORT_FIELDS.filter((field) => selectedIds.has(field.id));
}

export function buildReportTable(
  groupedRecords: GroupedRegionRecords[],
  fieldIds: ReportFieldId[],
): ReportTable {
  const selectedFields = getReportFieldsByIds(fieldIds);
  const columns = selectedFields.map((field) => ({ id: field.id, label: field.label }));
  const rows = groupedRecords.flatMap((region) =>
    region.delegations.flatMap((delegation) =>
      delegation.records.map((record) => ({
        id: `${delegation.delegationId}-${record.id}`,
        cells: selectedFields.map((field) =>
          field.getValue({
            regionName: region.regionName,
            delegationName: delegation.delegationName,
            record,
          }),
        ),
      })),
    ),
  );

  return { columns, rows };
}

function escapeHtml(value: string) {
  return value
    .replace(/&/gu, '&amp;')
    .replace(/</gu, '&lt;')
    .replace(/>/gu, '&gt;')
    .replace(/"/gu, '&quot;')
    .replace(/'/gu, '&#39;');
}

function escapePdfText(value: string) {
  return value
    .replace(/\\/gu, '\\\\')
    .replace(/\(/gu, '\\(')
    .replace(/\)/gu, '\\)')
    .replace(/[\r\n]+/gu, ' ');
}

function normalizeFileName(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '') || 'reporte';
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function downloadExcelReport(payload: ReportDownloadPayload) {
  const contextRows = payload.contextLines
    .map((line) => `<tr><td colspan="${payload.columns.length}">${escapeHtml(line)}</td></tr>`)
    .join('');
  const headerRows = payload.columns
    .map((column) => `<th>${escapeHtml(column.label)}</th>`)
    .join('');
  const bodyRows = payload.rows
    .map(
      (row) =>
        `<tr>${row.cells.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`,
    )
    .join('');
  const generatedAt = new Date().toLocaleString('es-MX');
  const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
body { font-family: Arial, sans-serif; }
table { border-collapse: collapse; width: 100%; }
th, td { border: 1px solid #cbd5e1; padding: 6px 8px; font-size: 12px; mso-number-format:'\\@'; }
th { background: #1e293b; color: #ffffff; font-weight: 700; }
.report-title td { background: #f1f5f9; font-weight: 700; font-size: 14px; }
.report-meta td { background: #f8fafc; color: #475569; }
</style>
</head>
<body>
<table>
<tr class="report-title"><td colspan="${payload.columns.length}">${escapeHtml(payload.title)}</td></tr>
<tr class="report-meta"><td colspan="${payload.columns.length}">Generado: ${escapeHtml(generatedAt)}</td></tr>
${contextRows}
<tr>${headerRows}</tr>
${bodyRows}
</table>
</body>
</html>`;

  downloadBlob(
    new Blob([`\ufeff${html}`], { type: 'application/vnd.ms-excel;charset=utf-8' }),
    `${normalizeFileName(payload.title)}-${new Date().toISOString().slice(0, 10)}.xls`,
  );
}

function splitLongLine(line: string, maxLength: number) {
  if (line.length <= maxLength) {
    return [line];
  }

  const chunks: string[] = [];
  let remaining = line;

  while (remaining.length > maxLength) {
    const breakPoint = remaining.lastIndexOf(' ', maxLength);
    const cutAt = breakPoint > 40 ? breakPoint : maxLength;
    chunks.push(remaining.slice(0, cutAt));
    remaining = remaining.slice(cutAt).trimStart();
  }

  if (remaining) {
    chunks.push(remaining);
  }

  return chunks;
}

function buildPdfLines(payload: ReportDownloadPayload) {
  const lines = [
    payload.title,
    `Generado: ${new Date().toLocaleString('es-MX')}`,
    `Registros: ${payload.rows.length}`,
    ...payload.contextLines,
    '',
    payload.columns.map((column) => column.label).join(' | '),
    '-'.repeat(150),
  ];

  for (const row of payload.rows) {
    const line = row.cells.join(' | ');
    lines.push(...splitLongLine(line, 155));
  }

  return lines.flatMap((line) => splitLongLine(line, 155));
}

function createPdfBlob(lines: string[]) {
  const linesPerPage = 44;
  const pages: string[][] = [];

  for (let index = 0; index < lines.length; index += linesPerPage) {
    pages.push(lines.slice(index, index + linesPerPage));
  }

  const objects: string[] = [];
  const pageObjectIds: number[] = [];
  const fontObjectId = 3 + pages.length * 2;

  objects[0] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[1] = '';

  pages.forEach((pageLines, pageIndex) => {
    const pageObjectId = 3 + pageIndex * 2;
    const contentObjectId = pageObjectId + 1;
    pageObjectIds.push(pageObjectId);

    const textStream = [
      'BT',
      '/F1 8 Tf',
      '24 565 Td',
      '11 TL',
      ...pageLines.map((line, lineIndex) =>
        `${lineIndex === 0 ? '' : 'T* ' }(${escapePdfText(line)}) Tj`,
      ),
      'ET',
    ].join('\n');

    objects[pageObjectId - 1] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 842 595] /Resources << /Font << /F1 ${fontObjectId} 0 R >> >> /Contents ${contentObjectId} 0 R >>`;
    objects[contentObjectId - 1] = `<< /Length ${textStream.length} >>\nstream\n${textStream}\nendstream`;
  });

  objects[1] = `<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pages.length} >>`;
  objects[fontObjectId - 1] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';

  const offsets: number[] = [];
  let pdf = '%PDF-1.4\n';

  objects.forEach((object, index) => {
    offsets[index + 1] = pdf.length;
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let index = 1; index <= objects.length; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return new Blob([pdf], { type: 'application/pdf' });
}

export function downloadPdfReport(payload: ReportDownloadPayload) {
  const lines = buildPdfLines(payload);
  const blob = createPdfBlob(lines);

  downloadBlob(
    blob,
    `${normalizeFileName(payload.title)}-${new Date().toISOString().slice(0, 10)}.pdf`,
  );
}
