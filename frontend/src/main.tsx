import './lib/browser-request-defaults';
import './lib/sweetalert-fetch-errors';
import './lib/vehicle-kardex-photo-lightbox';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import 'leaflet/dist/leaflet.css';
import { App } from './App';
import { ErrorBoundary } from './components/error-boundary';
import { AuthProvider } from './modules/auth/auth-context';
import './styles.css';
import './vehicle-details.css';
import './vehicle-edit.css';

function normalizeBasePath(value: string | undefined) {
  const rawValue = value?.trim() || '/';
  const withLeadingSlash = rawValue.startsWith('/') ? rawValue : `/${rawValue}`;
  return withLeadingSlash.replace(/\/$/, '') || '/';
}

const basePath = normalizeBasePath(import.meta.env.VITE_BASE_PATH);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter basename={basePath}>
      <ErrorBoundary>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ErrorBoundary>
    </BrowserRouter>
  </React.StrictMode>,
);