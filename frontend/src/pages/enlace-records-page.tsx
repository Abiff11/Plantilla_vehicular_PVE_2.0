import { EmptyState } from '../components/empty-state';
import { LoadingSpinner } from '../components/loading-spinner';
import { PageIntro } from '../components/page-intro';
import { StatsGrid } from '../components/stats-grid';
import { resolveVehicleDisplayPlate } from '../lib/vehicle-plates';
import { resolveVehiclePhysicalStatusTone, resolveVehicleStatusTone } from '../lib/vehicle-status';
import { getRecordActivitySummary, openRecordDetails } from '../modules/records/record-activity';
import { openRecordEditDialog } from '../modules/records/record-edit-dialog';
import { useEnlaceData } from '../modules/records/use-enlace-data';
import type { VehicleRecord } from '../types';

export function EnlaceRecordsPage() {
  const {
    session,
    records,
    rosterReports,
    latestRecord,
    latestRosterReport,
    fieldCatalogs,
    transferRecord,
    submitRosterReport,
    refresh,
  } = useEnlaceData();

  const editRecord = async (record: VehicleRecord) => {
    if (!session || !fieldCatalogs) {
      return;
    }

    await openRecordEditDialog({
      record,
      fieldCatalogs,
      token: session.accessToken,
      onUpdated: refresh,
    });
  };

  const handleRecordDetails = async (record: VehicleRecord) => {
    const action = await openRecordDetails(record, {
      canEdit: record.recordState === 'CURRENT',
      editButtonText: 'Editar vehículo',
    });

    if (action === 'edit') {
      await editRecord(record);
    }
  };

  if (!session) {
    return null;
  }

  if (!fieldCatalogs) {
    return <LoadingSpinner message="Cargando registros..." />;
  }

  return (
    <div className="stack-lg">
      <section className="panel">
        <PageIntro
          eyebrow="Plantilla vehicular"
          title="Mi plantilla vehicular"
          description="Consulta, edita, traslada y confirma la plantilla vehicular vigente de tu delegación."
        />

        <StatsGrid
          items={[
            { label: 'Delegacion asignada', value: session.user.delegation?.name ?? '-' },
            { label: 'Vehiculos visibles', value: records.length },
            {
              label: 'Ultima captura',
              value: latestRecord ? new Date(latestRecord.createdAt).toLocaleDateString() : '-',
              helper: latestRecord ? resolveVehicleDisplayPlate(latestRecord) : 'Sin registros',
            },
            {
              label: 'Última validación',
              value: latestRosterReport
                ? new Date(latestRosterReport.submittedAt).toLocaleDateString()
                : 'Sin validación',
              helper: latestRosterReport
                ? latestRosterReport.hasChanges
                  ? 'Con cambios'
                  : 'Sin cambios'
                : 'Pendiente',
            },
          ]}
        />
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Unidades registradas</p>
            <h2>Vehículos de mi delegación</h2>
          </div>
          <div className="panel-actions">
            <div className="panel-meta">{records.length} registros</div>
            <button className="primary-button" type="button" onClick={submitRosterReport}>
              Confirmar plantilla mensual
            </button>
          </div>
        </div>

        {records.length === 0 ? (
          <EmptyState
            title="No hay capturas para mostrar"
            description="Usa el formulario para registrar el primer vehiculo de tu delegacion."
          />
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Identificación</th>
                  <th>Asignación</th>
                  <th>Estado</th>
                  <th>Actividad</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {records.map((record) => (
                  <tr key={`${record.viewDelegation.id}-${record.id}`}>
                    <td>{new Date(record.createdAt).toLocaleString()}</td>
                    <td>
                      <div className="vehicle-main-cell">
                        <strong>{resolveVehicleDisplayPlate(record)}</strong>
                        <span>{record.vehicleClass} · {record.useType}</span>
                        <small>{record.brand} {record.type} · Modelo {record.model}</small>
                      </div>
                    </td>
                    <td>
                      <div className="vehicle-main-cell">
                        <strong>{record.custodian}</strong>
                        <span>{record.delegation.name}</span>
                        {record.recordState === 'TRANSFERRED_OUT' && (
                          <small>Registro trasladado</small>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className="vehicle-main-cell">
                        <span className={`record-chip ${resolveVehicleStatusTone(record.status)}`}>{record.status}</span>
                        <span className={`record-chip ${resolveVehiclePhysicalStatusTone(record.physicalStatus)}`}>{record.physicalStatus}</span>
                        <small>{record.assetClassification}</small>
                      </div>
                    </td>
                    <td>
                      <div className="record-activity-cell">
                        {record.recordState === 'TRANSFERRED_OUT' && (
                          <span className="record-chip is-muted">Trasladado</span>
                        )}
                        {record.latestEdit && (
                          <span className="record-chip is-info">Editado</span>
                        )}
                        <span className="record-activity-text">
                          {getRecordActivitySummary(record)}
                        </span>
                      </div>
                    </td>
                    <td>
                      <div className="table-actions">
                        {record.recordState === 'CURRENT' && (
                          <>
                            <button
                              className="inline-button"
                              type="button"
                              onClick={() => void editRecord(record)}
                            >
                              Editar
                            </button>
                            <button
                              className="inline-button"
                              type="button"
                              onClick={() => void transferRecord(record)}
                            >
                              Trasladar
                            </button>
                          </>
                        )}
                        <button
                          className="inline-button"
                          type="button"
                          onClick={() => void handleRecordDetails(record)}
                        >
                          Detalle
                        </button>
                      </div>
                    </td>
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
            <p className="eyebrow">Validaciones enviadas</p>
            <h2>Historial de confirmaciones mensuales</h2>
          </div>
          <div className="panel-meta">{rosterReports.length} validaciones</div>
        </div>

        {rosterReports.length === 0 ? (
          <EmptyState
            title="Sin validaciones enviadas"
            description="El envio de reporte confirma el estado actual de la plantilla."
          />
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Fecha de validación</th>
                  <th>Resultado de validación</th>
                  <th>Movimientos detectados</th>
                  <th>Observaciones</th>
                </tr>
              </thead>
              <tbody>
                {rosterReports.map((report) => (
                  <tr key={report.id}>
                    <td>{new Date(report.submittedAt).toLocaleString()}</td>
                    <td>{report.hasChanges ? 'Con cambios' : 'Sin cambios'}</td>
                    <td>{report.changesSinceLastReport}</td>
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
