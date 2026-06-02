import { resolveConfiguredNetworkUrl } from '../../lib/resolve-network-url';
import type {
  VehicleImportBatch,
  VehicleImportCommitResult,
  VehicleImportError,
  VehicleImportPreview,
} from './vehicle-import-types';

function resolveApiUrl() {
  const configuredApiUrl = resolveConfiguredNetworkUrl(import.meta.env.VITE_API_URL, '/api');

  if (configuredApiUrl) {
    return configuredApiUrl;
  }

  if (typeof window === 'undefined') {
    return 'http://localhost:3101/api';
  }

  const { protocol, hostname } = window.location;
  return `${protocol}//${hostname}:3101/api`;
}

const API_URL = resolveApiUrl();

async function request<T>(path: string, init?: RequestInit, token?: string): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const responseText = await response.text();
    throw new Error(resolveImportErrorMessage(responseText));
  }

  const responseText = await response.text();

  if (!responseText.trim()) {
    return undefined as T;
  }

  return JSON.parse(responseText) as T;
}

function resolveImportErrorMessage(responseText: string) {
  if (!responseText.trim()) {
    return 'No se pudo completar la solicitud de importación.';
  }

  try {
    const payload = JSON.parse(responseText) as { message?: string | string[] };

    if (Array.isArray(payload.message)) {
      return payload.message.join(' ');
    }

    if (payload.message) {
      return payload.message;
    }
  } catch {
    return responseText;
  }

  return 'No se pudo completar la solicitud de importación.';
}

function buildExcelFormData(file: File) {
  const formData = new FormData();
  formData.append('file', file);
  return formData;
}

export const vehicleImportApi = {
  getBatches(token: string) {
    return request<VehicleImportBatch[]>('/records/imports', undefined, token);
  },
  getErrors(batchId: string, token: string) {
    return request<VehicleImportError[]>(`/records/imports/${batchId}/errors`, undefined, token);
  },
  preview(file: File, token: string) {
    return request<VehicleImportPreview>('/records/imports/preview', {
      method: 'POST',
      body: buildExcelFormData(file),
    }, token);
  },
  commit(file: File, token: string) {
    return request<VehicleImportCommitResult>('/records/imports/commit', {
      method: 'POST',
      body: buildExcelFormData(file),
    }, token);
  },
};
