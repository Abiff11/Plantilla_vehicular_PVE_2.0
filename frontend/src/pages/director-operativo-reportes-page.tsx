import { useEffect, useMemo, useState } from 'react';
import { EmptyState } from '../components/empty-state';
import { LoadingSpinner } from '../components/loading-spinner';
import { formatDateMx, formatDateTimeMx } from '../lib/date-format';
import { api } from '../lib/api';
import { formatUserName } from '../lib/format-user-name';
import { socket } from '../lib/socket';
import { useAuth } from '../modules/auth/auth-context';
import type { RosterReportOverviewRow, VehicleRosterReport } from '../types';

export function DirectorOperativoReportesPage() {
  const { session } = useAuth();
  const [delegationReportOverview, setDelegationReportOverview] = useState<RosterReportOverviewRow[]>([]);
  const [regionalReports, setRegionalReports] = useState<VehicleRosterReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!session) {
      return;
    }

    const refresh = async () => {
      setIsLoading(true);
      try {
        const [loadedDelegationReportOverview, loadedRegionalReports] = await Promise.all([
          api.getRegionalRosterReportOverview(session.accessToken),
          api.getMyRegionalRosterReports(session.accessToken),
        ]);

        setDelegationReportOverview(loadedDelegationReportOverview);
        setRegionalReports(loadedRegionalReports);
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
  }, [session]);

  const reportStatusTotals = useMemo(
    () => ({
      notReported: delegationReportOverview.filter((row) => row.status === 'NOT_REPORTED').length,
      pendingChanges: delegationReportOverview.filter((row) => row.status === 'PENDING_CHANGES').length,
      reportedWithoutChanges: delegationReportOverview.filter(
        (row) => row.status === 'REPORTED_WITHOUT_CHANGES',
      ).length,
      reportedWithChanges: delegationReportOverview.filter(
        (row) => row.status === 'REPORTED_WITH_CHANGES',
      ).length,
    }),
    [delegationReportOverview],
  );

  const latestRegionalReport = regionalReports[0];

  if (!session) {
    return null;
  }

  if (isLoading) {
    return <LoadingSpinner message="Cargando datos regionales..." />;
  }

  return (
    <div className="stack-lg">
      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Seguimiento regional</p>
            <h2>Confirmaciones mensuales por delegación</h2>
          </div>
          <div className="panel-meta">
            Último cierre mensual regional: {latestRegionalReport ? formatDateMx(latestRegionalReport.submittedAt) : 'Sin validación'}
          </div>
        </div>

        <p className="validation-help-text">
          Esta vista es solo de consulta para monitorear las confirmaciones mensuales de las
          delegaciones bajo tu región y el estado del cierre mensual regional.
        </p>

        <div className="report-status-grid">
          <div className="report-status-card">
            <span>Sin validación mensual</span>
            <strong>{reportStatusTotals.notReported}</strong>
          </div>
          <div className="report-status-card">
            <span>Cambios sin validar</span>
            <strong>{reportStatusTotals.pendingChanges}</strong>
          </div>
          <div className="report-status-card">
            <span>Validadas sin cambios</span>
            <strong>{reportStatusTotals.reportedWithoutChanges}</strong>
          </div>
          <div className="report-status-card">
            <span>Validadas con cambios</span>
            <strong>{reportStatusTotals.reportedWithChanges}</strong>
          </div>
        </div>

        {delegationReportOverview.length === 0 ? (
          <EmptyState
            title="No hay delegaciones para mostrar"
            description="No se encontraron delegaciones asociadas a tu region."
          />
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Delegacion</th>
                  <th>Estado de validación</th>
                  <th>Movimientos sin validar</th>
                  <th>Última validación</th>
                  <th>Validado por</th>
                </tr>
              </thead>
              <tbody>
                {delegationReportOverview.map((row) => (
                  <tr key={row.delegationId}>
                    <td>{row.delegationName}</td>
                    <td>{row.status}</td>
                    <td>{row.pendingChanges}</td>
                    <td>
                      {row.lastReport
                        ? formatDateTimeMx(row.lastReport.submittedAt)
                        : 'Sin validación'}
                    </td>
                    <td>{formatUserName(row.lastReport?.submittedBy)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Cierres regionales registrados</p>
            <h2>Historial de cierre mensual regional</h2>
          </div>
          <div className="panel-meta">{regionalReports.length} validaciones</div>
        </div>

        {regionalReports.length === 0 ? (
          <EmptyState
            title="Sin validaciones regionales"
            description="Cuando se registren cierres mensuales de la región, aparecerán aquí."
          />
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Fecha de validación</th>
                  <th>Resultado de validación</th>
                  <th>Delegaciones confirmadas</th>
                  <th>Observaciones</th>
                </tr>
              </thead>
              <tbody>
                {regionalReports.map((report) => (
                  <tr key={report.id}>
                    <td>{formatDateTimeMx(report.submittedAt)}</td>
                    <td>{report.hasChanges ? 'Con confirmaciones' : 'Sin nuevas confirmaciones'}</td>
                    <td>{report.confirmedDelegationReports}</td>
                    <td>{report.notes || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
