import { EmptyState } from '../components/empty-state';
import { PageIntro } from '../components/page-intro';
import { StatsGrid } from '../components/stats-grid';
import { formatDateMx } from '../lib/date-format';
import { useAuth } from '../modules/auth/auth-context';
import { useDirectorGeneralOverview } from '../modules/director-general/use-director-general-overview';

function formatReportDate(value: string) {
  return formatDateMx(value);
}

function formatReportCell(value: number) {
  return value > 0 ? value : '-';
}

export function DirectorGeneralPage() {
  const { session } = useAuth();
  const {
    overview,
    error,
    isLoading,
    selectedRegionId,
    setSelectedRegionId,
    selectedDelegationId,
    setSelectedDelegationId,
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    availableDelegations,
    selectedRegionName,
    selectedDelegationName,
  } = useDirectorGeneralOverview({ accessToken: session?.accessToken });

  if (!session) {
    return null;
  }

  if (isLoading) {
    return (
      <section className="panel">
        <EmptyState
          title="Cargando tablero directivo"
          description="Espera un momento para consolidar los indicadores globales."
        />
      </section>
    );
  }

  if (error) {
    return (
      <section className="panel">
        <EmptyState
          title="No se pudo cargar el tablero directivo"
          description={error}
        />
      </section>
    );
  }

  if (!overview) {
    return null;
  }

  const { kpis, table, filters } = overview;
  const statusColumns = table.statuses.map((status) => ({
    key: status,
    label: status,
    getValue: (row: { statusBreakdown: Record<string, number> }) => row.statusBreakdown[status] ?? 0,
  }));

  return (
    <div className="stack-lg">
      <section className="panel">
        <PageIntro
          eyebrow="Dirección"
          title="Dashboard directivo"
          description="Consulta indicadores globales de la plantilla vehicular y su comportamiento operativo."
        />

        <section className="query-filter-panel">
          <div className="query-filter-header">
            <div>
              <p className="eyebrow">Filtros de dirección</p>
              <h3>Consulta directiva</h3>
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
                {filters.regions.map((region) => (
                  <option key={region.regionId} value={region.regionId}>
                    {region.regionName}
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
                type="date"
                value={dateFrom}
                onChange={(event) => setDateFrom(event.target.value)}
              />
            </label>

            <label className="field">
              <span>Hasta</span>
              <input
                type="date"
                value={dateTo}
                onChange={(event) => setDateTo(event.target.value)}
              />
            </label>
          </div>
        </section>

        <StatsGrid
          items={[
            { label: 'Total de registros', value: kpis.totalRecords },
            { label: 'Regiones con registros', value: kpis.totalRegions },
            { label: 'Delegaciones con registros', value: kpis.totalDelegations },
            { label: 'Total activos', value: kpis.totalActive },
          ]}
        />
      </section>

      <section className="panel">
        <StatsGrid
          items={[
            { label: 'Regiones sin validación mensual', value: kpis.notReported },
            { label: 'Regiones con reportes pendientes', value: kpis.pendingChanges },
            { label: 'Regiones sin cambios', value: kpis.reportedWithoutChanges },
            { label: 'Regiones con cambios', value: kpis.reportedWithChanges },
          ]}
        />
      </section>

      <section className="panel">
        <StatsGrid
          items={[
            { label: 'Alcance regional', value: selectedRegionName },
            { label: 'Alcance por delegación', value: selectedDelegationName },
            {
              label: 'Corte al',
              value: table.rows.length > 0 ? formatReportDate(table.date) : '-',
            },
            {
              label: 'Vehículos con estatus OTRO',
              value: table.resume.statusBreakdown.OTRO ?? 0,
            },
          ]}
        />
      </section>

      <section className="panel stack-md">
        <div className="director-report">
          <table className="director-report-date">
            <tbody>
              <tr>
                <th>FECHA:</th>
                <td>{formatReportDate(table.date)}</td>
              </tr>
            </tbody>
          </table>

          <div className="table-wrapper director-report-table-wrap">
            <table className="director-report-table">
              <thead>
                <tr>
                  <th>TIPO DE VEHICULO</th>
                  <th>TODOS</th>
                  {statusColumns.map((column) => (
                    <th key={column.key}>{column.label}</th>
                  ))}
                  <th>ACTIVOS</th>
                </tr>
              </thead>
              <tbody>
                {table.rows.map((row) => {
                  return (
                    <tr key={row.vehicleClass}>
                      <td>{row.vehicleClass}</td>
                      <td>{formatReportCell(row.totalUnits)}</td>
                      {statusColumns.map((column) => {
                        const value = column.getValue(row);
                        return <td key={column.key}>{formatReportCell(value)}</td>;
                      })}
                      <td>{formatReportCell(row.totalActive)}</td>
                    </tr>
                  );
                })}
                <tr className="director-report-summary">
                  <th>RESUMEN</th>
                  <th>{formatReportCell(table.resume.totalUnits)}</th>
                  {statusColumns.map((column) => (
                    <th key={column.key}>{formatReportCell(column.getValue(table.resume))}</th>
                  ))}
                  <th>{formatReportCell(table.resume.totalActive)}</th>
                </tr>
              </tbody>
            </table>
          </div>

          <section className="director-report-observations">
            <strong>DESCRIPCIÓN OTRO:</strong>
            {table.customStatusDescriptions.length > 0 ? (
              <div className="director-report-observations-list">
                {table.customStatusDescriptions.map((description, index) => (
                  <div className="director-report-observations-row" key={`${description}-${index}`}>
                    {description}
                  </div>
                ))}
              </div>
            ) : (
              <div className="director-report-observations-row">
                SIN REGISTROS CAPTURADOS EN ESTATUS OTRO PARA EL CORTE CONSULTADO.
              </div>
            )}
          </section>

          <section className="director-report-observations">
            <strong>OBSERVACIONES:</strong>
            {table.observations.length > 0 ? (
              <div className="director-report-observations-list">
                {table.observations.map((observation, index) => (
                  <div className="director-report-observations-row" key={`${observation}-${index}`}>
                    {observation}
                  </div>
                ))}
              </div>
            ) : (
              <div className="director-report-observations-row">
                SIN OBSERVACIONES REGISTRADAS PARA EL CORTE CONSULTADO.
              </div>
            )}
          </section>
        </div>
      </section>
    </div>
  );
}


