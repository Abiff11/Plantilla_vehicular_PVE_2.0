import './lib/browser-request-defaults';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import 'leaflet/dist/leaflet.css';
import { App } from './App';
import { ErrorBoundary } from './components/error-boundary';
import { AuthProvider } from './modules/auth/auth-context';
import './styles.css';
import './vehicle-edit.css';

const basePath = (import.meta.env.VITE_BASE_PATH ?? '/')
  .trim()
  .replace(/\/$/, '') || '/';

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
