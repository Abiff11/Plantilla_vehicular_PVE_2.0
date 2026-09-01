import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageIntro } from '../components/page-intro';
import { StatsGrid } from '../components/stats-grid';
import { api } from '../lib/api';
import { formatUserName } from '../lib/format-user-name';
import { APP_ROUTES } from '../lib/routes';
import { useAuth } from '../modules/auth/auth-context';
import type { Role, VehicleRecord } from '../types';

type QuickAction = {
  label: string;
  to: string;
  helper: string;
};

const roleDescriptions: Record<Role, string> = {
  enlace: 'Captura y confirma la plantilla vehicular vigente de tu delegación.',
  director_operativo:
    'Supervisa las delegaciones de tu región y consulta el cierre mensual regional.',
  plantilla_vehicular:
    'Captura unidades, consulta la operación vehicular general y da seguimiento mensual a las regiones.',
  director_general:
    'Consulta indicadores directivos, mapa operativo y validaciones mensuales.',
  superadmin:
    'Administra usuarios, bitácora, captura unidades y supervisa la operación general del sistema.',
  coordinacion:
    'Administra usuarios, bitácora y da seguimiento operativo general.',
};

const quickActions: Record<Role, QuickAction[]> = {
  enlace: [
    {
      label: 'Capturar vehículo',
      to: APP_ROUTES.workspace,
      helper: 'Registrar unidad vehicular',
    },
    {
      label: 'Mi plantilla vehicular',
      to: APP_ROUTES.archive,
      helper: 'Consultar, editar, trasladar y confirmar plantilla',
    },
  ],
  director_operativo: [
    {
      label: 'Delegaciones',
      to: APP_ROUTES.monitor,
      helper: 'Supervisión vehicular de tu región',
    },
    {
      label: 'Seguimiento regional',
      to: APP_ROUTES.reportsDelegations,
      helper: 'Consultar estado mensual regional',
    },
  ],
  plantilla_vehicular: [
    {
      label: 'Capturar vehículo',
      to: APP_ROUTES.superadminCapture,
      helper: 'Registrar unidad y asignar región y delegación',
    },
    {
      label: 'Vista general',
      to: APP_ROUTES.overview,
      helper: 'Operación vehicular general',
    },
    {
      label: 'Reportes regionales',
      to: APP_ROUTES.reportsRegional,
      helper: 'Validación mensual por región',
    },
    {
      label: 'Dashboard directivo',
      to: APP_ROUTES.insights,
      helper: 'Indicadores globales',
    },
    {
      label: 'Mapa directivo',
      to: APP_ROUTES.insightsMap,
      helper: 'Distribución territorial',
    },
  ],
  director_general: [
    {
      label: 'Reportes regionales',
      to: APP_ROUTES.reportsRegional,
      helper: 'Validación mensual por región',
    },
    {
      label: 'Dashboard directivo',
      to: APP_ROUTES.insights,
      helper: 'Indicadores globales',
    },
    {
      label: 'Mapa directivo',
      to: APP_ROUTES.insightsMap,
      helper: 'Distribución territorial',
    },
  ],
  superadmin: [
    {
      label: 'Capturar vehículo',
      to: APP_ROUTES.superadminCapture,
      helper: 'Registrar unidad y asignar delegación',
    },
    {
      label: 'Vista general',
      to: APP_ROUTES.overview,
      helper: 'Operación vehicular general',
    },
    {
      label: 'Reportes regionales',
      to: APP_ROUTES.reportsRegional,
      helper: 'Validación mensual por región',
    },
    {
      label: 'Dashboard directivo',
      to: APP_ROUTES.insights,
      helper: 'Indicadores globales',
    },
    {
      label: 'Mapa directivo',
      to: APP_ROUTES.insightsMap,
      helper: 'Distribución territorial',
    },
    {
      label: 'Usuarios',
      to: APP_ROUTES.control,
      helper: 'Administración de accesos',
    },
    {
      label: 'Bitácora',
      to: APP_ROUTES.controlActivity,
      helper: 'Auditoría de actividad',
    },
  ],
  coordinacion: [
    {
      label: 'Vista general',
      to: APP_ROUTES.overview,
      helper: 'Operación vehicular general',
    },
    {
      label: 'Reportes regionales',
      to: APP_ROUTES.reportsRegional,
      helper: 'Validación mensual por región',
    },
    {
      label: 'Dashboard directivo',
      to: APP_ROUTES.insights,
      helper: 'Indicadores globales',
    },
    {
      label: 'Mapa directivo',
      to: APP_ROUTES.insightsMap,
      helper: 'Distribución territorial',
    },
    {
      label: 'Usuarios',
      to: APP_ROUTES.control,
      helper: 'Administración de accesos',
    },
    {
      label: 'Bitácora',
      to: APP_ROUTES.controlActivity,
      helper: 'Auditoría de actividad',
    },
  ],
};

export function HomePage() {
  const { session } = useAuth();
  const [records, setRecords] = useState<VehicleRecord[]>([]);

  useEffect(() => {
    if (!session || session.user.role !== 'enlace') {
      return;
    }

    void api.getMyRecords(session.accessToken).then(setRecords);
  }, [session]);

  const monthCaptures = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    return records.filter((record) => {
      const createdAt = new Date(record.createdAt);
      return (
        createdAt.getMonth() === currentMonth &&
        createdAt.getFullYear() === currentYear
      );
    }).length;
  }, [records]);

  const statusBreakdown = useMemo(() => {
    return records.reduce<Record<string, number>>((totals, record) => {
      totals[record.status] = (totals[record.status] ?? 0) + 1;
      return totals;
    }, {});
  }, [records]);

  const topStatus = Object.entries(statusBreakdown).sort(
    (left, right) => right[1] - left[1],
  )[0];

  if (!session) {
    return null;
  }

  const latestRecord = records[0];
  const actions = quickActions[session.user.role];

  return (
    <div className="stack-lg">
      <section className="panel">
        <PageIntro
          eyebrow="Bienvenido"
          title={formatUserName(session.user)}
          description={roleDescriptions[session.user.role]}
        />

        <StatsGrid
          items={[
            { label: 'Rol actual', value: session.user.role },
            { label: 'Grado', value: session.user.grade },
            { label: 'Región', value: session.user.region?.name ?? '-' },
            { label: 'Delegación', value: session.user.delegation?.name ?? '-' },
          ]}
        />
      </section>

      {session.user.role === 'enlace' && (
        <section className="quick-grid">
          <article className="quick-card">
            <span className="quick-card-label">Capturas totales</span>
            <strong>{records.length}</strong>
            <p>Capturas totales registradas por tu usuario.</p>
          </article>
          <article className="quick-card">
            <span className="quick-card-label">Capturas del mes</span>
            <strong>{monthCaptures}</strong>
            <p>Capturas realizadas durante el mes actual.</p>
          </article>
          <article className="quick-card">
            <span className="quick-card-label">Última placa capturada</span>
            <strong>{latestRecord ? latestRecord.plates : '-'}</strong>
            <p>Última placa capturada en tu historial.</p>
          </article>
          <article className="quick-card">
            <span className="quick-card-label">Estatus dominante</span>
            <strong>{topStatus ? topStatus[0] : '-'}</strong>
            <p>
              {topStatus
                ? `${topStatus[1]} capturas con ese estatus.`
                : 'Sin capturas aún.'}
            </p>
          </article>
        </section>
      )}

      <section className="quick-grid">
        {actions.map((action) => (
          <Link className="quick-card" key={action.to} to={action.to}>
            <span className="quick-card-label">Acceso rápido</span>
            <strong>{action.label}</strong>
            <p>{action.helper}</p>
          </Link>
        ))}
      </section>
    </div>
  );
}
