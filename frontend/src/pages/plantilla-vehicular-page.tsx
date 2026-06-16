import { useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import { GroupedRecords } from "../components/grouped-records";
import { LoadingSpinner } from "../components/loading-spinner";
import { RecordForm } from "../components/record-form";
import { api } from "../lib/api";
import { socket } from "../lib/socket";
import { useAuth } from "../modules/auth/auth-context";
import {
  openRecordDetails,
  openTransferDialog,
} from "../modules/records/record-activity";
import { recordToFormValues } from "../modules/records/record-form-values";
import type {
  GroupedRegionRecords,
  RecordFieldCatalogMap,
  RecordFormValues,
  Region,
  VehicleRecord,
} from "../types";

export function PlantillaVehicularPage() {
  const { session } = useAuth();
  const isSuperAdmin = session?.user.role === "superadmin";
  const [regions, setRegions] = useState<GroupedRegionRecords[]>([]);
  const [catalogRegions, setCatalogRegions] = useState<Region[]>([]);
  const [fieldCatalogs, setFieldCatalogs] =
    useState<RecordFieldCatalogMap | null>(null);
  const [selectedRegionId, setSelectedRegionId] = useState<string>("");
  const [selectedDelegationId, setSelectedDelegationId] = useState<string>("");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
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
      const [
        loadedRegions,
        loadedFieldCatalogs,
        loadedCatalogRegions,
      ] = await Promise.all([
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
    socket.on("records.created", refresh);
    socket.on("records.changed", refresh);
    socket.on("reports.submitted", refresh);

    return () => {
      socket.off("records.created", refresh);
      socket.off("records.changed", refresh);
      socket.off("reports.submitted", refresh);
    };
  }, [dateFrom, dateTo, selectedDelegationId, selectedRegionId, session]);

  const availableDelegations = useMemo(() => {
    if (!selectedRegionId) {
      return catalogRegions.flatMap((region) => region.delegations);
    }

    return (
      catalogRegions.find((region) => region.id === selectedRegionId)
        ?.delegations ?? []
    );
  }, [catalogRegions, selectedRegionId]);

  const editingValues = useMemo(
    () => (editingRecord ? recordToFormValues(editingRecord) : undefined),
    [editingRecord],
  );

  const editingDelegation = useMemo(
    () =>
      editingRecord
        ? [
            {
              id: editingRecord.delegation.id,
              name: editingRecord.delegation.name,
            },
          ]
        : [],
    [editingRecord],
  );

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
        icon: "success",
        title: "Traslado registrado",
        text: "El movimiento quedo registrado en la bitacora.",
        confirmButtonText: "Entendido",
      });
    } catch (requestError) {
      await Swal.fire({
        icon: "error",
        title: "No se pudo trasladar el vehiculo",
        text: (requestError as Error).message,
        confirmButtonText: "Entendido",
      });
    }
  };

  const updateRecord = async (recordId: string, values: RecordFormValues) => {
    if (!session) {
      return;
    }

    const confirmation = await Swal.fire({
      icon: "question",
      title: "Confirmar edición",
      text: "Se guardarán los cambios y quedarán registrados en bitácora.",
      showCancelButton: true,
      confirmButtonText: "Guardar cambios",
      cancelButtonText: "Cancelar",
    });

    if (!confirmation.isConfirmed) {
      return;
    }

    try {
      await api.updateRecord(recordId, values, session.accessToken);
      await loadOverview();
      setEditingRecord(null);

      await Swal.fire({
        icon: "success",
        title: "Vehículo actualizado",
        text: "Los cambios se guardaron correctamente.",
        confirmButtonText: "Entendido",
      });
    } catch (requestError) {
      await Swal.fire({
        icon: "error",
        title: "No se pudo actualizar el vehículo",
        text: (requestError as Error).message,
        confirmButtonText: "Entendido",
      });
    }
  };

  const openDetails = async (record: VehicleRecord) => {
    const action = await openRecordDetails(record, {
      canEdit: record.recordState === "CURRENT",
      editButtonText: "Editar vehículo",
    });

    if (action === "edit") {
      setEditingRecord(record);
    }
  };

  const deleteRecord = async (record: VehicleRecord) => {
    if (!session || !isSuperAdmin) {
      return;
    }

    const confirmation = await Swal.fire({
      icon: "warning",
      title: "Eliminar vehículo",
      text: "Esta acción ocultará el registro de la plantilla vigente, pero conservará la trazabilidad en bitácora.",
      showCancelButton: true,
      confirmButtonText: "Eliminar vehículo",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#b91c1c",
    });

    if (!confirmation.isConfirmed) {
      return;
    }

    try {
      await api.deleteRecord(record.id, session.accessToken);
      await loadOverview();

      await Swal.fire({
        icon: "success",
        title: "Vehículo eliminado",
        text: "El registro fue ocultado de la plantilla vigente.",
        confirmButtonText: "Entendido",
      });
    } catch (requestError) {
      await Swal.fire({
        icon: "error",
        title: "No se pudo eliminar el vehículo",
        text: (requestError as Error).message,
        confirmButtonText: "Entendido",
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
      {editingRecord && editingValues && (
        <RecordForm
          mode="edit"
          delegations={editingDelegation}
          fieldCatalogs={fieldCatalogs}
          initialValues={editingValues}
          onCancel={() => setEditingRecord(null)}
          onSubmit={(values) => updateRecord(editingRecord.id, values)}
        />
      )}

      <GroupedRecords
        regions={regions}
        fieldCatalogs={fieldCatalogs}
        eyebrow="Vista general vehicular"
        title="Operación vehicular general"
        description="Consulta la plantilla vehicular registrada por región y delegación."
        vehicleClassAfterDate
        onRecordSelect={(record) => void openDetails(record)}
        renderRecordActions={(record) =>
          record.recordState === "CURRENT" ? (
            <>
              <button
                className="inline-button"
                type="button"
                onClick={() => transferRecord(record)}
              >
                Trasladar
              </button>
              {isSuperAdmin ? (
                <button
                  className="inline-button"
                  type="button"
                  onClick={() => void deleteRecord(record)}
                >
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
                  setSelectedRegionId("");
                  setSelectedDelegationId("");
                  setDateFrom("");
                  setDateTo("");
                }}
              >
                Limpiar consulta
              </button>
            </div>

            <div className="form-grid director-filter-grid query-filter-grid">
              <label className="field">
                <span>Region</span>
                <select
                  value={selectedRegionId}
                  onChange={(event) => {
                    setSelectedRegionId(event.target.value);
                    setSelectedDelegationId("");
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
                <span>Delegacion</span>
                <select
                  value={selectedDelegationId}
                  onChange={(event) =>
                    setSelectedDelegationId(event.target.value)
                  }
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
        }
      />
    </>
  );
}
