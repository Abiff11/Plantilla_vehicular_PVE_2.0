import { io } from 'socket.io-client';
import { resolveConfiguredNetworkUrl } from './resolve-network-url';

const SOCKET_DEBUG_ENABLED = import.meta.env.VITE_SOCKET_DEBUG === 'true';

function socketDebugLog(event: string, payload?: Record<string, unknown>) {
  if (!SOCKET_DEBUG_ENABLED) {
    return;
  }

  if (payload) {
    console.info(`[socket] ${event}`, payload);
    return;
  }

  console.info(`[socket] ${event}`);
}

function resolveApiBaseUrl() {
  const configuredApiUrl = resolveConfiguredNetworkUrl(import.meta.env.VITE_API_URL, '/api');

  if (configuredApiUrl) {
    const apiBaseUrl = configuredApiUrl.replace(/\/api$/, '');

    if (apiBaseUrl) {
      return apiBaseUrl;
    }

    return typeof window === 'undefined' ? '' : window.location.origin;
  }

  return null;
}

function resolveHealthUrl() {
  const configuredApiUrl = resolveConfiguredNetworkUrl(import.meta.env.VITE_API_URL, '/api');

  if (configuredApiUrl) {
    return `${configuredApiUrl}/health`;
  }

  if (typeof window === 'undefined') {
    return 'http://localhost:3101/api/health';
  }

  return `${window.location.origin}/api/health`;
}

function normalizeSocketPath(value: string | undefined) {
  const configuredPath = value?.trim();

  if (configuredPath) {
    const withLeadingSlash = configuredPath.startsWith('/') ? configuredPath : `/${configuredPath}`;
    return withLeadingSlash.replace(/\/$/, '');
  }

  const basePath = import.meta.env.VITE_BASE_PATH?.trim() || '/';
  const normalizedBasePath = basePath.startsWith('/') ? basePath : `/${basePath}`;
  const withoutTrailingSlash = normalizedBasePath.replace(/\/$/, '');
  return `${withoutTrailingSlash || ''}/socket.io`;
}

function resolveSocketUrl() {
  const configuredSocketUrl = resolveConfiguredNetworkUrl(import.meta.env.VITE_SOCKET_URL, '/');

  if (configuredSocketUrl) {
    if (configuredSocketUrl.startsWith('/')) {
      return typeof window === 'undefined' ? configuredSocketUrl : window.location.origin;
    }

    return configuredSocketUrl;
  }

  const apiBaseUrl = resolveApiBaseUrl();

  if (apiBaseUrl) {
    if (apiBaseUrl.startsWith('/')) {
      return typeof window === 'undefined' ? apiBaseUrl : window.location.origin;
    }

    return apiBaseUrl;
  }

  if (typeof window === 'undefined') {
    return 'http://localhost:3101';
  }

  return window.location.origin;
}

const SOCKET_URL = resolveSocketUrl();
const SOCKET_PATH = normalizeSocketPath(import.meta.env.VITE_SOCKET_PATH);
const HEALTH_URL = resolveHealthUrl();
export const socket = io(SOCKET_URL, {
  path: SOCKET_PATH,
  autoConnect: false,
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  transports: ['websocket', 'polling'],
  withCredentials: true,
});

let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 3;
let backendAvailabilityPromise: Promise<boolean> | null = null;

async function canReachBackend() {
  if (!backendAvailabilityPromise) {
    backendAvailabilityPromise = (async () => {
      try {
        const controller = new AbortController();
        const timeoutId = window.setTimeout(() => controller.abort(), 1500);

        try {
          const response = await fetch(HEALTH_URL, {
            method: 'GET',
            cache: 'no-store',
            signal: controller.signal,
          });

          return response.ok;
        } finally {
          window.clearTimeout(timeoutId);
        }
      } catch {
        return false;
      }
    })();
  }

  return backendAvailabilityPromise;
}

socket.on('connect', () => {
  reconnectAttempts = 0;
  socketDebugLog('connect', {
    socketId: socket.id,
    transport: socket.io.engine.transport.name,
    url: SOCKET_URL,
  });
});

socket.on('disconnect', (reason) => {
  reconnectAttempts = 0;
  socketDebugLog('disconnect', { reason });
});

socket.on('connect_error', async (error) => {
  socketDebugLog('connect_error', {
    message: error.message,
    attempt: reconnectAttempts + 1,
    url: SOCKET_URL,
    path: SOCKET_PATH,
  });

  if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    return;
  }

  reconnectAttempts += 1;

  const backendReachable = await canReachBackend();

  if (backendReachable && !socket.connected) {
    socket.connect();
  }
});

export async function connectSocket() {
  const backendReachable = await canReachBackend();

  if (backendReachable && !socket.connected) {
    socket.connect();
  }
}

export function disconnectSocket() {
  if (socket.connected) {
    socket.disconnect();
  }
}

export function resetSocketReconnectAttempts() {
  reconnectAttempts = 0;
  backendAvailabilityPromise = null;
}
