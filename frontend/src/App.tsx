import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/app-shell";
import { ProtectedRoute } from "./components/protected-route";
import { HomePage } from "./pages/home-page";
import { LoginPage } from "./pages/login-page";
import { EnlacePage } from "./pages/enlace-page";
import { EnlaceRecordsPage } from "./pages/enlace-records-page";
import { PlantillaVehicularPage } from "./pages/plantilla-vehicular-page";
import { CoordinacionPage } from "./pages/coordinacion-page";
import { CoordinacionAuditPage } from "./pages/coordinacion-audit-page";
import { DirectorGeneralPage } from "./pages/director-general-page";
import { DirectorGeneralMapPage } from "./pages/director-general-map-page";
import { DirectorOperativoPage } from "./pages/director-operativo-page";
import { CatalogsPage } from "./pages/catalogs-page";
import { VehicleImportPage } from "./pages/vehicle-import-page";
import { VehicleReportsPage } from "./pages/vehicle-reports-page";
import { APP_ROUTES, LEGACY_ROUTE_REDIRECTS } from "./lib/routes";
import { ALL_ROLES, ROUTE_ROLES } from "./lib/role-access";
import { PlantillaReportesPage } from "./pages/plantilla-reportes-page";
import { DirectorOperativoReportesPage } from "./pages/director-operativo-reportes-page";

export function App() {
  return (
    <Routes>
      <Route path={APP_ROUTES.access} element={<LoginPage />} />
      <Route
        path={APP_ROUTES.home}
        element={
          <ProtectedRoute allowedRoles={ALL_ROLES}>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route index element={<HomePage />} />
        <Route
          path={APP_ROUTES.workspace.slice(1)}
          element={
            <ProtectedRoute allowedRoles={ROUTE_ROLES.workspace}>
              <EnlacePage />
            </ProtectedRoute>
          }
        />
        <Route
          path={APP_ROUTES.archive.slice(1)}
          element={
            <ProtectedRoute allowedRoles={ROUTE_ROLES.archive}>
              <EnlaceRecordsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path={APP_ROUTES.monitor.slice(1)}
          element={
            <ProtectedRoute allowedRoles={ROUTE_ROLES.monitor}>
              <DirectorOperativoPage />
            </ProtectedRoute>
          }
        />
        <Route
          path={APP_ROUTES.overview.slice(1)}
          element={
            <ProtectedRoute allowedRoles={ROUTE_ROLES.overview}>
              <PlantillaVehicularPage />
            </ProtectedRoute>
          }
        />
        <Route
          path={APP_ROUTES.vehicleImports.slice(1)}
          element={
            <ProtectedRoute allowedRoles={ROUTE_ROLES.vehicleImports}>
              <VehicleImportPage />
            </ProtectedRoute>
          }
        />
        <Route
          path={APP_ROUTES.vehicleReports.slice(1)}
          element={
            <ProtectedRoute allowedRoles={ROUTE_ROLES.overview}>
              <VehicleReportsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path={APP_ROUTES.reportsDelegations.slice(1)}
          element={
            <ProtectedRoute allowedRoles={ROUTE_ROLES.reportsDelegations}>
              <DirectorOperativoReportesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path={APP_ROUTES.reportsRegional.slice(1)}
          element={
            <ProtectedRoute allowedRoles={ROUTE_ROLES.reportsRegional}>
              <PlantillaReportesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path={APP_ROUTES.control.slice(1)}
          element={
            <ProtectedRoute allowedRoles={ROUTE_ROLES.control}>
              <CoordinacionPage />
            </ProtectedRoute>
          }
        />
        <Route
          path={APP_ROUTES.catalogs.slice(1)}
          element={
            <ProtectedRoute allowedRoles={ROUTE_ROLES.catalogs}>
              <CatalogsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path={APP_ROUTES.insights.slice(1)}
          element={
            <ProtectedRoute allowedRoles={ROUTE_ROLES.insights}>
              <DirectorGeneralPage />
            </ProtectedRoute>
          }
        />
        <Route
          path={APP_ROUTES.insightsMap.slice(1)}
          element={
            <ProtectedRoute allowedRoles={ROUTE_ROLES.insightsMap}>
              <DirectorGeneralMapPage />
            </ProtectedRoute>
          }
        />
        <Route
          path={APP_ROUTES.controlActivity.slice(1)}
          element={
            <ProtectedRoute allowedRoles={ROUTE_ROLES.controlActivity}>
              <CoordinacionAuditPage />
            </ProtectedRoute>
          }
        />
      </Route>
      {LEGACY_ROUTE_REDIRECTS.map((redirect) => (
        <Route
          key={redirect.from}
          path={redirect.from}
          element={<Navigate to={redirect.to} replace />}
        />
      ))}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
