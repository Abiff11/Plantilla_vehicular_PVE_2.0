import { useEffect, useMemo, useState } from 'react';
import Swal from 'sweetalert2';
import { api } from '../../lib/api';
import { socket } from '../../lib/socket';
import type {
  RecordFieldCatalogMap,
  RecordFormValues,
  Region,
  User,
  VehicleEditPayload,
  VehicleRecord,
  VehicleRosterReport,
} from '../../types';
import { useAuth } from '../auth/auth-context';
import { openTransferDialog } from './record-activity';

export function useEnlaceData() {
  const { session } = useAuth();
  const [regions, setRegions] = useState<Region[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [records, setRecords] = useState<VehicleRecord[]>([]);
  const [rosterReports, setRosterReports] = useState<VehicleRosterReport[]>([]);
  const [fieldCatalogs, setFieldCatalogs] = useState<RecordFieldCatalogMap | null>(null);

  const loadSnapshot = async () => {
    if (!session) {
      return;
    }

    const [loadedCurrentUser, loadedRegions, loadedRecords, loadedRosterReports, loadedFieldCatalogs] =
      await Promise.all([
        api.getCurrentUser(session.accessToken),
        api.getRegions(session.accessToken),
        api.getMyRecords(session.accessToken),
        api.getMyRosterReports(session.accessToken),
        api.getRecordFieldCatalog(session.accessToken),
      ]);

    setCurrentUser(loadedCurrentUser);
    setRegions(loadedRegions);
    setRecords(loadedRecords);
    setRosterReports(loadedRosterReports);
    setFieldCatalogs(loadedFieldCatalogs);
  };

  useEffect(() => {
    if (!session) {
      return;
    }

    void loadSnapshot();

    socket.on('records.created', loadSnapshot);
    socket.on('records.changed', loadSnapshot);
    socket.on('reports.submitted', loadSnapshot);

    return () => {
      socket.off('records.created', loadSnapshot);
      socket.off('records.changed', loadSnapshot);
      socket.off('reports.submitted', loadSnapshot);
    };
  }, [session]);

  const availableDelegations = useMemo(
    () =>
      regions
        .flatMap((region) => region.delegations)
        .filter((delegation) => delegation.id === currentUser?.delegation?.id) ?? [],
    [currentUser, regions],
  );

  const latestRecord = records[0];
  const latestRosterReport = rosterReports[0];

  const createRecord = async (values: RecordFormValues, photos: File[] = []) => {
    if (!session) {
      return;
    }

    const confirmation = await Swal.fire({
      icon: 'question',
      title: 'Confirmar guardado',
      text: 'Se registrara una nueva captura vehicular.',
      showCancelButton: true,
      confirmButtonText: 'Guardar',
      cancelButtonText: 'Cancelar',
    });

    if (!confirmation.isConfirmed) {
      return;
    }

    try {
      if (photos.length > 0) {
        await api.createRecordWithPhotos(values, photos, session.accessToken);
      } else {
        await api.createRecord(values, session.accessToken);
      }
      await loadSnapshot();

      await Swal.fire({
        icon: 'success',
        title: 'Captura guardada',
        text: 'El registro se guardo correctamente.',
        confirmButtonText: 'Entendido',
      });
    } catch (requestError) {
      await Swal.fire({
        icon: 'error',
        title: 'No se pudo guardar la captura',
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
      title: 'Confirmar edicion',
      text: 'Se guardaran los cambios y quedara marca en bitacora.',
      showCancelButton: true,
      confirmButtonText: 'Guardar cambios',
      cancelButtonText: 'Cancelar',
    });

    if (!confirmation.isConfirmed) {
      return;
    }

    try {
      await api.updateRecord(recordId, values, session.accessToken);
      await loadSnapshot();

      await Swal.fire({
        icon: 'success',
        title: 'Captura actualizada',
        text: 'Los cambios se guardaron correctamente.',
        confirmButtonText: 'Entendido',
      });
    } catch (requestError) {
      await Swal.fire({
        icon: 'error',
        title: 'No se pudo actualizar la captura',
        text: (requestError as Error).message,
        confirmButtonText: 'Entendido',
      });
    }
  };

  const transferRecord = async (record: VehicleRecord) => {
    if (!session) {
      return;
    }

    try {
      const transferred = await openTransferDialog({
        record,
        regions,
        token: session.accessToken,
        onTransferred: loadSnapshot,
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

  const submitRosterReport = async () => {
    if (!session) {
      return;
    }

    const confirmation = await Swal.fire({
      icon: 'question',
      title: 'Confirmar plantilla mensual',
      text: 'Se confirmara el estado actual de la plantilla vehicular de tu delegacion.',
      input: 'textarea',
      inputPlaceholder: 'Observaciones opcionales',
      showCancelButton: true,
      confirmButtonText: 'Confirmar plantilla',
      cancelButtonText: 'Cancelar',
    });

    if (!confirmation.isConfirmed) {
      return;
    }

    try {
      const report = await api.submitRosterReport(
        typeof confirmation.value === 'string' ? confirmation.value : '',
        session.accessToken,
      );

      setRosterReports((current) => [report, ...current]);

      await Swal.fire({
        icon: 'success',
        title: report.hasChanges ? 'Validación mensual enviada con cambios' : 'Validación mensual enviada sin cambios',
        text: `Movimientos detectados desde la última validación: ${report.changesSinceLastReport}.`,
        confirmButtonText: 'Entendido',
      });
    } catch (requestError) {
      await Swal.fire({
        icon: 'error',
        title: 'No se pudo confirmar la plantilla mensual',
        text: (requestError as Error).message,
        confirmButtonText: 'Entendido',
      });
    }
  };

  return {
    session,
    regions,
    records,
    rosterReports,
    latestRecord,
    latestRosterReport,
    availableDelegations,
    fieldCatalogs,
    createRecord,
    updateRecord,
    transferRecord,
    submitRosterReport,
    refresh: loadSnapshot,
  };
}
