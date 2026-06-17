import { useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { formatUserName } from "../lib/format-user-name";
import { api } from "../lib/api";
import { APP_ROUTES } from "../lib/routes";
import { socket } from "../lib/socket";
import { useAuth } from "../modules/auth/auth-context";
import { MessageNotification } from "../modules/messages/components/MessageNotification";
import { MessengerPanel } from "../modules/messages/components/MessengerPanel";
import { MESSENGER_ROLES, ROUTE_ROLES, hasAnyRole } from "../lib/role-access";
import type { Message } from "../types";

const roleLabels = {
  enlace: "Enlace",
  director_operativo: "Director Operativo",
  plantilla_vehicular: "Admin Plantilla vehicular",
  director_general: "Director General",
  superadmin: "Superadministrador",
  coordinacion: "Coordinación",
};

const pageTitles: Record<string, { title: string; description: string }> = {
  [APP_ROUTES.home]: {
    title: "Inicio",
    description:
      "Consulta tus accesos principales y el resumen correspondiente a tu rol.",
  },
  [APP_ROUTES.workspace]: {
    title: "Captura vehicular",
    description: "Registra unidades vehiculares desde tu delegación asignada.",
  },
  [APP_ROUTES.archive]: {
    title: "Mi plantilla vehicular",
    description:
      "Consulta, edita, traslada y confirma la plantilla vigente de tu delegación.",
  },
  [APP_ROUTES.monitor]: {
    title: "Supervisión regional",
    description:
      "Consulta las unidades vehiculares registradas por las delegaciones de tu región.",
  },
  [APP_ROUTES.overview]: {
    title: "Vista general vehicular",
    description:
      "Consulta la operación vehicular general organizada por región y delegación.",
  },
  [APP_ROUTES.vehicleImports]: {
    title: "Importar Excel",
    description:
      "Carga y valida la plantilla vehicular institucional desde archivo Excel.",
  },
  [APP_ROUTES.insights]: {
    title: "Dashboard directivo",
    description:
      "Consulta indicadores globales de la plantilla vehicular.",
  },
  [APP_ROUTES.insightsMap]: {
    title: "Mapa directivo",
    description:
      "Explora la distribución territorial de la plantilla vehicular.",
  },
  [APP_ROUTES.control]: {
    title: "Usuarios",
    description:
      "Administra accesos, roles y cobertura operativa del sistema.",
  },
  [APP_ROUTES.catalogs]: {
    title: "Catálogos",
    description:
      "Administra valores vehiculares, equivalencias e insumos para importación.",
  },
  [APP_ROUTES.controlActivity]: {
    title: "Bitácora",
    description:
      "Consulta movimientos críticos y actividad registrada en el sistema.",
  },
  [APP_ROUTES.reportsRegional]: {
    title: "Validación mensual",
    description: "Administra y confirma el cierre mensual por región.",
  },
  [APP_ROUTES.reportsDelegations]: {
    title: "Seguimiento regional",
    description: "Consulta el estado mensual de las delegaciones bajo tu región.",
  },
};

type SidebarItem = {
  label: string;
  route: string;
  allowedRoles: (typeof ROUTE_ROLES)[keyof typeof ROUTE_ROLES];
  end?: boolean;
};

type SidebarSection = {
  title: string;
  items: SidebarItem[];
};

const sidebarSections: SidebarSection[] = [
  {
    title: "Operación vehicular",
    items: [
      {
        label: "Capturar vehículo",
        route: APP_ROUTES.workspace,
        allowedRoles: ROUTE_ROLES.workspace,
        end: true,
      },
      {
        label: "Mi plantilla vehicular",
        route: APP_ROUTES.archive,
        allowedRoles: ROUTE_ROLES.archive,
      },
      {
        label: "Vista general vehicular",
        route: APP_ROUTES.overview,
        allowedRoles: ROUTE_ROLES.overview,
        end: true,
      },
    ],
  },
  {
    title: "Supervisión regional",
    items: [
      {
        label: "Delegaciones",
        route: APP_ROUTES.monitor,
        allowedRoles: ROUTE_ROLES.monitor,
        end: true,
      },
    ],
  },
  {
    title: "Validaciones mensuales",
    items: [
      {
        label: "Seguimiento regional",
        route: APP_ROUTES.reportsDelegations,
        allowedRoles: ROUTE_ROLES.reportsDelegations,
        end: true,
      },
      {
        label: "Validación mensual",
        route: APP_ROUTES.reportsRegional,
        allowedRoles: ROUTE_ROLES.reportsRegional,
        end: true,
      },
    ],
  },
  {
    title: "Dirección",
    items: [
      {
        label: "Dashboard directivo",
        route: APP_ROUTES.insights,
        allowedRoles: ROUTE_ROLES.insights,
        end: true,
      },
      {
        label: "Mapa directivo",
        route: APP_ROUTES.insightsMap,
        allowedRoles: ROUTE_ROLES.insightsMap,
        end: true,
      },
    ],
  },
  {
    title: "Administración",
    items: [
      {
        label: "Usuarios",
        route: APP_ROUTES.control,
        allowedRoles: ROUTE_ROLES.control,
        end: true,
      },
      {
        label: "Catálogos",
        route: APP_ROUTES.catalogs,
        allowedRoles: ROUTE_ROLES.catalogs,
        end: true,
      },
      {
        label: "Importar Excel",
        route: APP_ROUTES.vehicleImports,
        allowedRoles: ROUTE_ROLES.vehicleImports,
        end: true,
      },
      {
        label: "Bitácora",
        route: APP_ROUTES.controlActivity,
        allowedRoles: ROUTE_ROLES.controlActivity,
      },
    ],
  },
];

function getVisibleSidebarSections(userRole: keyof typeof roleLabels) {
  return sidebarSections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) =>
        hasAnyRole(userRole, item.allowedRoles),
      ),
    }))
    .filter((section) => section.items.length > 0);
}

export function AppShell() {
  const { session, logoutWithApi } = useAuth();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isMessengerOpen, setIsMessengerOpen] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState(0);

  const canUseMessenger = session
    ? hasAnyRole(session.user.role, MESSENGER_ROLES)
    : false;

  const currentPage =
    pageTitles[location.pathname] ?? pageTitles[APP_ROUTES.home];

  useEffect(() => {
    if (!session || !canUseMessenger) {
      setUnreadMessages(0);
      return;
    }

    const loadUnreadMessages = async () => {
      try {
        const conversations = await api.getConversations(session.accessToken);
        const totalUnread = conversations.reduce(
          (total, conversation) => total + (conversation.unreadCount ?? 0),
          0,
        );
        setUnreadMessages(totalUnread);
      } catch {
        setUnreadMessages(0);
      }
    };

    const handleNewMessage = (message: Message) => {
      if (message.sender.id === session.user.id) {
        return;
      }

      setUnreadMessages((current) => current + 1);
    };

    const handleConversationUpdated = () => {
      void loadUnreadMessages();
    };

    const handleConversationRead = () => {
      void loadUnreadMessages();
    };

    void loadUnreadMessages();

    socket.on("messages:new", handleNewMessage);
    socket.on("conversations:updated", handleConversationUpdated);
    socket.on("conversations:read", handleConversationRead);

    return () => {
      socket.off("messages:new", handleNewMessage);
      socket.off("conversations:updated", handleConversationUpdated);
      socket.off("conversations:read", handleConversationRead);
    };
  }, [canUseMessenger, session]);

  const unreadIndicator = useMemo(() => {
    if (unreadMessages <= 0) {
      return null;
    }

    return unreadMessages > 99 ? "99+" : String(unreadMessages);
  }, [unreadMessages]);

  if (!session) {
    return null;
  }

  return (
    <div className="dashboard-shell">
      <aside
        className={`sidebar ${isSidebarOpen ? "is-open" : "is-collapsed"}`}
        onMouseEnter={() => setIsSidebarOpen(true)}
        onMouseLeave={() => setIsSidebarOpen(false)}
        onFocusCapture={() => setIsSidebarOpen(true)}
        onBlur={(event) => {
          if (
            !event.currentTarget.contains(event.relatedTarget as Node | null)
          ) {
            setIsSidebarOpen(false);
          }
        }}
      >
        <button
          aria-expanded={isSidebarOpen}
          aria-label={
            isSidebarOpen ? "Ocultar navegación" : "Mostrar navegación"
          }
          className="sidebar-toggle"
          type="button"
          onClick={() => setIsSidebarOpen((current) => !current)}
        >
          <span />
          <span />
          <span />
        </button>

        <div className="sidebar-panel">
          <div className="sidebar-brand">
            <div className="brand-logo-wrap sidebar-logo-wrap">
              <img
                className="institutional-logo sidebar-logo"
                src={`${import.meta.env.BASE_URL}policia-vial-estatal-oaxaca-seeklogo.png`}
                alt="Policía Vial Estatal de Oaxaca"
              />
            </div>

            <div className="sidebar-title-wrap">
              <p className="eyebrow">Sistema vehicular</p>
              <h1 className="sidebar-title">{roleLabels[session.user.role]}</h1>
              <p className="sidebar-subtitle">{formatUserName(session.user)}</p>
            </div>
          </div>

          <div className="sidebar-session-card">
            <span className="sidebar-session-label">Cobertura</span>
            <strong>
              {session.user.region?.name ??
                session.user.delegation?.name ??
                "General"}
            </strong>
            <span>{session.user.grade}</span>
          </div>

          <nav className="sidebar-filters nav-list">
            <NavLink end to={APP_ROUTES.home}>
              Inicio
            </NavLink>

            {getVisibleSidebarSections(session.user.role).map((section) => (
              <div className="sidebar-nav-section" key={section.title}>
                <span className="sidebar-nav-section-title">
                  {section.title}
                </span>

                {section.items.map((item) => (
                  <NavLink end={item.end} key={item.route} to={item.route}>
                    {item.label}
                  </NavLink>
                ))}
              </div>
            ))}
          </nav>

          <div className="sidebar-footer">
            <button
              className="secondary-button"
              type="button"
              onClick={logoutWithApi}
            >
              Cerrar sesión
            </button>
          </div>
        </div>
      </aside>

      <main className="main-stage">
        <header className="main-header">
          <div className="page-title-block">
            <h1>{currentPage.title}</h1>
            <p>{currentPage.description}</p>
          </div>
          <div className="header-actions">
            {canUseMessenger && (
              <button
                className="messenger-toggle-btn"
                type="button"
                onClick={() => setIsMessengerOpen((prev) => !prev)}
                title="Mensajero"
                style={{ position: "relative" }}
              >
                Mensajes
                {unreadIndicator && (
                  <span
                    style={{
                      position: "absolute",
                      top: "-0.4rem",
                      right: "-0.4rem",
                      minWidth: "1.2rem",
                      height: "1.2rem",
                      padding: "0 0.25rem",
                      borderRadius: "999px",
                      background: "#dc2626",
                      color: "#fff",
                      fontSize: "0.75rem",
                      lineHeight: "1.2rem",
                      fontWeight: 700,
                      textAlign: "center",
                      boxShadow: "0 0 0 2px #111827",
                    }}
                  >
                    {unreadIndicator}
                  </span>
                )}
              </button>
            )}
            <div className="live-pill">
              <span className="live-dot" />
              Sesión activa
            </div>
          </div>
        </header>

        <section className="content-section">
          <Outlet />
        </section>
      </main>

      {canUseMessenger && isMessengerOpen && (
        <div
          className="messenger-overlay"
          onClick={() => setIsMessengerOpen(false)}
        >
          <div
            className="messenger-float-panel"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="messenger-close-btn"
              type="button"
              onClick={() => setIsMessengerOpen(false)}
            >
              ×
            </button>
            <MessengerPanel />
          </div>
        </div>
      )}

      {canUseMessenger && <MessageNotification />}
    </div>
  );
}
