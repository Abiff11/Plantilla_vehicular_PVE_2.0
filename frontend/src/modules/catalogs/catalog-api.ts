import { resolveConfiguredNetworkUrl } from '../../lib/resolve-network-url';
import type {
  CatalogAlias,
  CatalogGroup,
  CatalogItem,
  CreateCatalogAliasPayload,
  CreateCatalogGroupPayload,
  CreateCatalogItemPayload,
  UpdateCatalogItemPayload,
} from './catalog-types';

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
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const responseText = await response.text();
    throw new Error(resolveCatalogErrorMessage(response.status, responseText));
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const responseText = await response.text();

  if (!responseText.trim()) {
    return undefined as T;
  }

  return JSON.parse(responseText) as T;
}

function resolveCatalogErrorMessage(status: number, responseText: string) {
  if (responseText.trim()) {
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
  }

  if (status === 403) {
    return 'No tienes permisos para administrar catalogos.';
  }

  if (status === 409) {
    return 'El valor ya existe en el catalogo.';
  }

  return 'No se pudo completar la solicitud de catalogos.';
}

export const catalogApi = {
  getGroups(token: string) {
    return request<CatalogGroup[]>('/catalog/groups', undefined, token);
  },
  getItems(groupCode: string, token: string) {
    return request<CatalogItem[]>(`/catalog/groups/${groupCode}/items`, undefined, token);
  },
  createGroup(payload: CreateCatalogGroupPayload, token: string) {
    return request<CatalogGroup>('/catalog/groups', {
      method: 'POST',
      body: JSON.stringify(payload),
    }, token);
  },
  createItem(groupCode: string, payload: CreateCatalogItemPayload, token: string) {
    return request<CatalogItem>(`/catalog/groups/${groupCode}/items`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }, token);
  },
  updateItem(itemId: string, payload: UpdateCatalogItemPayload, token: string) {
    return request<CatalogItem>(`/catalog/items/${itemId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }, token);
  },
  deleteItem(itemId: string, token: string) {
    return request<{ success: boolean }>(`/catalog/items/${itemId}`, {
      method: 'DELETE',
    }, token);
  },
  createAlias(itemId: string, payload: CreateCatalogAliasPayload, token: string) {
    return request<CatalogAlias>(`/catalog/items/${itemId}/aliases`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }, token);
  },
};
