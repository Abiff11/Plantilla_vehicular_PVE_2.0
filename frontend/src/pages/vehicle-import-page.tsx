import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { useAuth } from '../modules/auth/auth-context';
import { formatDateTimeMx } from '../lib/date-format';
import { vehicleImportApi } from '../modules/imports/vehicle-import-api';
import type {
  VehicleImportBatch,
  VehicleImportError,
  VehicleImportPreview,
} from '../modules/imports/vehicle-import-types';

function getBatchStatusLabel(status: VehicleImportBatch['status']) {
  if (status === 'IMPORTED') {
    return 'Importado';
  }

  if (status === 'PREVIEWED') {
    return 'Previsualizado';
  }

  if (status === 'FAILED') {
    return 'Con errores';
  }

  return 'Cancelado';
}

function getBatchStatusTone(status: VehicleImportBatch['status']) {
  if (status === 'IMPORTED') {
    return 'is-success';
  }

  if (status === 'PREVIEWED') {
    return 'is-info';
  }

  if (status === 'FAILED') {
    return 'is-warning';
  }

  return 'is-neutral';
}

export function VehicleImportPage() {
  const { session } = useAuth();
  const token = session?.accessToken ?? '';
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<VehicleImportPreview | null>(null);
  const [batches, setBatches] = useState<VehicleImportBatch[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<string>('');
  const [batchErrors, setBatchErrors] = useState<VehicleImportError[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const canCommit = Boolean(
    selectedFile &&
      preview &&
      preview.invalidRows === 0 &&
      preview.pendingCatalogValues.length === 0,
  );
  const latestBatches = useMemo(() => batches.slice(0, 10), [batches]);
  const selectedBatch = useMemo(
    () => batches.find((batch) => batch.id === selectedBatchId) ?? null,
    [batches, selectedBatchId],
  );

  useEffect(() => {
    void loadHistory();
  }, []);

  async function loadHistory() {
    setIsLoadingHistory(true);

    try {
      const loadedBatches = await vehicleImportApi.getBatches(token);
      setBatches(loadedBatches);
    } catch {
      setBatches([]);
    } finally {
      setIsLoadingHistory(false);
    }
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setSelectedFile(file);
    setPreview(null);
    setError(null);
    setSuccessMessage(null);
    setSelectedBatchId('');
    setBatchErrors([]);
  }

  async function handlePreview() {
    if (!selectedFile) {
      setError('Selecciona un archivo Excel antes de previsualizar.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const result = await vehicleImportApi.preview(selectedFile, token);
      setPreview(result);
      setSuccessMessage(
        'Vista previa generada. Revisa pendientes y errores antes de confirmar.',
      );
      await loadHistory();
    } catch (previewError) {
      setPreview(null);
      setError(
        previewError instanceof Error
          ? previewError.message
          : 'No se pudo generar la vista previa.',
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCommit() {
    if (!selectedFile) {
      setError('Selecciona un archivo Excel antes de importar.');
      return;
    }

    if (!canCommit) {
      setError(
        'No puedes importar hasta resolver errores y valores pendientes de catálogo.',
      );
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const result = await vehicleImportApi.commit(selectedFile, token);
      setSuccessMessage(
        `Importación completada. Registros importados: ${result.importedRows}.`,
      );
      setPreview(null);
      setSelectedFile(null);
      await loadHistory();
    } catch (commitError) {
      setError(
        commitError instanceof Error
          ? commitError.message
          : 'No se pudo confirmar la importación.',
      );
      await loadHistory();
    } finally {
      setIsLoading(false);
    }
  }

  async function handleLoadBatchErrors(batchId: string) {
    setSelectedBatchId(batchId);
    setBatchErrors([]);

    try {
      const errors = await vehicleImportApi.getErrors(batchId, token);
      setBatchErrors(errors);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'No se pudieron cargar los errores del lote.',
      );
    }
  }

  const previewWarnings = preview?.pendingCatalogValues ?? [];
  const previewErrors = preview?.errors ?? [];
  const sampleRows = preview?.sampleRows ?? [];

  return (
    <div className="page-stack import-page">
      <section className="hero-card import-hero">
        <div className="import-hero-copy">
          <p className="eyebrow">Carga masiva</p>
          <h2>Importar plantilla vehicular desde Excel</h2>
          <p>
            Sube el archivo institucional sin modificar columnas. El sistema
            valida catálogos, duplicados y reglas de normalización antes de
            guardar registros.
          </p>
        </div>

        <div className="import-hero-stats">
          <div className="stats-card">
            <span className="stats-label">Archivo</span>
            <strong className="stats-value">
              {selectedFile ? 'Listo' : 'Pendiente'}
            </strong>
          </div>
          <div className="stats-card">
            <span className="stats-label">Preview</span>
            <strong className="stats-value">{preview ? 'Generado' : 'No'}</strong>
          </div>
          <div className="stats-card">
            <span className="stats-label">Importación</span>
            <strong className="stats-value">{canCommit ? 'Lista' : 'Bloqueada'}</strong>
          </div>
        </div>
      </section>

      {error && <div className="error-banner">{error}</div>}
      {successMessage && <div className="success-banner">{successMessage}</div>}

      <section className="import-layout">
        <article className="panel-card import-panel import-panel-upload">
          <div className="section-heading-row">
            <div>
              <p className="eyebrow">Paso 1</p>
              <h3>Selecciona el archivo</h3>
              <p>Usa el .xlsx institucional tal como viene, sin cambiar columnas.</p>
            </div>
          </div>

          <div className="import-upload-grid">
            <label className="import-file-field">
              <span>Archivo .xlsx</span>
              <input
                id="import-file"
                name="importFile"
                accept=".xlsx"
                type="file"
                onChange={handleFileChange}
              />
            </label>

            <div className="import-file-card">
              <span>Archivo seleccionado</span>
              <strong>{selectedFile ? selectedFile.name : 'Sin archivo seleccionado'}</strong>
              <small>
                {selectedFile ? `${(selectedFile.size / 1024 / 1024).toFixed(2)} MB` : 'Selecciona un Excel para continuar'}
              </small>
            </div>

            <div className="import-actions">
              <button
                className="secondary-button"
                disabled={isLoading || !selectedFile}
                type="button"
                onClick={() => void handlePreview()}
              >
                Generar vista previa
              </button>
              <button
                className="primary-button"
                disabled={isLoading || !canCommit}
                type="button"
                onClick={() => void handleCommit()}
              >
                Confirmar importación
              </button>
            </div>
          </div>
        </article>

        <article className="panel-card import-panel import-panel-preview">
          <div className="section-heading-row">
            <div>
              <p className="eyebrow">Paso 2</p>
              <h3>Validación del archivo</h3>
              <p>
                La importación sólo se habilita cuando no hay errores ni valores
                pendientes de catálogo.
              </p>
            </div>
          </div>

          {preview ? (
            <>
              <div className="import-preview-summary">
                <div className="stats-card">
                  <span className="stats-label">Filas totales</span>
                  <strong className="stats-value">{preview.totalRows}</strong>
                </div>
                <div className="stats-card">
                  <span className="stats-label">Válidas</span>
                  <strong className="stats-value">{preview.validRows}</strong>
                </div>
                <div className="stats-card">
                  <span className="stats-label">Con error</span>
                  <strong className="stats-value">{preview.invalidRows}</strong>
                </div>
                <div className="stats-card">
                  <span className="stats-label">Secciones</span>
                  <strong className="stats-value">{preview.sourceSections.length}</strong>
                </div>
              </div>

              <div className="import-preview-head">
                <div>
                  <strong>{preview.fileName}</strong>
                  <p>Hoja: {preview.sheetName}</p>
                </div>
                <span className="record-chip is-info">
                  {preview.invalidRows === 0 ? 'Sin errores críticos' : 'Requiere revisión'}
                </span>
              </div>

              {previewWarnings.length > 0 && (
                <div className="warning-card">
                  <h4>Valores pendientes de catálogo</h4>
                  <div className="import-chip-list">
                    {previewWarnings.map((pending) => (
                      <div key={pending.catalogCode} className="import-chip-card">
                        <strong>{pending.catalogCode}</strong>
                        <span>{pending.values.join(', ')}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {previewErrors.length > 0 && (
                <div className="table-scroll">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Fila</th>
                        <th>Sección</th>
                        <th>Errores</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewErrors.slice(0, 50).map((rowError) => (
                        <tr key={`${rowError.rowNumber}-${rowError.section}`}>
                          <td>{rowError.rowNumber}</td>
                          <td>{rowError.section || 'Sin sección'}</td>
                          <td>{rowError.messages.join(' | ')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          ) : (
            <div className="import-empty-state">
              <strong>Sin vista previa todavía</strong>
              <p>Genera el análisis del archivo para ver pendientes, errores y filas normalizadas.</p>
            </div>
          )}
        </article>
      </section>

      {preview && (
        <section className="panel-card import-panel">
          <div className="section-heading-row">
            <div>
              <p className="eyebrow">Vista previa</p>
              <h3>Muestra de filas normalizadas</h3>
              <p>Revisa cómo quedó interpretado el Excel antes de confirmar la carga.</p>
            </div>
          </div>

          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Fila</th>
                  <th>CIV</th>
                  <th>Placas</th>
                  <th>Marca</th>
                  <th>Tipo</th>
                  <th>Clase</th>
                  <th>Estatus</th>
                  <th>Sección</th>
                </tr>
              </thead>
              <tbody>
                {sampleRows.map((row) => (
                  <tr key={`${row.sourceRowNumber}-${row.serialNumber}`}>
                    <td>{row.sourceRowNumber}</td>
                    <td>{row.civ}</td>
                    <td>{row.plates || 'S/P'}</td>
                    <td>{row.brand}</td>
                    <td>{row.type}</td>
                    <td>{row.vehicleClass}</td>
                    <td>{row.status}</td>
                    <td>{row.sourceSection}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="panel-card import-panel">
        <div className="section-heading-row">
          <div>
            <p className="eyebrow">Paso 3</p>
            <h3>Historial de importaciones</h3>
            <p>Consulta los últimos lotes y abre sus errores si algo falló.</p>
          </div>
          <button
            className="secondary-button"
            disabled={isLoadingHistory}
            type="button"
            onClick={() => void loadHistory()}
          >
            Actualizar
          </button>
        </div>

        <div className="import-history-grid">
          {latestBatches.map((batch) => (
            <button
              key={batch.id}
              type="button"
              className={`import-history-card ${selectedBatchId === batch.id ? 'is-selected' : ''}`}
              onClick={() => void handleLoadBatchErrors(batch.id)}
            >
              <div className="import-history-head">
                <strong>{batch.fileName}</strong>
                <span className={`record-chip ${getBatchStatusTone(batch.status)}`}>
                  {getBatchStatusLabel(batch.status)}
                </span>
              </div>
              <p>{batch.sheetName}</p>
              <div className="import-history-meta">
                <span>{batch.totalRows} filas</span>
                <span>{batch.importedRows} importadas</span>
                <span>{formatDateTimeMx(batch.createdAt)}</span>
              </div>
            </button>
          ))}

          {latestBatches.length === 0 && (
            <div className="import-empty-state">
              <strong>No hay importaciones registradas.</strong>
              <p>Después de procesar el Excel, aparecerá aquí el historial reciente.</p>
            </div>
          )}
        </div>
      </section>

      {selectedBatch && (
        <section className="panel-card import-panel">
          <div className="section-heading-row">
            <div>
              <p className="eyebrow">Errores</p>
              <h3>{selectedBatch.fileName}</h3>
              <p>Detalle del lote seleccionado.</p>
            </div>
            <span className={`record-chip ${getBatchStatusTone(selectedBatch.status)}`}>
              {getBatchStatusLabel(selectedBatch.status)}
            </span>
          </div>

          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Fila</th>
                  <th>Tipo</th>
                  <th>Columna</th>
                  <th>Valor</th>
                  <th>Mensaje</th>
                </tr>
              </thead>
              <tbody>
                {batchErrors.map((batchError) => (
                  <tr key={batchError.id}>
                    <td>{batchError.rowNumber}</td>
                    <td>{batchError.errorType}</td>
                    <td>{batchError.columnName || 'General'}</td>
                    <td>{batchError.rawValue}</td>
                    <td>{batchError.message}</td>
                  </tr>
                ))}
                {batchErrors.length === 0 && (
                  <tr>
                    <td colSpan={5}>Este lote no tiene errores registrados.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
