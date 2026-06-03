import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { catalogApi } from '../modules/catalogs/catalog-api';
import type { CatalogGroup, CatalogItem } from '../modules/catalogs/catalog-types';
import { useAuth } from '../modules/auth/auth-context';

const EMPTY_GROUP_FORM = {
  code: '',
  name: '',
  description: '',
};

const EMPTY_ITEM_FORM = {
  code: '',
  label: '',
  normalizedValue: '',
};

const EMPTY_ALIAS_FORM = {
  itemId: '',
  rawValue: '',
  source: 'excel',
};

function normalizeSearch(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '')
    .trim();
}

function getAliasesLabel(item: CatalogItem) {
  if (!item.aliases || item.aliases.length === 0) {
    return 'Sin alias';
  }

  return item.aliases.map((alias) => alias.rawValue).join(', ');
}

export function CatalogsPage() {
  const { session } = useAuth();
  const token = session?.accessToken ?? '';
  const [groups, setGroups] = useState<CatalogGroup[]>([]);
  const [selectedGroupCode, setSelectedGroupCode] = useState<string>('');
  const [selectedItemId, setSelectedItemId] = useState<string>('');
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [groupSearch, setGroupSearch] = useState('');
  const [itemSearch, setItemSearch] = useState('');
  const [isLoadingGroups, setIsLoadingGroups] = useState(true);
  const [isLoadingItems, setIsLoadingItems] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [groupForm, setGroupForm] = useState(EMPTY_GROUP_FORM);
  const [itemForm, setItemForm] = useState(EMPTY_ITEM_FORM);
  const [aliasForm, setAliasForm] = useState(EMPTY_ALIAS_FORM);

  const selectedGroup = useMemo(
    () => groups.find((group) => group.code === selectedGroupCode) ?? null,
    [groups, selectedGroupCode],
  );

  const selectedItem = useMemo(
    () => items.find((item) => item.id === selectedItemId) ?? null,
    [items, selectedItemId],
  );

  const filteredGroups = useMemo(() => {
    const search = normalizeSearch(groupSearch);

    if (!search) {
      return groups;
    }

    return groups.filter((group) =>
      [group.code, group.name, group.description]
        .map(normalizeSearch)
        .some((value) => value.includes(search)),
    );
  }, [groupSearch, groups]);

  const filteredItems = useMemo(() => {
    const search = normalizeSearch(itemSearch);

    if (!search) {
      return items;
    }

    return items.filter((item) =>
      [
        item.code,
        item.label,
        item.normalizedValue,
        getAliasesLabel(item),
        item.isActive ? 'activo' : 'inactivo',
      ]
        .map(normalizeSearch)
        .some((value) => value.includes(search)),
    );
  }, [itemSearch, items]);

  const activeItems = items.filter((item) => item.isActive).length;
  const inactiveItems = items.length - activeItems;
  const totalAliases = items.reduce((total, item) => total + (item.aliases?.length ?? 0), 0);

  useEffect(() => {
    const loadGroups = async () => {
      setIsLoadingGroups(true);
      setError(null);

      try {
        const loadedGroups = await catalogApi.getGroups(token);
        setGroups(loadedGroups);
        setSelectedGroupCode((current) => current || loadedGroups[0]?.code || '');
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'No se pudieron cargar los catálogos.');
      } finally {
        setIsLoadingGroups(false);
      }
    };

    void loadGroups();
  }, [token]);

  useEffect(() => {
    if (!selectedGroupCode) {
      setItems([]);
      setSelectedItemId('');
      return;
    }

    const loadItems = async () => {
      setIsLoadingItems(true);
      setError(null);

      try {
        const loadedItems = await catalogApi.getItems(selectedGroupCode, token);
        setItems(loadedItems);
        setSelectedItemId((current) => {
          if (current && loadedItems.some((item) => item.id === current)) {
            return current;
          }

          return loadedItems[0]?.id ?? '';
        });
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'No se pudieron cargar los valores del catálogo.');
      } finally {
        setIsLoadingItems(false);
      }
    };

    void loadItems();
  }, [selectedGroupCode, token]);

  async function refreshGroups() {
    const loadedGroups = await catalogApi.getGroups(token);
    setGroups(loadedGroups);
  }

  async function refreshItems() {
    if (!selectedGroupCode) {
      return;
    }

    const loadedItems = await catalogApi.getItems(selectedGroupCode, token);
    setItems(loadedItems);
    setSelectedItemId((current) => {
      if (current && loadedItems.some((item) => item.id === current)) {
        return current;
      }

      return loadedItems[0]?.id ?? '';
    });
  }

  function selectGroup(groupCode: string) {
    setSelectedGroupCode(groupCode);
    setSelectedItemId('');
    setItemSearch('');
    setAliasForm(EMPTY_ALIAS_FORM);
  }

  function selectItem(item: CatalogItem) {
    setSelectedItemId(item.id);
    setAliasForm((current) => ({ ...current, itemId: item.id }));
  }

  async function handleCreateGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccessMessage(null);

    try {
      const createdGroup = await catalogApi.createGroup(groupForm, token);
      await refreshGroups();
      setSelectedGroupCode(createdGroup.code);
      setGroupForm(EMPTY_GROUP_FORM);
      setSuccessMessage('Catálogo creado correctamente.');
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'No se pudo crear el catálogo.');
    }
  }

  async function handleCreateItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedGroupCode) {
      return;
    }

    setError(null);
    setSuccessMessage(null);

    try {
      await catalogApi.createItem(selectedGroupCode, {
        code: itemForm.code,
        label: itemForm.label,
        normalizedValue: itemForm.normalizedValue || itemForm.label,
      }, token);
      await refreshItems();
      setItemForm(EMPTY_ITEM_FORM);
      setSuccessMessage('Valor creado correctamente.');
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'No se pudo crear el valor.');
    }
  }

  async function handleToggleItem(item: CatalogItem) {
    setError(null);
    setSuccessMessage(null);

    try {
      await catalogApi.updateItem(item.id, { isActive: !item.isActive }, token);
      await refreshItems();
      setSuccessMessage(item.isActive ? 'Valor desactivado.' : 'Valor activado.');
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'No se pudo actualizar el valor.');
    }
  }

  async function handleCreateAlias(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const itemId = aliasForm.itemId || selectedItemId;

    if (!itemId) {
      setError('Selecciona un valor para asociar el alias.');
      return;
    }

    setError(null);
    setSuccessMessage(null);

    try {
      await catalogApi.createAlias(itemId, {
        rawValue: aliasForm.rawValue,
        source: aliasForm.source,
      }, token);
      await refreshItems();
      setAliasForm({ ...EMPTY_ALIAS_FORM, itemId });
      setSuccessMessage('Alias creado correctamente.');
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'No se pudo crear el alias.');
    }
  }

  return (
    <div className="page-stack">
      <section className="hero-card">
        <p className="eyebrow">Administración</p>
        <h2>Catálogos</h2>
        <p>
          Administra los valores maestros y sus equivalencias para que la importación
          de Excel reconozca variantes sin modificar el archivo original.
        </p>
      </section>

      {error && <div className="error-banner">{error}</div>}
      {successMessage && <div className="success-banner">{successMessage}</div>}

      <section className="panel-grid two-columns">
        <article className="panel-card">
          <div className="section-heading-row">
            <div>
              <p className="eyebrow">Paso 1</p>
              <h3>Selecciona catálogo</h3>
            </div>
            <span>{groups.length} grupos</span>
          </div>

          <label>
            Buscar catálogo
            <input
              value={groupSearch}
              onChange={(event) => setGroupSearch(event.target.value)}
              placeholder="Uso, tipo, estatus, ubicación..."
            />
          </label>

          {isLoadingGroups ? (
            <p>Cargando catálogos...</p>
          ) : (
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Catálogo</th>
                    <th>Tipo</th>
                    <th>Valores</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredGroups.map((group) => (
                    <tr
                      key={group.id}
                      onClick={() => selectGroup(group.code)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td>
                        <strong>{group.name}</strong>
                        <br />
                        <small>{group.code}</small>
                      </td>
                      <td>{group.isSystem ? 'Sistema' : 'Manual'}</td>
                      <td>{group.items?.length ?? 0}</td>
                    </tr>
                  ))}
                  {filteredGroups.length === 0 && (
                    <tr>
                      <td colSpan={3}>No hay catálogos con esa búsqueda.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </article>

        <article className="panel-card">
          <div className="section-heading-row">
            <div>
              <p className="eyebrow">Crear nuevo grupo</p>
              <h3>Solo si falta un catálogo completo</h3>
            </div>
          </div>
          <p>
            Para valores del Excel normalmente no crees grupos; selecciona un catálogo
            existente y agrega un valor o alias.
          </p>
          <form className="form-grid" onSubmit={handleCreateGroup}>
            <label>
              Código técnico
              <input
                required
                value={groupForm.code}
                onChange={(event) => setGroupForm((current) => ({ ...current, code: event.target.value }))}
                placeholder="vehicle_color"
              />
            </label>
            <label>
              Nombre visible
              <input
                required
                value={groupForm.name}
                onChange={(event) => setGroupForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="Color de unidad"
              />
            </label>
            <label>
              Descripción
              <textarea
                value={groupForm.description}
                onChange={(event) => setGroupForm((current) => ({ ...current, description: event.target.value }))}
                placeholder="Valores permitidos para..."
              />
            </label>
            <button className="secondary-button" type="submit">
              Crear grupo
            </button>
          </form>
        </article>
      </section>

      <section className="panel-card">
        <div className="section-heading-row">
          <div>
            <p className="eyebrow">Paso 2</p>
            <h3>{selectedGroup?.name ?? 'Sin catálogo seleccionado'}</h3>
            <p>{selectedGroup?.description || 'Selecciona un catálogo para administrar sus valores.'}</p>
          </div>
          <div className="stats-row">
            <span>{items.length} valores</span>
            <span>{activeItems} activos</span>
            <span>{inactiveItems} inactivos</span>
            <span>{totalAliases} alias</span>
          </div>
        </div>

        <div className="panel-grid two-columns">
          <article>
            <div className="section-heading-row">
              <div>
                <h3>Valores del catálogo</h3>
                <p>Selecciona un valor para ver sus alias o agregar equivalencias.</p>
              </div>
            </div>

            <label>
              Buscar valor
              <input
                value={itemSearch}
                onChange={(event) => setItemSearch(event.target.value)}
                placeholder="CIRCULANDO, GRUA, SINIESTRADO..."
              />
            </label>

            <form className="form-grid three-columns" onSubmit={handleCreateItem}>
              <label>
                Código
                <input
                  required
                  value={itemForm.code}
                  onChange={(event) => setItemForm((current) => ({ ...current, code: event.target.value }))}
                  placeholder="CIRCULANDO"
                />
              </label>
              <label>
                Etiqueta
                <input
                  required
                  value={itemForm.label}
                  onChange={(event) => setItemForm((current) => ({ ...current, label: event.target.value }))}
                  placeholder="CIRCULANDO"
                />
              </label>
              <label>
                Normalizado
                <input
                  value={itemForm.normalizedValue}
                  onChange={(event) => setItemForm((current) => ({ ...current, normalizedValue: event.target.value }))}
                  placeholder="Opcional"
                />
              </label>
              <button className="primary-button" disabled={!selectedGroupCode} type="submit">
                Agregar valor
              </button>
            </form>

            {isLoadingItems ? (
              <p>Cargando valores...</p>
            ) : (
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Valor</th>
                      <th>Normalizado</th>
                      <th>Alias</th>
                      <th>Estatus</th>
                      <th>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredItems.map((item) => (
                      <tr
                        key={item.id}
                        onClick={() => selectItem(item)}
                        style={{ cursor: 'pointer' }}
                      >
                        <td>
                          <strong>{item.label}</strong>
                          <br />
                          <small>{item.code}</small>
                        </td>
                        <td>{item.normalizedValue}</td>
                        <td>{item.aliases?.length ?? 0}</td>
                        <td>{item.isActive ? 'Activo' : 'Inactivo'}</td>
                        <td>
                          <button
                            className="secondary-button"
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              void handleToggleItem(item);
                            }}
                          >
                            {item.isActive ? 'Desactivar' : 'Activar'}
                          </button>
                        </td>
                      </tr>
                    ))}
                    {filteredItems.length === 0 && (
                      <tr>
                        <td colSpan={5}>Este catálogo no tiene valores con esa búsqueda.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </article>

          <article className="panel-card">
            <div className="section-heading-row">
              <div>
                <p className="eyebrow">Paso 3</p>
                <h3>Alias del valor seleccionado</h3>
              </div>
            </div>

            {selectedItem ? (
              <>
                <div className="stats-row">
                  <span>{selectedItem.label}</span>
                  <span>{selectedItem.isActive ? 'Activo' : 'Inactivo'}</span>
                </div>
                <p>
                  Usa alias cuando el Excel trae el mismo concepto escrito diferente.
                  Ejemplo: GRÚA → GRUA.
                </p>

                <div className="table-scroll">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Valor del Excel</th>
                        <th>Normalizado</th>
                        <th>Origen</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(selectedItem.aliases ?? []).map((alias) => (
                        <tr key={alias.id}>
                          <td>{alias.rawValue}</td>
                          <td>{alias.normalizedRawValue}</td>
                          <td>{alias.source}</td>
                        </tr>
                      ))}
                      {(selectedItem.aliases ?? []).length === 0 && (
                        <tr>
                          <td colSpan={3}>Este valor aún no tiene alias.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <form className="form-grid" onSubmit={handleCreateAlias}>
                  <input type="hidden" value={selectedItem.id} />
                  <label>
                    Valor exacto del Excel
                    <input
                      required
                      value={aliasForm.rawValue}
                      onChange={(event) => setAliasForm((current) => ({ ...current, rawValue: event.target.value }))}
                      placeholder="GRÚA"
                    />
                  </label>
                  <label>
                    Origen
                    <input
                      value={aliasForm.source}
                      onChange={(event) => setAliasForm((current) => ({ ...current, source: event.target.value }))}
                      placeholder="excel"
                    />
                  </label>
                  <button className="primary-button" type="submit">
                    Agregar alias a {selectedItem.label}
                  </button>
                </form>
              </>
            ) : (
              <p>Selecciona un valor del catálogo para administrar sus alias.</p>
            )}
          </article>
        </div>
      </section>

      <section className="panel-card">
        <p className="eyebrow">Guía rápida</p>
        <h3>Cuándo crear valor y cuándo crear alias</h3>
        <div className="panel-grid two-columns">
          <div>
            <strong>Crear valor</strong>
            <p>Cuando el Excel trae una categoría nueva real que debe existir en el sistema.</p>
            <small>Ejemplo: agregar BICICLETA en tipo de vehículo.</small>
          </div>
          <div>
            <strong>Crear alias</strong>
            <p>Cuando el Excel trae una variante de un valor que ya existe.</p>
            <small>Ejemplo: GRÚA, GRUA PATRULLA o GRUA → GRUA.</small>
          </div>
        </div>
      </section>
    </div>
  );
}
