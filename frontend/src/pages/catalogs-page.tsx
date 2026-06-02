import { useEffect, useMemo, useState } from 'react';
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
  source: 'manual',
};

export function CatalogsPage() {
  const { session } = useAuth();
  const token = session?.accessToken ?? '';
  const [groups, setGroups] = useState<CatalogGroup[]>([]);
  const [selectedGroupCode, setSelectedGroupCode] = useState<string>('');
  const [items, setItems] = useState<CatalogItem[]>([]);
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

  const activeItems = items.filter((item) => item.isActive).length;
  const inactiveItems = items.length - activeItems;

  useEffect(() => {
    const loadGroups = async () => {
      setIsLoadingGroups(true);
      setError(null);

      try {
        const loadedGroups = await catalogApi.getGroups(token);
        setGroups(loadedGroups);
        setSelectedGroupCode((current) => current || loadedGroups[0]?.code || '');
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'No se pudieron cargar los catalogos.');
      } finally {
        setIsLoadingGroups(false);
      }
    };

    void loadGroups();
  }, [token]);

  useEffect(() => {
    if (!selectedGroupCode) {
      setItems([]);
      return;
    }

    const loadItems = async () => {
      setIsLoadingItems(true);
      setError(null);

      try {
        const loadedItems = await catalogApi.getItems(selectedGroupCode, token);
        setItems(loadedItems);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'No se pudieron cargar los valores del catalogo.');
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
  }

  async function handleCreateGroup(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccessMessage(null);

    try {
      const createdGroup = await catalogApi.createGroup(groupForm, token);
      await refreshGroups();
      setSelectedGroupCode(createdGroup.code);
      setGroupForm(EMPTY_GROUP_FORM);
      setSuccessMessage('Catalogo creado correctamente.');
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'No se pudo crear el catalogo.');
    }
  }

  async function handleCreateItem(event: React.FormEvent<HTMLFormElement>) {
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

  async function handleCreateAlias(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!aliasForm.itemId) {
      setError('Selecciona un valor para asociar el alias.');
      return;
    }

    setError(null);
    setSuccessMessage(null);

    try {
      await catalogApi.createAlias(aliasForm.itemId, {
        rawValue: aliasForm.rawValue,
        source: aliasForm.source,
      }, token);
      await refreshItems();
      setAliasForm(EMPTY_ALIAS_FORM);
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
          Administra los valores que usará la plantilla vehicular y la importación
          de Excel: usos, tipos de vehículo, estados físicos, estatus, colores,
          adscripciones, ubicaciones reales y equivalencias.
        </p>
      </section>

      {error && <div className="error-banner">{error}</div>}
      {successMessage && <div className="success-banner">{successMessage}</div>}

      <section className="panel-grid two-columns">
        <article className="panel-card">
          <h3>Grupos de catálogo</h3>
          {isLoadingGroups ? (
            <p>Cargando catálogos...</p>
          ) : (
            <div className="button-list">
              {groups.map((group) => (
                <button
                  className={group.code === selectedGroupCode ? 'primary-button' : 'secondary-button'}
                  key={group.id}
                  type="button"
                  onClick={() => setSelectedGroupCode(group.code)}
                >
                  {group.name}
                </button>
              ))}
            </div>
          )}
        </article>

        <article className="panel-card">
          <h3>Crear catálogo</h3>
          <form className="form-grid" onSubmit={handleCreateGroup}>
            <label>
              Código
              <input
                required
                value={groupForm.code}
                onChange={(event) => setGroupForm((current) => ({ ...current, code: event.target.value }))}
                placeholder="vehicle_color"
              />
            </label>
            <label>
              Nombre
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
            <button className="primary-button" type="submit">
              Crear catálogo
            </button>
          </form>
        </article>
      </section>

      <section className="panel-card">
        <div className="section-heading-row">
          <div>
            <p className="eyebrow">Catálogo seleccionado</p>
            <h3>{selectedGroup?.name ?? 'Sin catálogo seleccionado'}</h3>
            {selectedGroup?.description && <p>{selectedGroup.description}</p>}
          </div>
          <div className="stats-row">
            <span>{items.length} valores</span>
            <span>{activeItems} activos</span>
            <span>{inactiveItems} inactivos</span>
          </div>
        </div>

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
            Valor normalizado
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
                  <th>Código</th>
                  <th>Etiqueta</th>
                  <th>Normalizado</th>
                  <th>Alias</th>
                  <th>Estatus</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>{item.code}</td>
                    <td>{item.label}</td>
                    <td>{item.normalizedValue}</td>
                    <td>
                      {(item.aliases ?? []).length > 0
                        ? item.aliases?.map((alias) => alias.rawValue).join(', ')
                        : 'Sin alias'}
                    </td>
                    <td>{item.isActive ? 'Activo' : 'Inactivo'}</td>
                    <td>
                      <button className="secondary-button" type="button" onClick={() => void handleToggleItem(item)}>
                        {item.isActive ? 'Desactivar' : 'Activar'}
                      </button>
                    </td>
                  </tr>
                ))}
                {items.length === 0 && (
                  <tr>
                    <td colSpan={6}>Este catálogo aún no tiene valores.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="panel-card">
        <h3>Agregar alias</h3>
        <p>
          Usa alias para relacionar valores del Excel con un valor normalizado del
          sistema. Ejemplo: GRÚA → GRUA.
        </p>
        <form className="form-grid three-columns" onSubmit={handleCreateAlias}>
          <label>
            Valor destino
            <select
              required
              value={aliasForm.itemId}
              onChange={(event) => setAliasForm((current) => ({ ...current, itemId: event.target.value }))}
            >
              <option value="">Selecciona un valor</option>
              {items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Valor del Excel
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
            Agregar alias
          </button>
        </form>
      </section>
    </div>
  );
}
