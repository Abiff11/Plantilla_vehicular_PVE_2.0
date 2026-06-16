import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  resolveVehiclePhysicalStatusTone,
  resolveVehicleStatusTone,
} from '../lib/vehicle-status';
import {
  resolveVehicleDisplayPlate,
  resolveVehiclePlateSourceLabel,
} from '../lib/vehicle-plates';
import { getRecordActivitySummary } from '../modules/records/record-activity';
import type { GroupedRegionRecords, RecordFieldCatalogMap, VehicleRecord } from '../types';
import { EmptyState } from './empty-state';
import { PageIntro } from './page-intro';
import { StatsGrid } from './stats-grid';

type GroupedRecordsProps = {
  regions: GroupedRegionRecords[];
  fieldCatalogs: RecordFieldCatalogMap;
  eyebrow: string;
  title: string;
  description: string;
  headerFilters?: ReactNode;
  vehicleClassAfterDate?: boolean;
  renderRecordActions?: (record: VehicleRecord) => ReactNode;
  onRecordSelect?: (record: VehicleRecord) => void;
};

type FiltersState = {
  search: string;
  useType: string;
  vehicleClass: string;
  physicalStatus: string;
  status: string;
  assetClassification: string;
};

const initialFilters: FiltersState = {
  search: '',
  useType: '',
  vehicleClass: '',
  physicalStatus: '',
  status: '',
  assetClassification: '',
};

function matchesCatalogFilter(
  recordValue: string,
  filterValue: string,
  catalog: RecordFieldCatalogMap[keyof RecordFieldCatalogMap],
) {
  if (!filterValue) {
    return true;
  }

  if (filterValue !== 'OTRO') {
    return recordValue === filterValue;
  }

  if (!catalog.allowsCustom) {
    return false;
  }

  const standardValues = new Set(
    catalog.options.filter((option) => option.value !== 'OTRO').map((option) => option.value),
  );

  return !standardValues.has(recordValue);
}

function resolveImportMetadata(record: VehicleRecord) {
  const parts = [
    record.civ ? `CIV ${record.civ}` : '',
    resolveVehiclePlateSourceLabel(record) !== 'Sin placas'
      ? resolveVehiclePlateSourceLabel(record)
      : '',
    record.color ? `Color ${record.color}` : '',
    record.sourceSection ? `Sección ${record.sourceSection}` : '',
  ].filter(Boolean);

  return parts.join(' · ');
}

export function GroupedRecords({
  regions,
  fieldCatalogs,
  eyebrow,
  title,
  description,
  headerFilters,
  renderRecordActions,
  onRecordSelect,
}: GroupedRecordsProps) {
  const [filters, setFilters] = useState<FiltersState>(initialFilters);

  const filteredRegions = useMemo(() => {
    const normalizedSearch = filters.search.trim().toLowerCase();

    return regions
      .map((region) => ({
        ...region,
        delegations: region.delegations
          .map((delegation) => ({
            ...delegation,
            records: delegation.records.filter((record) => {
              const displayPlate = resolveVehicleDisplayPlate(record);
              const matchesSearch =
                !normalizedSearch ||
                [
                  region.regionName,
                  delegation.delegationName,
                  displayPlate,
                  record.plates,
                  record.previousPlates,
                  record.plates2024,
                  record.plates2025,
                  record.plates2026,
                  record.civ,
                  record.brand,
                  record.type,
                  record.useType,
                  record.vehicleClass,
                  record.model,
                  record.custodian,
                  record.patrolNumber,
                  record.color,
                  record.adscription,
                  record.realLocation,
                  record.rawCirculationStatus,
                  record.sourceSection,
                  record.status,
                  getRecordActivitySummary(record),
                ]
                  .join(' ')
                  .toLowerCase()
                  .includes(normalizedSearch);

              const matchesCatalogFilters =
                matchesCatalogFilter(record.useType, filters.useType, fieldCatalogs.useType) &&
                matchesCatalogFilter(
                  record.vehicleClass,
                  filters.vehicleClass,
                  fieldCatalogs.vehicleClass,
                ) &&
                matchesCatalogFilter(
                  record.physicalStatus,
                  filters.physicalStatus,
                  fieldCatalogs.physicalStatus,
                ) &&
                matchesCatalogFilter(record.status, filters.status, fieldCatalogs.status) &&
                matchesCatalogFilter(
                  record.assetClassification,
                  filters.assetClassification,
                  fieldCatalogs.assetClassification,
                );

              return matchesSearch && matchesCatalogFilters;
            }),
          }))
          .filter((delegation) => delegation.records.length > 0),
      }))
      .filter((region) => region.delegations.length > 0);
  }, [fieldCatalogs, filters, regions]);

  const totalDelegations = filteredRegions.reduce(
    (total, region) => total + region.delegations.length,
    0,
  );
  const totalRecords = filteredRegions.reduce(
    (total, region) =>
      total +
      region.delegations.reduce(
        (delegationTotal, delegation) => delegationTotal + delegation.records.length,
        0,
      ),
    0,
  );
  const totalRegions = filteredRegions.length;

  const latestRecord = filteredRegions
    .flatMap((region) => region.delegations)
    .flatMap((delegation) => delegation.records)
    .sort((left, right) => +new Date(right.createdAt) - +new Date(left.createdAt))[0];

  return (
    <div className="stack-lg">
      <div className="panel">
        <PageIntro
          eyebrow={eyebrow}
          title={title}
          description={description}
          actions={
            <label className="toolbar-search">
              <span>Buscar</span>
              <input
                placeholder="Delegación, placas, CIV, color, adscripción o movimiento"
                value={filters.search}
                onChange={(event) =>
                  setFilters((current) => ({ ...current, search: event.target.value }))
                }
              />
            </label>
          }
        />

        {headerFilters}

        <div className="vehicle-filter-panel">
          <div className="vehicle-filter-header">
            <div>
              <p className="eyebrow">Filtros vehiculares</p>
              <h3>Consulta por características</h3>
            </div>
            <button className="ghost-button" type="button" onClick={() => setFilters(initialFilters)}>
              Limpiar filtros
            </button>
          </div>

          <div className="filter-grid vehicle-filter-grid">
            <label className="field">
              <span>{fieldCatalogs.useType.label}</span>
              <select
                value={filters.useType}
                onChange={(event) =>
                  setFilters((current) => ({ ...current, useType: event.target.value }))
                }
              >
                <option value="">Todos</option>
                {fieldCatalogs.useType.options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>{fieldCatalogs.vehicleClass.label}</span>
              <select
                value={filters.vehicleClass}
                onChange={(event) =>
                  setFilters((current) => ({ ...current, vehicleClass: event.target.value }))
                }
              >
                <option value="">Todos</option>
                {fieldCatalogs.vehicleClass.options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>{fieldCatalogs.physicalStatus.label}</span>
              <select
                value={filters.physicalStatus}
                onChange={(event) =>
                  setFilters((current) => ({ ...current, physicalStatus: event.target.value }))
                }
              >
                <option value="">Todos</option>
                {fieldCatalogs.physicalStatus.options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>{fieldCatalogs.status.label}</span>
              <select
                value={filters.status}
                onChange={(event) =>
                  setFilters((current) => ({ ...current, status: event.target.value }))
                }
              >
                <option value="">Todos</option>
                {fieldCatalogs.status.options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>{fieldCatalogs.assetClassification.label}</span>
              <select
                value={filters.assetClassification}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    assetClassification: event.target.value,
                  }))
                }
              >
                <option value="">Todos</option>
                {fieldCatalogs.assetClassification.options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <StatsGrid
          items={[
            { label: 'Regiones visibles', value: totalRegions },
            { label: 'Delegaciones activas', value: totalDelegations },
            { label: 'Capturas listadas', value: totalRecords },
            {
              label: 'Ultima captura',
              value: latestRecord ? new Date(latestRecord.createdAt).toLocaleTimeString() : '-',
              helper: latestRecord ? latestRecord.delegation.name : 'Sin actividad',
            },
          ]}
        />
      </div>

      {filteredRegions.length === 0 ? (
        <EmptyState
          title="No hay resultados para los filtros actuales"
          description="Ajusta la busqueda o limpia los catalogos seleccionados."
        />
      ) : (
        filteredRegions.map((region) => (
          <section className="panel" key={region.regionId}>
            <div className="panel-header">
              <div>
                <p className="eyebrow">Region</p>
                <h2>{region.regionName}</h2>
              </div>
              <div className="panel-meta">
                {region.delegations.length} delegaciones ·{' '}
                {region.delegations.reduce(
                  (total, delegation) => total + delegation.records.length,
                  0,
                )}{' '}
                capturas
              </div>
            </div>

            <div className="stack-md">
              {region.delegations.map((delegation) => (
                <div className="delegation-block" key={delegation.delegationId}>
                  <div className="delegation-header">
                    <div>
                      <h3>{delegation.delegationName}</h3>
                      <p>{delegation.records.length} capturas registradas</p>
                    </div>
                  </div>

                  <div className="table-wrapper">
                    <table>
                      <thead>
                        <tr>
                          <th>Fecha</th>
                          <th>Identificación</th>
                          <th>Asignación</th>
                          <th>Estado</th>
                          <th>Actividad</th>
                          {(onRecordSelect || renderRecordActions) && <th>Acciones</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {delegation.records.map((record) => (
                          <tr key={`${delegation.delegationId}-${record.id}`}>
                            <td>{new Date(record.createdAt).toLocaleString()}</td>
                            <td>
                              <div className="vehicle-main-cell">
                                <strong>{resolveVehicleDisplayPlate(record)}</strong>
                                <span>{record.vehicleClass} · {record.useType}</span>
                                <small>{record.brand} {record.type} · Modelo {record.model}</small>
                                {resolveImportMetadata(record) && <small>{resolveImportMetadata(record)}</small>}
                              </div>
                            </td>
                            <td>
                              <div className="vehicle-main-cell">
                                <strong>{record.custodian}</strong>
                                <span>{record.adscription || record.delegation.name}</span>
                                <small>{record.realLocation || record.delegation.name}</small>
                                {record.recordState === 'TRANSFERRED_OUT' && (
                                  <small>Registro trasladado</small>
                                )}
                              </div>
                            </td>
                            <td>
                              <div className="vehicle-main-cell">
                                <span className={`record-chip ${resolveVehicleStatusTone(record.status)}`}>{record.status}</span>
                                <span className={`record-chip ${resolveVehiclePhysicalStatusTone(record.physicalStatus)}`}>{record.physicalStatus}</span>
                                <small>{record.rawCirculationStatus || record.assetClassification}</small>
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
                                {record.importBatchId && (
                                  <span className="record-chip is-info">Importado</span>
                                )}
                                <span className="record-activity-text">
                                  {getRecordActivitySummary(record)}
                                </span>
                              </div>
                            </td>
                            {(onRecordSelect || renderRecordActions) && (
                              <td>
                                <div className="table-actions">
                                  {onRecordSelect && (
                                    <button
                                      className="inline-button"
                                      type="button"
                                      onClick={() => onRecordSelect(record)}
                                    >
                                      Detalle
                                    </button>
                                  )}
                                  {renderRecordActions?.(record)}
                                </div>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
