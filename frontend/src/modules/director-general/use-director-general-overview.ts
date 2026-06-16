import { useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';
import { socket } from '../../lib/socket';
import type { DirectorOverview } from '../../types';

type UseDirectorGeneralOverviewParams = {
  accessToken?: string;
};

export function useDirectorGeneralOverview({ accessToken }: UseDirectorGeneralOverviewParams) {
  const [overview, setOverview] = useState<DirectorOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedRegionId, setSelectedRegionId] = useState<string>('');
  const [selectedDelegationId, setSelectedDelegationId] = useState<string>('');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

  useEffect(() => {
    const loadOverview = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const loaded = await api.getDirectorGeneralOverview(
          accessToken ?? '',
          selectedRegionId || undefined,
          selectedDelegationId || undefined,
          dateFrom || undefined,
          dateTo || undefined,
        );
        setOverview(loaded);
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : 'No se pudo cargar el tablero directivo.');
      } finally {
        setIsLoading(false);
      }
    };

    void loadOverview();
    socket.on('records.created', loadOverview);
    socket.on('records.changed', loadOverview);
    socket.on('reports.submitted', loadOverview);

    return () => {
      socket.off('records.created', loadOverview);
      socket.off('records.changed', loadOverview);
      socket.off('reports.submitted', loadOverview);
    };
  }, [accessToken, dateFrom, dateTo, selectedDelegationId, selectedRegionId]);

  const availableDelegations = useMemo(() => {
    if (!overview) {
      return [];
    }

    if (!selectedRegionId) {
      return overview.filters.regions.flatMap((region) => region.delegations);
    }

    return (
      overview.filters.regions.find((region) => region.regionId === selectedRegionId)?.delegations ??
      []
    );
  }, [overview, selectedRegionId]);

  const selectedRegionName = useMemo(() => {
    if (!overview || !selectedRegionId) {
      return 'Todas las regiones';
    }

    return (
      overview.filters.regions.find((region) => region.regionId === selectedRegionId)?.regionName ??
      'Todas las regiones'
    );
  }, [overview, selectedRegionId]);

  const selectedDelegationName = useMemo(() => {
    if (!selectedDelegationId) {
      return 'Todas las delegaciones';
    }

    return (
      availableDelegations.find((delegation) => delegation.id === selectedDelegationId)?.name ??
      'Todas las delegaciones'
    );
  }, [availableDelegations, selectedDelegationId]);

  return {
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
  };
}
