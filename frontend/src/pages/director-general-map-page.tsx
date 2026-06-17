import { DirectorOaxacaMap } from '../components/director-oaxaca-map';
import { EmptyState } from '../components/empty-state';
import { PageIntro } from '../components/page-intro';
import { StatsGrid } from '../components/stats-grid';
import { useAuth } from '../modules/auth/auth-context';
import { useDirectorGeneralOverview } from '../modules/director-general/use-director-general-overview';

export function DirectorGeneralMapPage() {
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
          title="Cargando mapa directivo"
          description="Espera un momento para consolidar el mapa territorial."
        />
      </section>
    );
  }

  if (error) {
    return (
      <section className="panel">
        <EmptyState
          title="No se pudo cargar el mapa directivo"
          description={error}
        />
      </section>
    );
  }

  if (!overview) {
    return null;
  }

  const { kpis, filters } = overview;

  return (
    <div className="stack-lg">
      <section className="panel">
        <PageIntro
          eyebrow="Dirección"
          title="Mapa directivo"
          description="Consulta la distribución territorial de la plantilla vehicular por región y delegación."
        />

        <section className="query-filter-panel">
          <div className="query-filter-header">
            <div>
              <p className="eyebrow">Filtros de dirección</p>
              <h3>Consulta territorial</h3>
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
            { label: 'Regiones visibles', value: selectedRegionName },
            { label: 'Delegaciones visibles', value: selectedDelegationName },
            { label: 'Vehículos totales', value: kpis.totalRecords },
            { label: 'Vehículos activos', value: kpis.totalActive },
          ]}
        />
      </section>

      <section className="panel stack-md">
        <DirectorOaxacaMap
          overview={overview}
          accessToken={session.accessToken}
          dateFrom={dateFrom || undefined}
          dateTo={dateTo || undefined}
        />
      </section>
    </div>
  );
}


