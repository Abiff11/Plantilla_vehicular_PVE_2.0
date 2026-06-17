import { useEffect, useState } from 'react';
import Swal from 'sweetalert2';
import { GroupedRecords } from '../components/grouped-records';
import { LoadingSpinner } from '../components/loading-spinner';
import { api } from '../lib/api';
import { socket } from '../lib/socket';
import { useAuth } from '../modules/auth/auth-context';
import { openRecordDetails, openTransferDialog } from '../modules/records/record-activity';
import type {
  GroupedRegionRecords,
  RecordFieldCatalogMap,
  Region,
  VehicleRecord,
} from '../types';

export function DirectorOperativoPage() {
  const { session } = useAuth();
  const [regions, setRegions] = useState<GroupedRegionRecords[]>([]);
  const [catalogRegions, setCatalogRegions] = useState<Region[]>([]);
  const [fieldCatalogs, setFieldCatalogs] = useState<RecordFieldCatalogMap | null>(null);

  useEffect(() => {
    if (!session) {
      return;
    }

    const refresh = async () => {
      const [loadedRegions, loadedFieldCatalogs, loadedCatalogRegions] = await Promise.all([
        api.getRegionalOverview(session.accessToken),
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
  }, [session]);

  const transferRecord = async (record: VehicleRecord) => {
    if (!session) {
      return;
    }

    try {
      const transferred = await openTransferDialog({
        record,
        regions: catalogRegions,
        token: session.accessToken,
        onTransferred: async () => {
          const loadedRegions = await api.getRegionalOverview(session.accessToken);
          setRegions(loadedRegions);
        },
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

  if (!session) {
    return null;
  }

  if (!fieldCatalogs) {
    return <LoadingSpinner message="Cargando datos regionales..." />;
  }

  return (
    <GroupedRecords
      regions={regions}
      fieldCatalogs={fieldCatalogs}
      eyebrow="Supervisión regional"
      title="Delegaciones bajo mi región"
      description="Consulta la plantilla vehicular registrada por las delegaciones asignadas a tu región."
      onRecordSelect={(record) => void openRecordDetails(record)}
      renderRecordActions={(record) =>
        record.recordState === 'CURRENT' ? (
          <button
            className="inline-button"
            type="button"
            onClick={() => void transferRecord(record)}
          >
            Trasladar
          </button>
        ) : null
      }
    />
  );
}
