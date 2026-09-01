import { useEffect, useMemo, useState } from 'react';
import Swal from 'sweetalert2';
import { EmptyState } from '../components/empty-state';
import { PageIntro } from '../components/page-intro';
import { StatsGrid } from '../components/stats-grid';
import { api } from '../lib/api';
import { useAuth } from '../modules/auth/auth-context';
import type { CreateUserPayload, Region, UpdateUserPayload, User } from '../types';

function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, ' ');
}

function normalizeUpper(value: string) {
  return normalizeText(value).toUpperCase();
}

function normalizeEmail(value: string) {
  return normalizeText(value).toLowerCase();
}

const PASSWORD_POLICY_REGEX = /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[^\w\s]).{8,}$/;

const emptyUser: CreateUserPayload = {
  firstName: '',
  lastName: '',
  grade: '',
  email: '',
  password: '',
  role: 'enlace',
  phone: '',
  regionId: undefined,
  delegationId: undefined,
};

export function CoordinacionPage() {
  const { session } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [regions, setRegions] = useState<Region[]>([]);
  const [draftUser, setDraftUser] = useState<CreateUserPayload>(emptyUser);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const USERS_PER_PAGE = 50;

  useEffect(() => {
    if (!session) {
      return;
    }

    const loadData = async () => {
      const [loadedUsersResponse, loadedRegions] = await Promise.all([
        api.getUsers(session.accessToken, currentPage, USERS_PER_PAGE),
        api.getRegions(session.accessToken),
      ]);

      const usersList = Array.isArray(loadedUsersResponse)
        ? loadedUsersResponse
        : loadedUsersResponse.items;
      const pages = Array.isArray(loadedUsersResponse)
        ? 1
        : Math.max(1, loadedUsersResponse.meta.totalPages);
      const total = Array.isArray(loadedUsersResponse)
        ? loadedUsersResponse.length
        : loadedUsersResponse.meta.totalItems;

      setUsers(usersList);
      setTotalPages(pages);
      setTotalItems(total);
      setRegions(loadedRegions);
    };

    void loadData();
  }, [session, currentPage]);

  if (!session) {
    return null;
  }

  const selectedRegion = regions.find((region) => region.id === draftUser.regionId);
  const availableDelegations = selectedRegion?.delegations ?? [];
  const isEditing = editingUserId !== null;
  const isEditingSelf = editingUserId === session.user.id;
  const isSuperAdmin = session.user.role === 'superadmin';

  const filteredUsers = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    if (!normalizedSearch) {
      return users;
    }

    return users.filter((user) =>
      [
        user.fullName,
        user.email,
        user.grade,
        user.role,
        user.region?.name,
        user.delegation?.name,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(normalizedSearch),
    );
  }, [search, users]);

  const resetForm = () => {
    setDraftUser(emptyUser);
    setEditingUserId(null);
  };

  const reloadUsers = async () => {
    const response = await api.getUsers(session.accessToken, currentPage, USERS_PER_PAGE);
    const usersList = Array.isArray(response) ? response : response.items;
    const pages = Array.isArray(response) ? 1 : Math.max(1, response.meta.totalPages);
    const total = Array.isArray(response) ? response.length : response.meta.totalItems;
    setUsers(usersList);
    setTotalPages(pages);
    setTotalItems(total);
  };

  const buildCreatePayload = (): CreateUserPayload => ({
    ...draftUser,
    firstName: normalizeUpper(draftUser.firstName),
    lastName: normalizeUpper(draftUser.lastName),
    grade: normalizeUpper(draftUser.grade),
    phone: normalizeText(draftUser.phone),
    email: normalizeEmail(draftUser.email),
    password: normalizeText(draftUser.password),
  });

  const buildUpdatePayload = (): UpdateUserPayload => {
    const payload: UpdateUserPayload = {
      firstName: normalizeUpper(draftUser.firstName),
      lastName: normalizeUpper(draftUser.lastName),
      grade: normalizeUpper(draftUser.grade),
      phone: normalizeText(draftUser.phone),
      email: normalizeEmail(draftUser.email),
      role: draftUser.role,
      regionId: draftUser.regionId,
      delegationId: draftUser.delegationId,
    };

    const normalizedPassword = normalizeText(draftUser.password);

    if (normalizedPassword) {
      payload.password = normalizedPassword;
    }

    return payload;
  };

  const validateDraftUser = () => {
    const missingFields = [
      ['Nombre', draftUser.firstName],
      ['Apellido', draftUser.lastName],
      ['Grado', draftUser.grade],
      ['Correo', draftUser.email],
      ['Telefono', draftUser.phone],
    ].filter(([, value]) => !normalizeText(value).length);

    if (missingFields.length > 0) {
      return `Campos obligatorios pendientes: ${missingFields.map(([label]) => label).join(', ')}.`;
    }

    const normalizedPassword = normalizeText(draftUser.password);

    if (!isEditing) {
      if (!normalizedPassword) {
        return 'La contrasena es obligatoria.';
      }
      if (!PASSWORD_POLICY_REGEX.test(normalizedPassword)) {
        return 'La contrasena debe tener al menos 8 caracteres, una mayuscula, una minuscula, un numero y un caracter especial.';
      }
    } else if (normalizedPassword.length > 0) {
      if (!PASSWORD_POLICY_REGEX.test(normalizedPassword)) {
        return 'La contrasena nueva debe tener al menos 8 caracteres, una mayuscula, una minuscula, un numero y un caracter especial.';
      }
    }

    return null;
  };

  return (
    <div className="stack-lg">
      <section className="panel">
        <PageIntro
          eyebrow="Administración"
          title="Usuarios"
          description="Administra usuarios, roles y cobertura operativa del sistema."
          actions={
            <label className="toolbar-search">
              <span>Buscar usuario</span>
              <input
                placeholder="Nombre, correo, región o rol"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
          }
        />

        <StatsGrid
          items={[
            { label: 'Usuarios activos', value: totalItems },
            { label: 'Regiones cargadas', value: regions.length },
            {
              label: 'Delegaciones disponibles',
              value: regions.reduce((total, region) => total + region.delegations.length, 0),
            },
            {
              label: 'Cobertura visible',
              value: `${filteredUsers.length}`,
              helper: 'Usuarios en pantalla',
            },
          ]}
        />
      </section>

      <section className="panel stack-md">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Administración</p>
            <h2>{isEditing ? 'Modificar usuario' : 'Crear usuario'}</h2>
          </div>
          {isEditing && (
            <button className="secondary-button" type="button" onClick={resetForm}>
              Cancelar edición
            </button>
          )}
        </div>

        <div className="form-grid">
          <label className="field">
            <span>Nombre</span>
            <input
              value={draftUser.firstName}
              onChange={(event) =>
                setDraftUser((current) => ({ ...current, firstName: event.target.value }))
              }
            />
          </label>
          <label className="field">
            <span>Apellido</span>
            <input
              value={draftUser.lastName}
              onChange={(event) =>
                setDraftUser((current) => ({ ...current, lastName: event.target.value }))
              }
            />
          </label>
          <label className="field">
            <span>Grado</span>
            <input
              value={draftUser.grade}
              onChange={(event) =>
                setDraftUser((current) => ({ ...current, grade: event.target.value }))
              }
            />
          </label>
          <label className="field">
            <span>Correo</span>
            <input
              value={draftUser.email}
              onChange={(event) =>
                setDraftUser((current) => ({ ...current, email: event.target.value }))
              }
            />
          </label>
          <label className="field">
            <span>{isEditing ? 'Contraseña nueva (opcional)' : 'Contraseña'}</span>
            <input
              type="password"
              value={draftUser.password}
              onChange={(event) =>
                setDraftUser((current) => ({ ...current, password: event.target.value }))
              }
            />
          </label>
          <label className="field">
            <span>Teléfono</span>
            <input
              value={draftUser.phone}
              onChange={(event) =>
                setDraftUser((current) => ({ ...current, phone: event.target.value }))
              }
            />
          </label>
          <label className="field">
            <span>Rol</span>
            <select
              value={draftUser.role}
              disabled={isEditingSelf && isSuperAdmin}
              onChange={(event) =>
                setDraftUser((current) => ({
                  ...current,
                  role: event.target.value as CreateUserPayload['role'],
                }))
              }
            >
              <option value="enlace">Enlace</option>
              <option value="director_operativo">Director Operativo</option>
              <option value="plantilla_vehicular">Admin Plantilla vehicular</option>
              <option value="director_general">Director General</option>
              <option value="superadmin" disabled={!isSuperAdmin}>Superadministrador</option>
              <option value="coordinacion" disabled={!isSuperAdmin}>Coordinación</option>
            </select>
          </label>
          <label className="field">
            <span>Región</span>
            <select
              value={draftUser.regionId ?? ''}
              onChange={(event) =>
                setDraftUser((current) => ({
                  ...current,
                  regionId: event.target.value || undefined,
                  delegationId: undefined,
                }))
              }
            >
              <option value="">Selecciona una región</option>
              {regions.map((region) => (
                <option key={region.id} value={region.id}>
                  {region.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Delegación</span>
            <select
              value={draftUser.delegationId ?? ''}
              onChange={(event) =>
                setDraftUser((current) => ({
                  ...current,
                  delegationId: event.target.value || undefined,
                }))
              }
            >
              <option value="">Selecciona una delegación</option>
              {availableDelegations.map((delegation) => (
                <option key={delegation.id} value={delegation.id}>
                  {delegation.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <button
          className="primary-button"
          type="button"
          onClick={async () => {
            const validationError = validateDraftUser();

            if (validationError) {
              await Swal.fire({
                icon: 'warning',
                title: 'Datos incompletos',
                text: validationError,
                confirmButtonText: 'Entendido',
              });
              return;
            }

            const confirmation = await Swal.fire({
              icon: 'question',
              title: isEditing ? 'Confirmar modificación' : 'Confirmar alta de usuario',
              text: isEditing
                ? 'Se actualizarán los datos del usuario seleccionado.'
                : 'Se creará una nueva cuenta con los datos capturados.',
              showCancelButton: true,
              confirmButtonText: isEditing ? 'Guardar cambios' : 'Crear usuario',
              cancelButtonText: 'Cancelar',
            });

            if (!confirmation.isConfirmed) {
              return;
            }

            try {
              if (isEditing && editingUserId) {
                await api.updateUser(editingUserId, buildUpdatePayload(), session.accessToken);
              } else {
                await api.createUser(buildCreatePayload(), session.accessToken);
              }

              resetForm();
              await reloadUsers();

              await Swal.fire({
                icon: 'success',
                title: isEditing ? 'Usuario actualizado' : 'Usuario creado',
                text: isEditing
                  ? 'Los cambios se guardaron correctamente.'
                  : 'La cuenta se registró correctamente.',
                confirmButtonText: 'Entendido',
              });
            } catch (requestError) {
              await Swal.fire({
                icon: 'error',
                title: isEditing ? 'No se pudo actualizar el usuario' : 'No se pudo crear el usuario',
                text: (requestError as Error).message,
                confirmButtonText: 'Entendido',
              });
            }
          }}
        >
          {isEditing ? 'Guardar cambios' : 'Guardar usuario'}
        </button>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Usuarios</p>
            <h2>Listado actual</h2>
          </div>
          <div className="panel-meta">{filteredUsers.length} visibles</div>
        </div>

        {filteredUsers.length === 0 ? (
          <EmptyState
            title="No hay usuarios que coincidan"
            description="Ajusta la búsqueda o crea una nueva cuenta operativa."
          />
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Grado</th>
                  <th>Correo</th>
                  <th>Teléfono</th>
                  <th>Región</th>
                  <th>Delegación</th>
                  <th>Rol</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => {
                  const isPrivileged =
                    user.role === 'superadmin' || user.role === 'coordinacion';
                  const canManageUser = !isPrivileged || isSuperAdmin;
                  const canDeleteUser = canManageUser && user.id !== session.user.id;

                  return (
                  <tr key={user.id}>
                    <td>{user.fullName}</td>
                    <td>{user.grade}</td>
                    <td>{user.email}</td>
                    <td>{user.phone}</td>
                    <td>{user.region?.name ?? '-'}</td>
                    <td>{user.delegation?.name ?? '-'}</td>
                    <td>{user.role}</td>
                    <td>
                      <div className="table-actions">
                        <button
                          className="primary-button"
                          type="button"
                          disabled={!canManageUser}
                          onClick={() => {
                            const resolvedRegionId =
                              user.region?.id ??
                              regions.find((region) =>
                                region.delegations.some(
                                  (delegation) => delegation.id === user.delegation?.id,
                                ),
                              )?.id;

                            setEditingUserId(user.id);
                            setDraftUser({
                              firstName: user.firstName,
                              lastName: user.lastName,
                              grade: user.grade,
                              email: user.email,
                              password: '',
                              role: user.role,
                              phone: user.phone,
                              regionId: resolvedRegionId,
                              delegationId: user.delegation?.id,
                            });
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }}
                        >
                          Editar
                        </button>
                        <button
                          className="secondary-button table-action-button"
                          type="button"
                          disabled={!canDeleteUser}
                          onClick={async () => {
                            const confirmation = await Swal.fire({
                              icon: 'warning',
                              title: 'Eliminar usuario',
                              text: `Se eliminará la cuenta de ${user.fullName}.`,
                              showCancelButton: true,
                              confirmButtonText: 'Eliminar',
                              cancelButtonText: 'Cancelar',
                            });

                            if (!confirmation.isConfirmed) {
                              return;
                            }

                            try {
                              await api.deleteUser(user.id, session.accessToken);

                              setUsers((current) => current.filter((currentUser) => currentUser.id !== user.id));
                              setTotalItems((current) => Math.max(0, current - 1));

                              if (editingUserId === user.id) {
                                resetForm();
                              }

                              await reloadUsers();

                              await Swal.fire({
                                icon: 'success',
                                title: 'Usuario eliminado',
                                text: 'La cuenta fue dada de baja correctamente.',
                                confirmButtonText: 'Entendido',
                              });
                            } catch (requestError) {
                              await Swal.fire({
                                icon: 'error',
                                title: 'No se pudo eliminar el usuario',
                                text: (requestError as Error).message,
                                confirmButtonText: 'Entendido',
                              });
                            }
                          }}
                        >
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {totalPages > 1 && (
        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Paginación</p>
              <h2>Usuarios</h2>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <button
              className="secondary-button"
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            >
              Anterior
            </button>
            <span>Página {currentPage} de {totalPages}</span>
            <button
              className="secondary-button"
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            >
              Siguiente
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

