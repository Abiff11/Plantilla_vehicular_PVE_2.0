import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useAuth } from '../modules/auth/auth-context';
import { catalogApi } from '../modules/catalogs/catalog-api';
import type { CatalogGroup, CatalogItem } from '../modules/catalogs/catalog-types';

type CatalogKey =
  | 'vehicle_use'
  | 'vehicle_class'
  | 'physical_status'
  | 'circulation_status'
  | 'system_status'
  | 'vehicle_brand'
  | 'vehicle_type'
  | 'vehicle_color'
  | 'asset_classification'
  | 'adscription'
  | 'real_location'
  | 'excel_section';

type CatalogConfig = {
  key: CatalogKey;
  label: string;
  description: string;
};

const CATALOG_CONFIGS: CatalogConfig[] = [
  { key: 'vehicle_use', label: 'Uso vehicular', description: 'Usos operativos detectados en la plantilla.' },
  { key: 'vehicle_class', label: 'Tipo de vehiculo', description: 'Clases vehiculares del archivo Excel.' },
  { key: 'physical_status', label: 'Estado fisico', description: 'Condicion de la unidad normalizada.' },
  { key: 'circulation_status', label: 'Estatus de circulacion', description: 'Valor original de la columna estatus.' },
  { key: 'system_status', label: 'Estatus del sistema', description: 'Valor interno para reportes y dashboard.' },
  { key: 'vehicle_brand', label: 'Marca vehicular', description: 'Marcas detectadas o creadas manualmente.' },
  { key: 'vehicle_type', label: 'Tipo / modelo comercial', description: 'Tipo comercial de la unidad.' },
  { key: 'vehicle_color', label: 'Color de unidad', description: 'Colores detectados en la plantilla.' },
  { key: 'asset_classification', label: 'Clasificacion del bien', description: 'Clasificacion patrimonial o administrativa.' },
  { key: 'adscription', label: 'Adscripcion', description: 'Adscripciones detectadas desde Excel.' },
  { key: 'real_location', label: 'Ubicacion real', description: 'Ubicaciones reales detectadas desde Excel.' },
  { key: 'excel_section', label: 'Seccion Excel', description: 'Agrupadores operativos de la plantilla.' },
];

type CatalogFormState = {
  code: string;
  label: string;
  normalizedValue: string;
  isActive: boolean;
};

const emptyForm: CatalogFormState = {
  code: '',
  label: '',
  normalizedValue: '',
  isActive: true,
};

function normalizeSearch(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '')
    .trim();
}

function getItemSummary(item: CatalogItem) {
  return [item.code, item.label, item.normalizedValue]
    .filter(Boolean)
    .join(' - ');
}

function getAliasesLabel(item: CatalogItem) {
  const aliases = item.aliases ?? [];
  if (aliases.length === 0) {
    return 'Sin alias';
  }

  return aliases.map((alias) => alias.rawValue).join(', ');
}

export function CatalogsPage() {
  const { session } = useAuth();
  const token = session?.accessToken ?? '';
  const [groups, setGroups] = useState<CatalogGroup[]>([]);
  const [selectedGroupCode, setSelectedGroupCode] = useState<CatalogKey>('vehicle_use');
  const [selectedItemId, setSelectedItemId] = useState('');
  const [form, setForm] = useState<CatalogFormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const currentConfig = useMemo(
    () => CATALOG_CONFIGS.find((item) => item.key === selectedGroupCode) ?? CATALOG_CONFIGS[0],
    [selectedGroupCode],
  );

  const selectedGroup = useMemo(
    () => groups.find((group) => group.code === selectedGroupCode) ?? null,
    [groups, selectedGroupCode],
  );

  const rows = selectedGroup?.items ?? [];

  const selectedItem = useMemo(
    () => rows.find((item) => item.id === selectedItemId) ?? null,
    [rows, selectedItemId],
  );

  const filteredRows = useMemo(() => {
    const query = normalizeSearch(search);
    if (!query) {
      return rows;
    }

    return rows.filter((item) =>
      [
        item.code,
        item.label,
        item.normalizedValue,
        getAliasesLabel(item),
        item.isActive ? 'activo' : 'inactivo',
      ]
        .map(normalizeSearch)
        .some((value) => value.includes(query)),
    );
  }, [rows, search]);

  const activeRows = rows.filter((item) => item.isActive).length;

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');

      try {
        const loadedGroups = await catalogApi.getGroups(token);
        setGroups(loadedGroups);
        setSelectedGroupCode((current) => {
          if (loadedGroups.some((group) => group.code === current)) {
            return current;
          }

          const available = CATALOG_CONFIGS.find((config) =>
            loadedGroups.some((group) => group.code === config.key),
          );
          return (available?.key ?? loadedGroups[0]?.code ?? 'vehicle_use') as CatalogKey;
        });
      } catch (loadError) {
        setGroups([]);
        setError(loadError instanceof Error ? loadError.message : 'No se pudieron cargar los catalogos.');
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [token]);

  useEffect(() => {
    if (!selectedGroupCode) {
      setSelectedItemId('');
      return;
    }

    if (!rows.length) {
      setSelectedItemId('');
      return;
    }

    setSelectedItemId((current) => {
      if (current && rows.some((item) => item.id === current)) {
        return current;
      }

      return rows[0]?.id ?? '';
    });
  }, [rows, selectedGroupCode]);

  function clearForm() {
    setForm(emptyForm);
    setEditingId(null);
  }

  function handleSelectGroup(groupCode: string) {
    setSelectedGroupCode(groupCode as CatalogKey);
    setSearch('');
    setSelectedItemId('');
    clearForm();
  }

  function startEdit(item: CatalogItem) {
    setMessage('');
    setError('');
    setEditingId(item.id);
    setForm({
      code: item.code,
      label: item.label,
      normalizedValue: item.normalizedValue,
      isActive: item.isActive,
    });
  }

  async function refreshGroups() {
    const loadedGroups = await catalogApi.getGroups(token);
    setGroups(loadedGroups);
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedGroupCode) {
      return;
    }

    setSaving(true);
    setError('');
    setMessage('');

    try {
      if (editingId) {
        await catalogApi.updateItem(
          editingId,
          {
            label: form.label,
            normalizedValue: form.normalizedValue || form.label,
            isActive: form.isActive,
          },
          token,
        );
      } else {
        await catalogApi.createItem(
          selectedGroupCode,
          {
            code: form.code,
            label: form.label,
            normalizedValue: form.normalizedValue || form.label,
            isActive: form.isActive,
          },
          token,
        );
      }

      await refreshGroups();
      clearForm();
      setMessage(editingId ? 'Concepto actualizado correctamente.' : 'Concepto creado correctamente.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'No se pudo guardar el concepto.');
    } finally {
      setSaving(false);
    }
  }

  async function deactivate(item: CatalogItem) {
    setError('');
    setMessage('');

    try {
      await catalogApi.deleteItem(item.id, token);
      await refreshGroups();
      if (editingId === item.id) {
        clearForm();
      }
      setMessage('Concepto desactivado correctamente.');
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'No se pudo desactivar el concepto.');
    }
  }

  if (loading) {
    return <div className="panel">Cargando catalogos...</div>;
  }

  return (
    <section className="catalogos-page">
      <div className="catalogos-layout">
        <aside className="catalogos-tabs">
          {CATALOG_CONFIGS.map((config) => {
            const group = groups.find((item) => item.code === config.key);

            return (
              <button
                key={config.key}
                type="button"
                className={`catalogos-tab ${selectedGroupCode === config.key ? 'active' : ''}`}
                onClick={() => handleSelectGroup(config.key)}
              >
                <span className="catalogos-tab-main">
                  <strong>{config.label}</strong>
                  <small>{config.description}</small>
                </span>
                <span className="catalogos-count">{group?.items?.length ?? 0}</span>
              </button>
            );
          })}
        </aside>

        <div className="catalogos-panel panel">
          <div className="catalogos-header">
            <div className="catalogos-header-card">
              <h3>{currentConfig.label}</h3>
              <p>{currentConfig.description}</p>
            </div>
            <div className="catalogos-header-card">
              <span>Total activos</span>
              <strong>{activeRows}</strong>
            </div>
          </div>

          <form className={`catalogos-form-card ${editingId ? 'editing' : ''}`} onSubmit={handleSave}>
            <div className="catalogos-form-heading">
              <div>
                <span>{editingId ? 'Editando concepto' : 'Nuevo concepto'}</span>
                <strong>{currentConfig.label}</strong>
              </div>
              {editingId && <small className="editing-badge">Cambios pendientes</small>}
            </div>

            <div className="catalogos-form">
              <label className="field">
                <span>Código</span>
                <input
                  id="catalog-code"
                  name="catalogCode"
                  value={form.code}
                  disabled={Boolean(editingId)}
                  onChange={(event) => setForm((current) => ({ ...current, code: event.target.value }))}
                  required
                />
              </label>

              <label className="field">
                <span>Etiqueta</span>
                <input
                  id="catalog-label"
                  name="catalogLabel"
                  value={form.label}
                  onChange={(event) => setForm((current) => ({ ...current, label: event.target.value }))}
                  required
                />
              </label>

              <label className="field">
                <span>Normalizado</span>
                <input
                  id="catalog-normalized"
                  name="catalogNormalized"
                  value={form.normalizedValue}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, normalizedValue: event.target.value }))
                  }
                />
              </label>

              <label className={`catalogos-toggle ${form.isActive ? 'active' : ''}`}>
                <input
                  id="catalog-active"
                  name="catalogActive"
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, isActive: event.target.checked }))
                  }
                />
                <span>Activo</span>
              </label>

              <div className="form-actions">
                {editingId && (
                  <button type="button" className="ghost-button" onClick={clearForm}>
                    Cancelar edición
                  </button>
                )}
                <button type="submit" disabled={saving}>
                  {saving ? 'Guardando...' : editingId ? 'Guardar cambios' : 'Crear'}
                </button>
              </div>
            </div>
          </form>

          {error && <p className="error">{error}</p>}
          {message && <p className="success">{message}</p>}

          <div className="catalogos-toolbar">
            <div>
              <h4>Registros activos</h4>
              <p>{filteredRows.length} encontrados</p>
            </div>

            <input
              id="catalog-search"
              name="catalogSearch"
              placeholder="Buscar catálogo"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />

            <button type="button" className="ghost-button" onClick={() => setSearch('')}>
              Limpiar
            </button>
          </div>

          <div className="table-wrap">
            <table className="catalogos-table">
              <thead>
                <tr>
                  <th>Concepto</th>
                  <th>Relación</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.length === 0 && (
                  <tr>
                    <td colSpan={3}>No hay registros.</td>
                  </tr>
                )}
                {filteredRows.map((item) => (
                  <tr key={item.id} className={item.id === selectedItemId ? 'is-selected-row' : undefined}>
                    <td>
                      <strong className="catalogos-concept">{getItemSummary(item)}</strong>
                    </td>
                    <td>
                      <span className="catalogos-relation-pill">
                        {item.isActive ? 'Activo' : 'Inactivo'} · {item.aliases?.length ?? 0} alias
                      </span>
                    </td>
                    <td className="catalogos-actions">
                      <button type="button" onClick={() => startEdit(item)}>
                        Editar
                      </button>
                      <button type="button" className="danger-button" onClick={() => deactivate(item)}>
                        Desactivar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}
