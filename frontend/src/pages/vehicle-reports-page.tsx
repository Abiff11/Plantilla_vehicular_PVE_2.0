import { useEffect, useMemo, useState } from 'react';
import { EmptyState } from '../components/empty-state';
import { LoadingSpinner } from '../components/loading-spinner';
import { PageIntro } from '../components/page-intro';
import { ReportExportModal } from '../components/report-export-modal';
import { StatsGrid } from '../components/stats-grid';
import { api } from '../lib/api';
import { appendReportExportHistory, loadReportExportHistory } from '../lib/report-export-history';
import { socket } from '../lib/socket';
import { useAuth } from '../modules/auth/auth-context';
import type {
  GroupedRegionRecords,
  RecordFieldCatalogMap,
  Region,
} from '../types';

export function VehicleReportsPage() {
  const { session } = useAuth();
  const [regions, setRegions] = useState<GroupedRegionRecords[]>([]);
  const [catalogRegions, setCatalogRegions] = useState<Region[]>([]);
  const [fieldCatalogs, setFieldCatalogs] = useState<RecordFieldCatalogMap | null>(null);
  const [selectedRegionId, setSelectedRegionId] = useState('');
  const [selectedDelegationId, setSelectedDelegationId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [history, setHistory] = useState(() => loadReportExportHistory());

  useEffect(() => {
    if (!session) {
      return;
    }

    const refresh = async () => {
      const [loadedRegions, loadedFieldCatalogs, loadedCatalogRegions] = await Promise.all([
        api.getPlantillaVehicularOverview(
          session.accessToken,
          selectedRegionId || undefined,
          selectedDelegationId || undefined,
          dateFrom || undefined,
          dateTo || undefined,
        ),
        api.getRecordFieldCatalog(session.accessToken),
        api.getRegions(session.accessToken),
      ]);

      setRegions(loadedRegions);
      setFieldCatalogs(loadedFieldCatalogs);
      setCatalogRegions(loadedCatalogRegions);
    };

    void refresh();
    setHistory(loadReportExportHistory());
    socket.on('records.created', refresh);
    socket.on('records.changed', refresh);
    socket.on('reports.submitted', refresh);

    return () => {
      socket.off('records.created', refresh);
      socket.off('records.changed', refresh);
      socket.off('reports.submitted', refresh);
    };
  }, [dateFrom, dateTo, selectedDelegationId, selectedRegionId, session]);

  const availableDelegations = useMemo(() => {
    if (!selectedRegionId) {
      return catalogRegions.flatMap((region) => region.delegations);
    }

    return catalogRegions.find((region) => region.id === selectedRegionId)?.delegations ?? [];
  }, [catalogRegions, selectedRegionId]);

  const reportContext = useMemo(() => {
    const selectedRegionName =
      catalogRegions.find((region) => region.id === selectedRegionId)?.name ?? 'Todas las regiones';
    const selectedDelegationName =
      availableDelegations.find((delegation) => delegation.id === selectedDelegationId)?.name ??
      'Todas las delegaciones';

    return [
      `Región: ${selectedRegionName}`,
      `Delegación: ${selectedDelegationName}`,
      `Desde: ${dateFrom || 'Sin fecha inicial'}`,
      `Hasta: ${dateTo || 'Sin fecha final'}`,
    ];
  }, [availableDelegations, catalogRegions, dateFrom, dateTo, selectedDelegationId, selectedRegionId]);

  const visibleRecords = useMemo(
    () =>
      regions.reduce(
        (total, region) =>
          total +
          region.delegations.reduce(
            (delegationTotal, delegation) => delegationTotal + delegation.records.length,
            0,
          ),
        0,
      ),
    [regions],
  );

  const latestReport = history[0] ?? null;

  const handleRecordExport = (entry: Parameters<typeof appendReportExportHistory>[0]) => {
    const savedEntry = appendReportExportHistory(entry);
    setHistory(loadReportExportHistory());
    return savedEntry;
  };

  if (!session) {
    return null;
  }

  if (!fieldCatalogs) {
    return <LoadingSpinner message="Cargando reportes vehiculares..." />;
  }

  return (
    <div className="stack-lg">
      <section className="panel">
        <PageIntro
          eyebrow="Reportes vehiculares"
          title="Generación e historial"
          description="Ajusta filtros, abre el modal de exportación y revisa los reportes descargados desde este navegador."
        />

        <StatsGrid
          items={[
            { label: 'Capturas visibles', value: visibleRecords },
            { label: 'Reportes guardados', value: history.length },
            {
              label: 'Último reporte',
              value: latestReport ? new Date(latestReport.createdAt).toLocaleDateString() : '-',
              helper: latestReport ? latestReport.title : 'Sin historial',
            },
            {
              label: 'Formato reciente',
              value: latestReport ? latestReport.format.toUpperCase() : '-',
              helper: latestReport ? `${latestReport.fieldCount} campos` : 'Sin exportar',
            },
          ]}
        />
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Filtros de exportación</p>
            <h2>Consulta base para reporte</h2>
          </div>
        </div>

        <div className="query-filter-panel">
          <div className="query-filter-header">
            <div>
              <h3>Alcance de exportación</h3>
              <p>Configura la consulta antes de generar el archivo.</p>
            </div>

            <button
              className="ghost-button"
              type="button"
              onClick={() => {
                setSelectedRegionId('');
                setSelectedDelegationId('');
                setDateFrom('');
                setDateTo('');
              }}
            >
              Limpiar consulta
            </button>
          </div>

          <div className="form-grid director-filter-grid query-filter-grid">
            <label className="field">
              <span>Región</span>
              <select
                value={selectedRegionId}
                onChange={(event) => {
                  setSelectedRegionId(event.target.value);
                  setSelectedDelegationId('');
                }}
              >
                <option value="">Todas las regiones</option>
                {catalogRegions.map((region) => (
                  <option key={region.id} value={region.id}>
                    {region.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Delegación</span>
              <select
                value={selectedDelegationId}
                onChange={(event) => setSelectedDelegationId(event.target.value)}
              >
                <option value="">Todas las delegaciones</option>
                {availableDelegations.map((delegation) => (
                  <option key={delegation.id} value={delegation.id}>
                    {delegation.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Desde</span>
              <input
                id="dateFrom"
                name="dateFrom"
                type="date"
                value={dateFrom}
                onChange={(event) => setDateFrom(event.target.value)}
              />
            </label>

            <label className="field">
              <span>Hasta</span>
              <input
                id="dateTo"
                name="dateTo"
                type="date"
                value={dateTo}
                onChange={(event) => setDateTo(event.target.value)}
              />
            </label>
          </div>

          <div className="query-filter-footer">
            <span className="query-filter-hint">
              {visibleRecords} capturas listas para exportar
            </span>
            <button
              className="primary-button"
              type="button"
              disabled={visibleRecords === 0}
              onClick={() => setIsReportModalOpen(true)}
            >
              Generar reporte
            </button>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Historial local</p>
            <h2>Reportes generados en este equipo</h2>
          </div>
          <div className="panel-actions">
            <button className="ghost-button" type="button" onClick={() => setHistory(loadReportExportHistory())}>
              Recargar historial
            </button>
          </div>
        </div>

        {history.length === 0 ? (
          <EmptyState
            title="Sin reportes generados"
            description="Las descargas que hagas desde el modal aparecerán aquí."
          />
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Reporte</th>
                  <th>Formato</th>
                  <th>Registros</th>
                  <th>Campos</th>
                  <th>Contexto</th>
                </tr>
              </thead>
              <tbody>
                {history.map((entry) => (
                  <tr key={entry.id}>
                    <td>{new Date(entry.createdAt).toLocaleString()}</td>
                    <td>{entry.title}</td>
                    <td>{entry.format.toUpperCase()}</td>
                    <td>{entry.recordCount}</td>
                    <td>{entry.fieldCount}</td>
                    <td>{entry.contextLines.join(' · ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <ReportExportModal
        isOpen={isReportModalOpen}
        title="Reporte - POLICIA VIAL ESTATAL"
        records={regions}
        contextLines={reportContext}
        onExport={handleRecordExport}
        onClose={() => setIsReportModalOpen(false)}
      />
    </div>
  );
}
