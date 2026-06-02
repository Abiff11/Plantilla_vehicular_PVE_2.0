import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { vehicleImportApi } from '../modules/imports/vehicle-import-api';
import type {
  VehicleImportBatch,
  VehicleImportError,
  VehicleImportPreview,
} from '../modules/imports/vehicle-import-types';
import { useAuth } from '../modules/auth/auth-context';

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

  const canCommit = Boolean(selectedFile && preview && preview.invalidRows === 0 && preview.pendingCatalogValues.length === 0);
  const latestBatches = useMemo(() => batches.slice(0, 10), [batches]);

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
      setSuccessMessage('Preview generado correctamente. Revisa errores y pendientes antes de importar.');
      await loadHistory();
    } catch (previewError) {
      setPreview(null);
      setError(previewError instanceof Error ? previewError.message : 'No se pudo generar el preview.');
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
      setError('No puedes importar hasta resolver errores y valores pendientes de catálogo.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const result = await vehicleImportApi.commit(selectedFile, token);
      setSuccessMessage(`Importación completada. Registros importados: ${result.importedRows}.`);
      setPreview(null);
      setSelectedFile(null);
      await loadHistory();
    } catch (commitError) {
      setError(commitError instanceof Error ? commitError.message : 'No se pudo confirmar la importación.');
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
      setError(loadError instanceof Error ? loadError.message : 'No se pudieron cargar los errores del lote.');
    }
  }

  return (
    <div className="page-stack">
      <section className="hero-card">
        <p className="eyebrow">Carga masiva</p>
        <h2>Importar plantilla vehicular desde Excel</h2>
        <p>
          Sube el archivo institucional sin modificar columnas. Primero genera una
          previsualización; el sistema validará catálogos, duplicados y reglas de
          normalización antes de guardar registros.
        </p>
      </section>

      {error && <div className="error-banner">{error}</div>}
      {successMessage && <div className="success-banner">{successMessage}</div>}

      <section className="panel-card">
        <h3>Archivo Excel</h3>
        <div className="form-grid three-columns">
          <label>
            Archivo .xlsx
            <input accept=".xlsx" type="file" onChange={handleFileChange} />
          </label>
          <div>
            <span className="eyebrow">Archivo seleccionado</span>
            <p>{selectedFile ? selectedFile.name : 'Sin archivo seleccionado'}</p>
          </div>
          <div className="button-row">
            <button className="secondary-button" disabled={isLoading || !selectedFile} type="button" onClick={() => void handlePreview()}>
              Generar preview
            </button>
            <button className="primary-button" disabled={isLoading || !canCommit} type="button" onClick={() => void handleCommit()}>
              Confirmar importación
            </button>
          </div>
        </div>
      </section>

      {preview && (
        <section className="panel-card">
          <div className="section-heading-row">
            <div>
              <p className="eyebrow">Preview</p>
              <h3>{preview.fileName}</h3>
              <p>Hoja: {preview.sheetName}</p>
            </div>
            <div className="stats-row">
              <span>{preview.totalRows} filas</span>
              <span>{preview.validRows} válidas</span>
              <span>{preview.invalidRows} con error</span>
            </div>
          </div>

          {preview.pendingCatalogValues.length > 0 && (
            <div className="warning-card">
              <h4>Valores pendientes de catálogo</h4>
              {preview.pendingCatalogValues.map((pending) => (
                <p key={pending.catalogCode}>
                  <strong>{pending.catalogCode}:</strong> {pending.values.join(', ')}
                </p>
              ))}
            </div>
          )}

          {preview.errors.length > 0 && (
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
                  {preview.errors.slice(0, 50).map((rowError) => (
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

          <h4>Muestra de filas normalizadas</h4>
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
                {preview.sampleRows.map((row) => (
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

      <section className="panel-card">
        <div className="section-heading-row">
          <div>
            <p className="eyebrow">Historial</p>
            <h3>Últimas importaciones</h3>
          </div>
          <button className="secondary-button" disabled={isLoadingHistory} type="button" onClick={() => void loadHistory()}>
            Actualizar
          </button>
        </div>

        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Archivo</th>
                <th>Estatus</th>
                <th>Filas</th>
                <th>Importadas</th>
                <th>Fecha</th>
                <th>Errores</th>
              </tr>
            </thead>
            <tbody>
              {latestBatches.map((batch) => (
                <tr key={batch.id}>
                  <td>{batch.fileName}</td>
                  <td>{batch.status}</td>
                  <td>{batch.totalRows}</td>
                  <td>{batch.importedRows}</td>
                  <td>{new Date(batch.createdAt).toLocaleString()}</td>
                  <td>
                    <button className="secondary-button" type="button" onClick={() => void handleLoadBatchErrors(batch.id)}>
                      Ver errores
                    </button>
                  </td>
                </tr>
              ))}
              {latestBatches.length === 0 && (
                <tr>
                  <td colSpan={6}>No hay importaciones registradas.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {selectedBatchId && (
        <section className="panel-card">
          <h3>Errores del lote</h3>
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
