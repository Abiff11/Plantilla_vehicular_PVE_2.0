import { useEffect, useMemo, useState } from 'react';
import Swal from 'sweetalert2';
import { EmptyState } from '../components/empty-state';
import { LoadingSpinner } from '../components/loading-spinner';
import { PageIntro } from '../components/page-intro';
import { RecordForm } from '../components/record-form';
import { api } from '../lib/api';
import { useAuth } from '../modules/auth/auth-context';
import type { RecordFieldCatalogMap, RecordFormValues, Region } from '../types';

export function SuperadminCapturePage() {
  const { session } = useAuth();
  const [regions, setRegions] = useState<Region[]>([]);
  const [fieldCatalogs, setFieldCatalogs] = useState<RecordFieldCatalogMap | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!session) {
      return;
    }

    const loadCaptureData = async () => {
      try {
        setLoadError(null);
        const [loadedRegions, loadedFieldCatalogs] = await Promise.all([
          api.getRegions(session.accessToken),
          api.getRecordFieldCatalog(session.accessToken),
        ]);

        setRegions(loadedRegions);
        setFieldCatalogs(loadedFieldCatalogs);
      } catch (requestError) {
        setLoadError((requestError as Error).message);
      }
    };

    void loadCaptureData();
  }, [session]);

  const delegations = useMemo(
    () =>
      regions.flatMap((region) =>
        region.delegations.map((delegation) => ({
          ...delegation,
          name: `${region.name} - ${delegation.name}`,
        })),
      ),
    [regions],
  );

  if (!session) {
    return null;
  }

  if (loadError) {
    return (
      <section className="panel">
        <EmptyState
          title="No se pudo preparar la captura"
          description={loadError}
        />
      </section>
    );
  }

  if (!fieldCatalogs) {
    return <LoadingSpinner message="Cargando catálogos y delegaciones..." />;
  }

  const createRecord = async (values: RecordFormValues, photos: File[] = []) => {
    const selectedDelegation = delegations.find(
      (delegation) => delegation.id === values.delegationId,
    );

    const confirmation = await Swal.fire({
      icon: 'question',
      title: 'Confirmar alta de unidad',
      text: `La unidad se asignará a ${selectedDelegation?.name ?? 'la delegación seleccionada'}.`,
      showCancelButton: true,
      confirmButtonText: 'Guardar unidad',
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

      await Swal.fire({
        icon: 'success',
        title: 'Unidad registrada',
        text: 'La unidad quedó asignada a la delegación seleccionada.',
        confirmButtonText: 'Entendido',
      });
    } catch (requestError) {
      await Swal.fire({
        icon: 'error',
        title: 'No se pudo registrar la unidad',
        text: (requestError as Error).message,
        confirmButtonText: 'Entendido',
      });
      throw requestError;
    }
  };

  return (
    <div className="stack-lg">
      <section className="panel">
        <PageIntro
          eyebrow="Captura administrativa"
          title="Registrar unidad vehicular"
          description="Registra una unidad y selecciona la región y delegación de destino desde el catálogo institucional."
        />
      </section>

      <RecordForm
        delegations={delegations}
        fieldCatalogs={fieldCatalogs}
        delegationSelectionMode="select"
        onSubmit={createRecord}
      />
    </div>
  );
}
