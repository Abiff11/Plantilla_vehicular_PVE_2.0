import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';
import { EmptyState } from './empty-state';
import { api } from '../lib/api';
import { resolveVehicleDisplayPlate } from '../lib/vehicle-plates';
import { getDelegationLatLng, OAXACA_MAP_BOUNDS } from '../modules/director-general/oaxaca-map-layout';
import { openRecordDetails } from '../modules/records/record-activity';
import type { DirectorOverview, VehicleRecord } from '../types';

function CustomMarker({ icon, children, ...props }: React.ComponentProps<typeof Marker> & { icon: L.DivIcon }) {
  const markerRef = useRef<L.Marker>(null);

  useEffect(() => {
    if (markerRef.current) {
      markerRef.current.setIcon(icon);
    }
  }, [icon]);

  return <Marker ref={markerRef} {...props}>{children}</Marker>;
}

type DirectorOaxacaMapProps = {
  overview: DirectorOverview;
  accessToken: string;
  dateFrom?: string;
  dateTo?: string;
};

const vehicleClassPalette = [
  '#0f766e',
  '#2563eb',
  '#b45309',
  '#7c3aed',
  '#be123c',
  '#15803d',
  '#0f172a',
  '#ea580c',
  '#0891b2',
  '#4338ca',
];

function buildVehicleClassColorMap(overview: DirectorOverview) {
  return Object.fromEntries(
    overview.table.rows.map((row, index) => [
      row.vehicleClass,
      vehicleClassPalette[index % vehicleClassPalette.length],
    ]),
  ) as Record<string, string>;
}

function buildMarkerBackground(
  vehicleClasses: DirectorOverview['map']['delegations'][number]['vehicleClasses'],
  colorMap: Record<string, string>,
) {
  if (vehicleClasses.length === 0) {
    return 'linear-gradient(180deg, #e2e8f0 0%, #cbd5e1 100%)';
  }

  const totalUnits = vehicleClasses.reduce((total, row) => total + row.totalUnits, 0);
  let currentAngle = 0;
  const segments = vehicleClasses.map((row) => {
    const sliceSize = (row.totalUnits / totalUnits) * 360;
    const start = currentAngle;
    currentAngle += sliceSize;
    const color = colorMap[row.vehicleClass] ?? '#475569';
    return `${color} ${start}deg ${currentAngle}deg`;
  });

  return `conic-gradient(${segments.join(', ')})`;
}

function buildMarkerSwatches(
  vehicleClasses: DirectorOverview['map']['delegations'][number]['vehicleClasses'],
  colorMap: Record<string, string>,
) {
  return vehicleClasses
    .map(
      (vehicleClass) => `
        <span
          class="director-live-marker-swatch"
          style="background:${colorMap[vehicleClass.vehicleClass] ?? '#475569'};"
          title="${vehicleClass.vehicleClass}: ${vehicleClass.totalUnits}"
        ></span>
      `,
    )
    .join('');
}

function buildMarkerIcon(
  delegation: DirectorOverview['map']['delegations'][number],
  colorMap: Record<string, string>,
  isSelected: boolean,
) {
  return L.divIcon({
    className: 'director-live-marker-icon',
    html: `
      <div class="director-live-marker ${isSelected ? 'is-selected' : ''}">
        <span
          class="director-live-marker-dot"
          style="background:${buildMarkerBackground(delegation.vehicleClasses, colorMap)};"
        ></span>
        <span class="director-live-marker-count">${delegation.totalUnits}</span>
        <span class="director-live-marker-swatches">
          ${buildMarkerSwatches(delegation.vehicleClasses, colorMap)}
        </span>
      </div>
    `,
    iconSize: [124, 28],
    iconAnchor: [18, 18],
    popupAnchor: [0, -18],
  });
}

export function DirectorOaxacaMap({
  overview,
  accessToken,
  dateFrom,
  dateTo,
}: DirectorOaxacaMapProps) {
  const colorMap = useMemo(() => buildVehicleClassColorMap(overview), [overview]);
  const visibleDelegations = useMemo(() => {
    const { selectedRegionId, selectedDelegationId } = overview.filters;

    return overview.map.delegations.filter((delegation) => {
      if (selectedDelegationId) {
        return delegation.delegationId === selectedDelegationId;
      }

      if (selectedRegionId) {
        return delegation.regionId === selectedRegionId;
      }

      return true;
    });
  }, [overview]);

  const delegationsWithUnits = useMemo(
    () => visibleDelegations.filter((delegation) => delegation.totalUnits > 0),
    [visibleDelegations],
  );

  const [selectedDelegationId, setSelectedDelegationId] = useState<string | null>(
    delegationsWithUnits[0]?.delegationId ?? null,
  );
  const [selectedDelegationVehicles, setSelectedDelegationVehicles] = useState<VehicleRecord[]>([]);
  const [isLoadingDelegationVehicles, setIsLoadingDelegationVehicles] = useState(false);
  const [selectedDelegationVehiclesError, setSelectedDelegationVehiclesError] = useState<string | null>(null);
  const delegationVehiclesRequestRef = useRef(0);

  useEffect(() => {
    setSelectedDelegationId(delegationsWithUnits[0]?.delegationId ?? null);
    setSelectedDelegationVehicles([]);
    setSelectedDelegationVehiclesError(null);
  }, [delegationsWithUnits]);

  const selectedDelegation =
    delegationsWithUnits.find((delegation) => delegation.delegationId === selectedDelegationId) ??
    delegationsWithUnits[0] ??
    null;

  const loadDelegationVehicles = async (delegationId: string) => {
    setSelectedDelegationId(delegationId);
    setSelectedDelegationVehicles([]);
    setSelectedDelegationVehiclesError(null);
    setIsLoadingDelegationVehicles(true);

    const requestId = delegationVehiclesRequestRef.current + 1;
    delegationVehiclesRequestRef.current = requestId;

    try {
      const loadedVehicles = await api.getDirectorDelegationVehicles(
        accessToken,
        delegationId,
        dateFrom,
        dateTo,
      );

      if (delegationVehiclesRequestRef.current !== requestId) {
        return;
      }

      setSelectedDelegationVehicles(loadedVehicles);
    } catch {
      if (delegationVehiclesRequestRef.current !== requestId) {
        return;
      }

      setSelectedDelegationVehiclesError('No se pudieron cargar los vehículos de esta delegación.');
    } finally {
      if (delegationVehiclesRequestRef.current === requestId) {
        setIsLoadingDelegationVehicles(false);
      }
    }
  };

  if (visibleDelegations.length === 0) {
    return (
      <EmptyState
        title="Sin delegaciones para mostrar"
        description="Ajusta los filtros para visualizar el comportamiento territorial."
      />
    );
  }

  if (delegationsWithUnits.length === 0) {
    return (
      <EmptyState
        title="Sin unidades para mostrar"
        description="No hay vehículos en el corte filtrado, por eso el mapa no dibuja marcadores."
      />
    );
  }

  return (
    <div className="director-map-layout">
      <div className="director-map-card">
        <div className="director-map-header">
          <div>
            <p className="eyebrow">Cobertura territorial</p>
            <h2>Mapa operativo de Oaxaca</h2>
          </div>
          <div className="director-map-legend">
            {overview.table.rows.map((row) => (
              <div className="director-map-legend-item" key={row.vehicleClass}>
                <span
                  className="director-map-legend-swatch"
                  style={{ backgroundColor: colorMap[row.vehicleClass] }}
                />
                <span>{row.vehicleClass}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="director-live-map-stage">
          <MapContainer
            bounds={OAXACA_MAP_BOUNDS}
            className="director-live-map"
            scrollWheelZoom={true}
            minZoom={8}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {delegationsWithUnits.map((delegation) => {
              const position = getDelegationLatLng(
                delegation.regionName,
                delegation.delegationName,
              );

              if (!position) {
                return null;
              }

              const isSelected = delegation.delegationId === selectedDelegation?.delegationId;

              return (
                <CustomMarker
                  key={delegation.delegationId}
                  eventHandlers={{
                    click: () => {
                      void loadDelegationVehicles(delegation.delegationId);
                    },
                  }}
                  icon={buildMarkerIcon(delegation, colorMap, isSelected)}
                  position={position}
                >
                  <Popup>
                    <div className="director-live-popup">
                      <strong>{delegation.delegationName}</strong>
                      <span>{delegation.regionName}</span>
                      <span>{delegation.totalUnits} vehículos</span>
                      <span>{delegation.totalActive} activos</span>
                      <div className="director-live-popup-breakdown">
                        {delegation.vehicleClasses.map((vehicleClass) => (
                          <div key={vehicleClass.vehicleClass} className="director-live-popup-row">
                            <span
                              className="director-map-legend-swatch"
                              style={{ backgroundColor: colorMap[vehicleClass.vehicleClass] }}
                            />
                            <span>{vehicleClass.vehicleClass}</span>
                            <strong>{vehicleClass.totalUnits}</strong>
                          </div>
                        ))}
                      </div>

                      {selectedDelegationId === delegation.delegationId && (
                        <>
                          {isLoadingDelegationVehicles && (
                            <p className="map-vehicle-status">Cargando vehículos...</p>
                          )}

                          {selectedDelegationVehiclesError && (
                            <p className="map-vehicle-error">{selectedDelegationVehiclesError}</p>
                          )}

                          {!isLoadingDelegationVehicles && !selectedDelegationVehiclesError && (
                            selectedDelegationVehicles.length > 0 ? (
                              <div className="map-vehicle-list">
                                {selectedDelegationVehicles.map((record) => (
                                  <button
                                    key={record.id}
                                    type="button"
                                    className="map-vehicle-item"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      void openRecordDetails(record);
                                    }}
                                  >
                                    <strong>{resolveVehicleDisplayPlate(record)}</strong>
                                    <span>{record.vehicleClass} · {record.status}</span>
                                    <small>{record.brand} {record.type} · {record.custodian}</small>
                                    <small>Ver detalle</small>
                                  </button>
                                ))}
                              </div>
                            ) : (
                              <p className="map-vehicle-status">Sin vehículos para el filtro actual.</p>
                            )
                          )}
                        </>
                      )}
                    </div>
                  </Popup>
                </CustomMarker>
              );
            })}
          </MapContainer>
        </div>
      </div>
    </div>
  );
}
