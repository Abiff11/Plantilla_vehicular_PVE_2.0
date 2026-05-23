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
    return configuredApiUrl.replace(/\/api$/, '');
  }

  return null;
}

function resolveSocketUrl() {
  const configuredSocketUrl = resolveConfiguredNetworkUrl(import.meta.env.VITE_SOCKET_URL, '/');

  if (configuredSocketUrl && configuredSocketUrl !== '/') {
    return configuredSocketUrl;
  }

  const apiBaseUrl = resolveApiBaseUrl();

  if (apiBaseUrl) {
    return apiBaseUrl;
  }

  if (typeof window === 'undefined') {
    return 'http://localhost:3101';
  }

  const { protocol, hostname } = window.location;
  return `${protocol}//${hostname}:3101`;
}

const SOCKET_URL = resolveSocketUrl();
export const socket = io(SOCKET_URL, {
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

socket.on('connect_error', (error) => {
  if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
    reconnectAttempts += 1;
  }

  socketDebugLog('connect_error', {
    message: error.message,
    attempts: reconnectAttempts,
    url: SOCKET_URL,
  });
});

export function connectSocket() {
  if (socket.connected) {
    socketDebugLog('connect_skip_already_connected');
    return;
  }

  if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    reconnectAttempts = 0;
  }

  socketDebugLog('connect_attempt', { url: SOCKET_URL });
  socket.connect();
}

export function disconnectSocket() {
  reconnectAttempts = 0;
  socket.auth = {};
  socketDebugLog('disconnect_manual');
  socket.disconnect();
}

export function resetSocketReconnectAttempts() {
  reconnectAttempts = 0;
}
