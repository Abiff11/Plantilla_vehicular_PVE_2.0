import { useEffect, useState } from 'react';
import { EmptyState } from '../components/empty-state';
import { PageIntro } from '../components/page-intro';
import { StatsGrid } from '../components/stats-grid';
import { formatDateTimeMx, formatTimeMx } from '../lib/date-format';
import { api } from '../lib/api';
import { formatUserName } from '../lib/format-user-name';
import { socket } from '../lib/socket';
import { useAuth } from '../modules/auth/auth-context';
import type { AuditLog } from '../types';

export function CoordinacionAuditPage() {
  const { session } = useAuth();
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const LOGS_PER_PAGE = 100;

  useEffect(() => {
    if (!session) {
      return;
    }

    const loadAuditLogs = async () => {
      const response = await api.getAuditLogs(session.accessToken, currentPage, LOGS_PER_PAGE);
      const logsList = Array.isArray(response) ? response : response.items;
      const pages = Array.isArray(response) ? 1 : Math.max(1, response.meta.totalPages);
      const total = Array.isArray(response) ? response.length : response.meta.totalItems;
      setAuditLogs(logsList);
      setTotalPages(pages);
      setTotalItems(total);
    };

    void loadAuditLogs();
    socket.on('audit.created', loadAuditLogs);

    return () => {
      socket.off('audit.created', loadAuditLogs);
    };
  }, [session, currentPage]);

  if (!session) {
    return null;
  }

  return (
    <div className="stack-lg">
      <section className="panel">
        <PageIntro
          eyebrow="Auditoría"
          title="Bitácora"
          description="Consulta movimientos críticos y actividad registrada en el sistema."
        />

        <StatsGrid
          items={[
            { label: 'Eventos registrados', value: totalItems },
            {
              label: 'Último movimiento',
              value: auditLogs[0] ? formatTimeMx(auditLogs[0].createdAt) : '-',
              helper: auditLogs[0]?.action ?? 'Sin actividad',
            },
            {
              label: 'Último actor',
              value: auditLogs[0]?.actor ? formatUserName(auditLogs[0].actor) : 'Sistema',
            },
            {
              label: 'Entidad reciente',
              value: auditLogs[0]?.entityType ?? '-',
            },
          ]}
        />
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Seguimiento</p>
            <h2>Actividad reciente</h2>
          </div>
          <div className="panel-meta">{auditLogs.length} eventos</div>
        </div>

        {auditLogs.length === 0 ? (
          <EmptyState
            title="No hay eventos en la bitácora"
            description="La actividad crítica aparecerá aquí en cuanto el sistema registre movimientos."
          />
        ) : (
          <div className="activity-list">
            {auditLogs.map((auditLog) => (
              <article className="activity-item" key={auditLog.id}>
                <div className="activity-item-head">
                  <strong>{auditLog.action}</strong>
                  <span>{formatDateTimeMx(auditLog.createdAt)}</span>
                </div>
                <p>{auditLog.actor ? formatUserName(auditLog.actor) : 'Sistema'}</p>
                <span>
                  {auditLog.entityType} #{auditLog.entityId}
                </span>
              </article>
            ))}
          </div>
        )}
      </section>

      {totalPages > 1 && (
        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Paginación</p>
              <h2>Bitácora</h2>
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


