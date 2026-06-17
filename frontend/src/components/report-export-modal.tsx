import { useMemo, useState } from 'react';
import {
  buildReportTable,
  DEFAULT_REPORT_FIELD_IDS,
  downloadExcelReport,
  downloadPdfReport,
  REPORT_FIELDS,
  type ReportFieldId,
} from '../lib/report-export';
import type { GroupedRegionRecords } from '../types';

const FIELD_GROUPS = [
  'Ubicación',
  'Identificación',
  'Datos técnicos',
  'Asignación',
  'Estado',
  'Control',
] as const;

type ReportExportModalProps = {
  isOpen: boolean;
  title: string;
  records: GroupedRegionRecords[];
  contextLines: string[];
  onClose: () => void;
};

function getTotalRecords(records: GroupedRegionRecords[]) {
  return records.reduce(
    (regionTotal, region) =>
      regionTotal +
      region.delegations.reduce(
        (delegationTotal, delegation) => delegationTotal + delegation.records.length,
        0,
      ),
    0,
  );
}

function toggleField(
  selectedFieldIds: ReportFieldId[],
  fieldId: ReportFieldId,
  isSelected: boolean,
) {
  if (isSelected) {
    return selectedFieldIds.includes(fieldId)
      ? selectedFieldIds
      : [...selectedFieldIds, fieldId];
  }

  return selectedFieldIds.filter((selectedFieldId) => selectedFieldId !== fieldId);
}

export function ReportExportModal({
  isOpen,
  title,
  records,
  contextLines,
  onClose,
}: ReportExportModalProps) {
  const [selectedFieldIds, setSelectedFieldIds] = useState<ReportFieldId[]>(DEFAULT_REPORT_FIELD_IDS);
  const totalRecords = useMemo(() => getTotalRecords(records), [records]);
  const reportTable = useMemo(
    () => buildReportTable(records, selectedFieldIds),
    [records, selectedFieldIds],
  );
  const previewRows = reportTable.rows.slice(0, 8);
  const canExport = totalRecords > 0 && selectedFieldIds.length > 0;

  if (!isOpen) {
    return null;
  }

  const payload = {
    title,
    contextLines,
    columns: reportTable.columns,
    rows: reportTable.rows,
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content report-export-modal" onClick={(event) => event.stopPropagation()}>
        <div className="report-export-header">
          <div>
            <p className="eyebrow">Generador de reportes</p>
            <h3>{title}</h3>
            <p>
              El documento se genera con los filtros activos de la pantalla y solo con los campos seleccionados.
            </p>
          </div>
          <div className="report-export-summary">
            <span>{totalRecords} registros</span>
            <span>{selectedFieldIds.length} campos</span>
          </div>
        </div>

        <section className="report-export-section">
          <div className="report-export-section-head">
            <div>
              <h4>Filtros aplicados</h4>
              <p>Estos criterios ya están reflejados en el preview y en las descargas.</p>
            </div>
          </div>
          <div className="report-context-list">
            {contextLines.length === 0 ? (
              <span>Sin filtros adicionales.</span>
            ) : (
              contextLines.map((contextLine) => <span key={contextLine}>{contextLine}</span>)
            )}
          </div>
        </section>

        <section className="report-export-section">
          <div className="report-export-section-head">
            <div>
              <h4>Campos del documento</h4>
              <p>Selecciona únicamente las columnas que deben aparecer.</p>
            </div>
            <div className="report-export-actions-inline">
              <button
                className="ghost-button"
                type="button"
                onClick={() => setSelectedFieldIds(DEFAULT_REPORT_FIELD_IDS)}
              >
                Básicos
              </button>
              <button
                className="ghost-button"
                type="button"
                onClick={() => setSelectedFieldIds(REPORT_FIELDS.map((field) => field.id))}
              >
                Todos
              </button>
            </div>
          </div>

          <div className="report-field-groups">
            {FIELD_GROUPS.map((group) => {
              const fields = REPORT_FIELDS.filter((field) => field.group === group);

              return (
                <div className="report-field-group" key={group}>
                  <strong>{group}</strong>
                  <div className="report-field-list">
                    {fields.map((field) => (
                      <label className="report-field-option" key={field.id}>
                        <input
                          type="checkbox"
                          checked={selectedFieldIds.includes(field.id)}
                          onChange={(event) =>
                            setSelectedFieldIds((current) =>
                              toggleField(current, field.id, event.target.checked),
                            )
                          }
                        />
                        <span>{field.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="report-export-section">
          <div className="report-export-section-head">
            <div>
              <h4>Preview</h4>
              <p>Primeros {previewRows.length} registros del documento.</p>
            </div>
          </div>

          {reportTable.columns.length === 0 ? (
            <div className="report-preview-empty">Selecciona al menos un campo para generar el preview.</div>
          ) : previewRows.length === 0 ? (
            <div className="report-preview-empty">No hay registros para exportar con los filtros actuales.</div>
          ) : (
            <div className="table-wrapper report-preview-table-wrapper">
              <table className="report-preview-table">
                <thead>
                  <tr>
                    {reportTable.columns.map((column) => (
                      <th key={column.id}>{column.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row) => (
                    <tr key={row.id}>
                      {row.cells.map((cell, index) => (
                        <td key={`${row.id}-${reportTable.columns[index]?.id ?? index}`}>{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <div className="modal-actions report-export-footer">
          <button className="ghost-button" type="button" onClick={onClose}>
            Cerrar
          </button>
          <button
            className="secondary-button"
            type="button"
            disabled={!canExport}
            onClick={() => downloadExcelReport(payload)}
          >
            Descargar Excel
          </button>
          <button
            className="primary-button"
            type="button"
            disabled={!canExport}
            onClick={() => downloadPdfReport(payload)}
          >
            Descargar PDF
          </button>
        </div>
      </div>
    </div>
  );
}
