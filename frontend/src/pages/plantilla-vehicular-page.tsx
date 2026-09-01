import { useEffect, useMemo, useState } from 'react';
import Swal from 'sweetalert2';
import { GroupedRecords } from '../components/grouped-records';
import { LoadingSpinner } from '../components/loading-spinner';
import { VehicleEditModal } from '../components/vehicle-edit-modal';
import { api } from '../lib/api';
import { socket } from '../lib/socket';
import { useAuth } from '../modules/auth/auth-context';
import { openRecordDetails, openTransferDialog } from '../modules/records/record-activity';
import type {
  GroupedRegionRecords,
  RecordFieldCatalogMap,
  Region,
  VehicleEditPayload,
  VehicleRecord,
} from '../types';

export function PlantillaVehicularPage() {
  const { session } = useAuth();
  const canDeleteRecord =
    session?.user.role === 'plantilla_vehicular' ||
    session?.user.role === 'superadmin' ||
    session?.user.role === 'coordinacion';
  const [regions, setRegions] = useState<GroupedRegionRecords[]>([]);
  const [catalogRegions, setCatalogRegions] = useState<Region[]>([]);
  const [fieldCatalogs, setFieldCatalogs] = useState<RecordFieldCatalogMap | null>(null);
  const [selectedRegionId, setSelectedRegionId] = useState('');
  const [selectedDelegationId, setSelectedDelegationId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [editingRecord, setEditingRecord] = useState<VehicleRecord | null>(null);

  const loadOverview = async () => {
    if (!session) {
      return;
    }

    const loadedRegions = await api.getPlantillaVehicularOverview(
      session.accessToken,
      selectedRegionId || undefined,
      selectedDelegationId || undefined,
      dateFrom || undefined,
      dateTo || undefined,
    );

    setRegions(loadedRegions);
  };

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

  const transferRecord = async (record: VehicleRecord) => {
    if (!session) {
      return;
    }

    try {
      const transferred = await openTransferDialog({
        record,
        regions: catalogRegions,
        token: session.accessToken,
        onTransferred: loadOverview,
      });

      if (!transferred) {
        return;
      }

      await Swal.fire({
        icon: 'success',
        title: 'Traslado registrado',
        text: 'El movimiento quedo registrado en la bitacora.',
        confirmButtonText: 'Entendido',
      });
    } catch (requestError) {
      await Swal.fire({
        icon: 'error',
        title: 'No se pudo trasladar el vehiculo',
        text: (requestError as Error).message,
        confirmButtonText: 'Entendido',
      });
    }
  };

  const updateRecord = async (recordId: string, values: VehicleEditPayload) => {
    if (!session) {
      return;
    }

    const confirmation = await Swal.fire({
      icon: 'question',
      title: 'Confirmar edición',
      text: 'Se guardarán los cambios y quedarán registrados en bitácora.',
      showCancelButton: true,
      confirmButtonText: 'Guardar cambios',
      cancelButtonText: 'Cancelar',
    });

    if (!confirmation.isConfirmed) {
      return;
    }

    try {
      await api.updateRecord(recordId, values, session.accessToken);
      await loadOverview();
      setEditingRecord(null);

      await Swal.fire({
        icon: 'success',
        title: 'Vehículo actualizado',
        text: 'Los cambios se guardaron correctamente.',
        confirmButtonText: 'Entendido',
      });
    } catch (requestError) {
      await Swal.fire({
        icon: 'error',
        title: 'No se pudo actualizar el vehículo',
        text: (requestError as Error).message,
        confirmButtonText: 'Entendido',
      });
    }
  };

  const openDetails = async (record: VehicleRecord) => {
    await openRecordDetails(record);
  };

  const deleteRecord = async (record: VehicleRecord) => {
    if (!session || !canDeleteRecord) {
      return;
    }

    const confirmation = await Swal.fire({
      icon: 'warning',
      title: 'Eliminar vehículo',
      text: 'Esta acción ocultará el registro de la plantilla vigente, pero conservará la trazabilidad en bitácora.',
      showCancelButton: true,
      confirmButtonText: 'Eliminar vehículo',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#b91c1c',
    });

    if (!confirmation.isConfirmed) {
      return;
    }

    try {
      await api.deleteRecord(record.id, session.accessToken);
      await loadOverview();

      await Swal.fire({
        icon: 'success',
        title: 'Vehículo eliminado',
        text: 'El registro fue ocultado de la plantilla vigente.',
        confirmButtonText: 'Entendido',
      });
    } catch (requestError) {
      await Swal.fire({
        icon: 'error',
        title: 'No se pudo eliminar el vehículo',
        text: (requestError as Error).message,
        confirmButtonText: 'Entendido',
      });
    }
  };

  if (!session) {
    return null;
  }

  if (!fieldCatalogs) {
    return <LoadingSpinner message="Cargando vista general vehicular..." />;
  }

  return (
    <>
      {editingRecord && (
        <VehicleEditModal
          record={editingRecord}
          fieldCatalogs={fieldCatalogs}
          token={session.accessToken}
          onCancel={() => setEditingRecord(null)}
          onRecordChanged={async () => {
            await loadOverview();
          }}
          onSubmit={async (values) => {
            await updateRecord(editingRecord.id, values);
          }}
        />
      )}

      <div className="stack-lg">
        <GroupedRecords
          regions={regions}
          fieldCatalogs={fieldCatalogs}
          eyebrow="Vista general vehicular"
          title="Operación vehicular general"
          description="Consulta la plantilla vehicular registrada por región y delegación."
          reportContext={reportContext}
          vehicleClassAfterDate
          onRecordSelect={(record) => void openDetails(record)}
          renderRecordActions={(record) =>
            record.recordState === 'CURRENT' ? (
              <>
                <button className="inline-button" type="button" onClick={() => setEditingRecord(record)}>
                  Editar
                </button>
                <button className="inline-button" type="button" onClick={() => void transferRecord(record)}>
                  Trasladar
                </button>
                {canDeleteRecord ? (
                  <button className="inline-button" type="button" onClick={() => void deleteRecord(record)}>
                    Eliminar
                  </button>
                ) : null}
              </>
            ) : null
          }
          headerFilters={
            <section className="query-filter-panel">
              <div className="query-filter-header">
                <div>
                  <p className="eyebrow">Filtros de consulta</p>
                  <h3>Consulta general</h3>
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
            </section>
          }
        />
      </div>
    </>
  );
}
