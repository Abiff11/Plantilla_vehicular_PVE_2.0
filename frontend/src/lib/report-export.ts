import { getRecordActivitySummary } from '../modules/records/record-activity';
import type { GroupedRegionRecords, VehicleRecord } from '../types';
import { formatDateTimeMx } from './date-format';
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

  return formatDateTimeMx(date);
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
  const generatedAt = formatDateTimeMx(new Date());
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

function normalizePdfText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '')
    .replace(/[^\x20-\x7E]/gu, ' ');
}

function escapePdfTextContent(value: string) {
  return normalizePdfText(value)
    .replace(/\\/gu, '\\\\')
    .replace(/\(/gu, '\\(')
    .replace(/\)/gu, '\\)');
}

function estimateTextWidth(value: string, fontSize: number) {
  return Math.ceil(value.length * fontSize * 0.52);
}

function wrapPdfText(value: string, maxWidth: number, fontSize: number) {
  const normalized = normalizePdfText(value).trim();

  if (!normalized) {
    return [''];
  }

  const words = normalized.split(/\s+/gu);
  const lines: string[] = [];
  let current = words[0] ?? '';

  for (let index = 1; index < words.length; index += 1) {
    const word = words[index];
    const candidate = `${current} ${word}`;

    if (estimateTextWidth(candidate, fontSize) <= maxWidth) {
      current = candidate;
      continue;
    }

    lines.push(current);
    current = word;
  }

  if (current) {
    lines.push(current);
  }

  return lines;
}

function buildPdfLayout(payload: ReportDownloadPayload) {
  const fontSize = 8;
  const headerFontSize = 9;
  const titleFontSize = 13;
  const lineHeight = 10;
  const leftMargin = 20;
  const rightMargin = 20;
  const topMargin = 22;
  const bottomMargin = 20;
  const title = 'Reporte - POLICIA VIAL ESTATAL';
  const metaLines = [
    `Generado: ${formatDateTimeMx(new Date())}`,
    `Registros: ${payload.rows.length}`,
    ...payload.contextLines,
  ].map(normalizePdfText);

  const columnWidths = payload.columns.map((column, columnIndex) => {
    const columnSamples = [
      column.label,
      ...payload.rows.map((row) => row.cells[columnIndex] ?? ''),
    ];
    const maxSampleWidth = columnSamples.reduce((maxWidth, sample) => {
      return Math.max(maxWidth, estimateTextWidth(normalizePdfText(sample), fontSize));
    }, estimateTextWidth(normalizePdfText(column.label), headerFontSize));

    return Math.max(78, Math.min(220, maxSampleWidth + 20));
  });

  const pageWidth = Math.max(
    842,
    leftMargin + rightMargin + columnWidths.reduce((total, width) => total + width, 0),
  );
  const pageHeight = 595;
  const titleBlockHeight = 18 + metaLines.length * 11 + 10;
  const tableHeaderHeight = 20;
  const rowPaddingY = 6;

  const wrappedRows = payload.rows.map((row) =>
    row.cells.map((cell, columnIndex) =>
      wrapPdfText(cell, columnWidths[columnIndex] - 12, fontSize),
    ),
  );

  const rowHeights = wrappedRows.map((rowCells) => {
    const maxLines = rowCells.reduce((max, cellLines) => Math.max(max, cellLines.length), 1);
    return maxLines * lineHeight + rowPaddingY;
  });

  const availableHeight = pageHeight - topMargin - bottomMargin - titleBlockHeight - tableHeaderHeight - 8;
  const pages: number[][] = [];
  let currentPageRows: number[] = [];
  let remainingHeight = availableHeight;

  rowHeights.forEach((rowHeight, rowIndex) => {
    if (currentPageRows.length > 0 && rowHeight > remainingHeight) {
      pages.push(currentPageRows);
      currentPageRows = [];
      remainingHeight = availableHeight;
    }

    currentPageRows.push(rowIndex);
    remainingHeight -= rowHeight;
  });

  if (currentPageRows.length > 0 || pages.length === 0) {
    pages.push(currentPageRows);
  }

  return {
    title,
    metaLines,
    pageWidth,
    pageHeight,
    titleFontSize,
    fontSize,
    headerFontSize,
    lineHeight,
    leftMargin,
    topMargin,
    bottomMargin,
    titleBlockHeight,
    tableHeaderHeight,
    rowPaddingY,
    columnWidths,
    wrappedRows,
    rowHeights,
    pages,
  };
}

function createPdfBlob(payload: ReportDownloadPayload) {
  const layout = buildPdfLayout(payload);
  const objects: string[] = [];
  const pageObjectIds: number[] = [];
  const contentObjectIds: number[] = [];
  const fontRegularObjectId = 3 + layout.pages.length * 2;
  const fontBoldObjectId = fontRegularObjectId + 1;

  const drawText = (
    fontId: number,
    fontSize: number,
    x: number,
    y: number,
    text: string,
  ) => `BT /F${fontId} ${fontSize} Tf 1 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)} Tm (${escapePdfTextContent(text)}) Tj ET`;

  const drawRect = (x: number, y: number, width: number, height: number, fill = false) =>
    `${x.toFixed(2)} ${y.toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)} re ${fill ? 'B' : 'S'}`;

  layout.pages.forEach((pageRows, pageIndex) => {
    const pageObjectId = 3 + pageIndex * 2;
    const contentObjectId = pageObjectId + 1;
    pageObjectIds.push(pageObjectId);
    contentObjectIds.push(contentObjectId);
  });

  objects[0] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[1] = `<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageObjectIds.length} >>`;
  objects[fontRegularObjectId - 1] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';
  objects[fontBoldObjectId - 1] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>';

  layout.pages.forEach((pageRows, pageIndex) => {
    const pageObjectId = pageObjectIds[pageIndex];
    const contentObjectId = contentObjectIds[pageIndex];
    const commands: string[] = [];
    const startX = layout.leftMargin;
    const tableTopY = layout.pageHeight - layout.topMargin - layout.titleBlockHeight - layout.tableHeaderHeight - 6;

    commands.push('0 0 0 RG');
    commands.push('0 0 0 rg');
    commands.push(drawText(fontBoldObjectId, layout.titleFontSize, startX, layout.pageHeight - layout.topMargin - layout.titleFontSize, layout.title));

    let metaY = layout.pageHeight - layout.topMargin - layout.titleFontSize - 10;
    layout.metaLines.forEach((line) => {
      commands.push(drawText(fontRegularObjectId, layout.fontSize, startX, metaY, line));
      metaY -= 11;
    });

    let currentY = tableTopY;
    let currentX = startX;

    commands.push('0.93 0.95 0.98 rg');
    commands.push('0.18 0.24 0.35 RG');
    layout.columnWidths.forEach((width, columnIndex) => {
      commands.push(drawRect(currentX, currentY, width, layout.tableHeaderHeight, true));
      const label = normalizePdfText(payload.columns[columnIndex]?.label ?? '');
      const labelY = currentY + 6;
      commands.push('0 0 0 rg');
      commands.push(drawText(fontBoldObjectId, layout.headerFontSize, currentX + 4, labelY, label));
      currentX += width;
    });

    currentY -= layout.tableHeaderHeight;

    pageRows.forEach((rowIndex) => {
      const rowHeight = layout.rowHeights[rowIndex];
      const rowCells = layout.wrappedRows[rowIndex];
      currentX = startX;

      rowCells.forEach((cellLines, columnIndex) => {
        const width = layout.columnWidths[columnIndex];
        commands.push('1 1 1 rg');
        commands.push('0.80 0.84 0.88 RG');
        commands.push(drawRect(currentX, currentY - rowHeight, width, rowHeight, false));

        let textY = currentY - 7;
        cellLines.forEach((line) => {
          commands.push('0 0 0 rg');
          commands.push(drawText(fontRegularObjectId, layout.fontSize, currentX + 4, textY, line));
          textY -= layout.lineHeight;
        });

        currentX += width;
      });

      currentY -= rowHeight;
    });

    const contentStream = commands.join('\n');
    objects[pageObjectId - 1] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${layout.pageWidth.toFixed(2)} ${layout.pageHeight.toFixed(2)}] /Resources << /Font << /F${fontRegularObjectId} ${fontRegularObjectId} 0 R /F${fontBoldObjectId} ${fontBoldObjectId} 0 R >> >> /Contents ${contentObjectId} 0 R >>`;
    objects[contentObjectId - 1] = `<< /Length ${contentStream.length} >>\nstream\n${contentStream}\nendstream`;
  });

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
  const blob = createPdfBlob(payload);

  downloadBlob(
    blob,
    `Reporte-POLICIA-VIAL-ESTATAL-${new Date().toISOString().slice(0, 10)}.pdf`,
  );
}
