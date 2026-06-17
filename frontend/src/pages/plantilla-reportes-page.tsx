import { useEffect, useMemo, useState } from 'react';
import Swal from 'sweetalert2';
import { EmptyState } from '../components/empty-state';
import { LoadingSpinner } from '../components/loading-spinner';
import { api } from '../lib/api';
import { formatDateMx, formatDateTimeMx } from '../lib/date-format';
import { formatUserName } from '../lib/format-user-name';
import { socket } from '../lib/socket';
import { useAuth } from '../modules/auth/auth-context';
import type { Region, RegionRosterReportOverviewRow } from '../types';

type ReportStatus = RegionRosterReportOverviewRow['status'];

const REPORT_STATUS_UI: Record<
  ReportStatus,
  {
    label: string;
    description: string;
    tone: 'neutral' | 'warning' | 'success' | 'info';
  }
> = {
  NOT_REPORTED: {
    label: 'Sin validación mensual',
    description: 'La región aún no tiene cierre mensual registrado.',
    tone: 'neutral',
  },
  PENDING_CHANGES: {
    label: 'Cambios sin validar',
    description: 'Existen movimientos posteriores a la última validación.',
    tone: 'warning',
  },
  REPORTED_WITH_CHANGES: {
    label: 'Validado con cambios',
    description: 'La región cerró el periodo con movimientos confirmados.',
    tone: 'info',
  },
  REPORTED_WITHOUT_CHANGES: {
    label: 'Validado sin cambios',
    description: 'La región cerró el periodo sin movimientos nuevos.',
    tone: 'success',
  },
};

function getReportStatusUi(status: ReportStatus) {
  return REPORT_STATUS_UI[status];
}

function getPendingDelegationText(row: RegionRosterReportOverviewRow) {
  if (row.pendingDelegationReports === 0) {
    return `${row.confirmedDelegationReports}/${row.totalDelegations} confirmadas`;
  }

  return `${row.confirmedDelegationReports}/${row.totalDelegations} confirmadas, ${
    row.pendingDelegationReports
  } pendientes`;
}

function getLastRegionalReportText(row: RegionRosterReportOverviewRow) {
  if (!row.lastReport) {
    return 'Sin validación regional';
  }

  return formatDateTimeMx(row.lastReport.submittedAt);
}

export function PlantillaReportesPage() {
  const { session } = useAuth();
  const [catalogRegions, setCatalogRegions] = useState<Region[]>([]);
  const [reportOverview, setReportOverview] = useState<RegionRosterReportOverviewRow[]>([]);
  const [selectedRegionId, setSelectedRegionId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const canSubmitRegionalClosure =
    session?.user.role === 'plantilla_vehicular' ||
    session?.user.role === 'superadmin' ||
    session?.user.role === 'coordinacion';

  useEffect(() => {
    if (!session) {
      return;
    }

    const refresh = async () => {
      setIsLoading(true);

      try {
        const [loadedCatalogRegions, loadedReportOverview] = await Promise.all([
          api.getRegions(session.accessToken),
          api.getRosterReportOverview(
            session.accessToken,
            selectedRegionId || undefined,
          ),
        ]);

        setCatalogRegions(loadedCatalogRegions);
        setReportOverview(loadedReportOverview);
      } finally {
        setIsLoading(false);
      }
    };

    void refresh();

    socket.on('records.created', refresh);
    socket.on('records.changed', refresh);
    socket.on('reports.submitted', refresh);

    return () => {
      socket.off('records.created', refresh);
      socket.off('records.changed', refresh);
      socket.off('reports.submitted', refresh);
    };
  }, [selectedRegionId, session]);

  const reportStatusTotals = useMemo(
    () => ({
      notReported: reportOverview.filter((row) => row.status === 'NOT_REPORTED').length,
      pendingChanges: reportOverview.filter((row) => row.status === 'PENDING_CHANGES').length,
      reportedWithoutChanges: reportOverview.filter(
        (row) => row.status === 'REPORTED_WITHOUT_CHANGES',
      ).length,
      reportedWithChanges: reportOverview.filter(
        (row) => row.status === 'REPORTED_WITH_CHANGES',
      ).length,
    }),
    [reportOverview],
  );
  const latestRegionalReport = useMemo(() => {
    const rows = selectedRegionId
      ? reportOverview.filter((row) => row.regionId === selectedRegionId)
      : reportOverview;

    return rows
      .map((row) => row.lastReport)
      .filter((report): report is NonNullable<RegionRosterReportOverviewRow['lastReport']> => Boolean(report))
      .sort((left, right) => +new Date(right.submittedAt) - +new Date(left.submittedAt))[0] ?? null;
  }, [reportOverview, selectedRegionId]);

  const selectedRegionOverview = useMemo(
    () => reportOverview.find((row) => row.regionId === selectedRegionId) ?? null,
    [reportOverview, selectedRegionId],
  );
  const hasPendingDelegationReports =
    (selectedRegionOverview?.pendingDelegationReports ?? 0) > 0;
  const isRegionalClosureDisabled =
    !selectedRegionId || hasPendingDelegationReports;
  const regionalClosureButtonText = !selectedRegionId
    ? 'Selecciona una región'
    : hasPendingDelegationReports
      ? 'Faltan delegaciones por confirmar'
      : 'Confirmar cierre mensual';

  const submitRegionalReport = async () => {
    if (!session) {
      return;
    }

    if (!selectedRegionId) {
      await Swal.fire({
        icon: 'warning',
        title: 'Selecciona una región',
        text: 'Debes seleccionar una región para confirmar su cierre mensual.',
        confirmButtonText: 'Entendido',
      });
      return;
    }

    if (hasPendingDelegationReports) {
      await Swal.fire({
        icon: 'warning',
        title: 'Delegaciones pendientes',
        text: 'No puedes confirmar el cierre regional hasta que todas las delegaciones hayan confirmado su plantilla mensual.',
        confirmButtonText: 'Entendido',
      });
      return;
    }

    const selectedRegionName =
      catalogRegions.find((region) => region.id === selectedRegionId)?.name ??
      'la región seleccionada';

    const confirmation = await Swal.fire({
      icon: 'question',
      title: 'Confirmar cierre mensual por región',
      text: `Se registrará el cierre mensual de ${selectedRegionName}.`,
      input: 'textarea',
      inputPlaceholder: 'Observaciones opcionales',
      showCancelButton: true,
      confirmButtonText: 'Confirmar cierre mensual',
      cancelButtonText: 'Cancelar',
    });

    if (!confirmation.isConfirmed) {
      return;
    }

    try {
      await api.submitRegionalRosterReport(
        selectedRegionId,
        typeof confirmation.value === 'string' ? confirmation.value : '',
        session.accessToken,
      );

      const loadedReportOverview = await api.getRosterReportOverview(
        session.accessToken,
        selectedRegionId,
      );

      setReportOverview(loadedReportOverview);

      await Swal.fire({
        icon: 'success',
        title: 'Cierre mensual registrado',
        text: 'La validación mensual de la región se registró correctamente.',
        confirmButtonText: 'Entendido',
      });
    } catch (requestError) {
      await Swal.fire({
        icon: 'error',
        title: 'No se pudo registrar el cierre mensual',
        text: (requestError as Error).message,
        confirmButtonText: 'Entendido',
      });
    }
  };

  if (!session) {
    return null;
  }

  if (isLoading) {
    return <LoadingSpinner message="Cargando validación mensual..." />;
  }

  return (
    <div className="stack-lg">
      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Validación mensual</p>
            <h2>Seguimiento mensual por región</h2>
          </div>

          <div className="panel-actions">
            <div className="panel-meta">
              Último cierre mensual: {latestRegionalReport ? formatDateMx(latestRegionalReport.submittedAt) : 'Sin cierre'}
            </div>
            {canSubmitRegionalClosure && (
              <button
                className="primary-button"
                type="button"
                disabled={isRegionalClosureDisabled}
                onClick={submitRegionalReport}
              >
                {regionalClosureButtonText}
              </button>
            )}
          </div>
        </div>

        <p className="validation-help-text">
          Esta vista concentra la validación mensual por región. Una región queda validada cuando
          su cierre mensual fue registrado; si existen movimientos posteriores, el sistema la marca
          como pendiente de nueva validación.
        </p>

        <div className="report-status-grid">
          <div className="report-status-card is-neutral">
            <span>Sin validación mensual</span>
            <strong>{reportStatusTotals.notReported}</strong>
          </div>

          <div className="report-status-card is-warning">
            <span>Cambios sin validar</span>
            <strong>{reportStatusTotals.pendingChanges}</strong>
          </div>

          <div className="report-status-card is-success">
            <span>Validadas sin cambios</span>
            <strong>{reportStatusTotals.reportedWithoutChanges}</strong>
          </div>

          <div className="report-status-card is-info">
            <span>Validadas con cambios</span>
            <strong>{reportStatusTotals.reportedWithChanges}</strong>
          </div>
        </div>

        <div className="form-grid director-filter-grid">
          <label className="field">
            <span>Región</span>
            <select
              value={selectedRegionId}
              onChange={(event) => setSelectedRegionId(event.target.value)}
            >
              <option value="">Todas las regiones</option>
              {catalogRegions.map((region) => (
                <option key={region.id} value={region.id}>
                  {region.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Estado operativo</p>
            <h2>Estado de validación mensual</h2>
          </div>
        </div>

        {reportOverview.length === 0 ? (
          <EmptyState
            title="No hay validaciones para mostrar"
            description="Ajusta los filtros o espera a que las regiones comiencen a confirmar su cierre mensual."
          />
        ) : (
          <div className="table-wrapper report-table-wrapper">
            <table className="report-overview-table">
              <thead>
                <tr>
                  <th>Región</th>
                  <th>Estado de validación</th>
                  <th>Delegaciones</th>
                  <th>Última validación regional</th>
                  <th>Validado por</th>
                </tr>
              </thead>
              <tbody>
                {reportOverview.map((row) => {
                  const statusInfo = getReportStatusUi(row.status);

                  return (
                    <tr key={row.regionId}>
                      <td>
                        <strong>{row.regionName}</strong>
                      </td>
                      <td>
                        <div className="report-status-cell">
                          <span className={`report-status-badge is-${statusInfo.tone}`}>
                            {statusInfo.label}
                          </span>
                          <small>{statusInfo.description}</small>
                        </div>
                      </td>
                      <td>
                        <span className="report-pending-text">
                          {getPendingDelegationText(row)}
                        </span>
                      </td>
                      <td>{getLastRegionalReportText(row)}</td>
                      <td>{formatUserName(row.lastReport?.submittedBy)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

