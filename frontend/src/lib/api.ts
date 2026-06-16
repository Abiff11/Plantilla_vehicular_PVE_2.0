import {
  AuditLog,
  AuthResponse,
  Conversation,
  CreateUserPayload,
  DirectorOverview,
  GroupedRegionRecords,
  Message,
  PaginatedResponse,
  Region,
  RegionRosterReportOverviewRow,
  RecordFieldCatalogMap,
  RecordFormValues,
  VehicleEditPayload,
  RosterReportOverviewRow,
  UpdateUserPayload,
  User,
  VehicleRecord,
  VehicleRosterReport,
} from '../types';
import { resolveConfiguredNetworkUrl } from './resolve-network-url';

let unauthorizedHandler: (() => void) | null = null;

export function setUnauthorizedHandler(handler: (() => void) | null) {
  unauthorizedHandler = handler;
}

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

function translateBackendMessage(message: string) {
  const exactTranslations: Record<string, string> = {
    'A record with the same unique constraint already exists.':
      'Ya existe un registro con la misma restriccion unica.',
    'Internal server error': 'Error interno del servidor.',
    'property useTypeCustom should not exist': 'El campo useTypeCustom no es valido.',
    'property statusCustom should not exist': 'El campo statusCustom no es valido.',
    'property assetClassificationCustom should not exist':
      'El campo assetClassificationCustom no es valido.',
  };

  if (exactTranslations[message]) {
    return exactTranslations[message];
  }

  const patternTranslations: Array<[RegExp, (...matches: string[]) => string]> = [
    [
      /^property (\w+) should not exist$/i,
      (_full, fieldName) => `El campo ${fieldName} no es valido.`,
    ],
    [
      /^(.+?) '(.+?)' is already in use by an active record\.$/i,
      (_full, fieldLabel, fieldValue) =>
        `${fieldLabel} '${fieldValue}' ya esta en uso en una captura activa.`,
    ],
    [
      /^(.+?): '(.+?)' is not a valid option\. Allowed: (.+)\.$/i,
      (_full, fieldLabel, fieldValue, allowedValues) =>
        `${fieldLabel}: '${fieldValue}' no es una opcion valida. Valores permitidos: ${allowedValues}.`,
    ],
    [/^Invalid credentials\.$/i, () => 'Credenciales invalidas.'],
    [
      /^Too many login attempts\. Please try again later\.$/i,
      () => 'Demasiados intentos de inicio de sesion. Intenta nuevamente mas tarde.',
    ],
    [/^User not found\.$/i, () => 'No se encontro el usuario.'],
    [/^Record not found\.$/i, () => 'No se encontro la captura vehicular.'],
    [/^Conversation not found\.$/i, () => 'No se encontro la conversacion.'],
    [/^Message not found\.$/i, () => 'No se encontro el mensaje.'],
    [/^Roster report not found\.$/i, () => 'No se encontro el reporte de plantilla.'],
    [/^Email is already registered\.$/i, () => 'El correo electronico ya esta registrado.'],
  ];

  for (const [pattern, buildMessage] of patternTranslations) {
    const match = message.match(pattern);

    if (match) {
      return buildMessage(...match);
    }
  }

  return message;
}

function getPublicErrorMessage(status: number, responseText = '') {
  if (responseText.trim()) {
    try {
      const payload = JSON.parse(responseText) as { message?: string | string[] };

      if (Array.isArray(payload.message)) {
        return payload.message.map((message) => translateBackendMessage(message)).join(' ');
      }

      if (payload.message) {
        return translateBackendMessage(payload.message);
      }
    } catch {
      return translateBackendMessage(responseText);
    }
  }

  if (status === 401) {
    return 'No autorizado. Inicia sesion nuevamente.';
  }

  if (status === 403) {
    return 'No tienes permisos para realizar esta accion.';
  }

  if (status === 404) {
    return 'El recurso solicitado no fue encontrado.';
  }

  if (status === 409) {
    return 'El registro ya existe.';
  }

  if (status === 429) {
    return 'Demasiadas solicitudes. Intenta mas tarde.';
  }

  if (status >= 500) {
    return 'Ocurrio un error interno. Intenta nuevamente mas tarde.';
  }

  return 'No se pudo completar la solicitud.';
}

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

    if (response.status === 401 && token) {
      if (unauthorizedHandler) {
        unauthorizedHandler();
      }
    }

    throw new Error(getPublicErrorMessage(response.status, responseText));
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

async function requestWithFormData<T>(path: string, formData: FormData, token: string): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const responseText = await response.text();

    if (response.status === 401 && token) {
      if (unauthorizedHandler) {
        unauthorizedHandler();
      }
    }

    throw new Error(getPublicErrorMessage(response.status, responseText));
  }

  const responseText = await response.text();

  if (!responseText.trim()) {
    return undefined as T;
  }

  return JSON.parse(responseText) as T;
}

export const api = {
  login(email: string, password: string) {
    return request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },
  getCurrentUser(token: string) {
    return request<User>('/auth/me', undefined, token);
  },
  getRegions(token: string) {
    return request<Region[]>('/catalog/regions', undefined, token);
  },
  getRecordFieldCatalog(token: string) {
    return request<RecordFieldCatalogMap>('/catalog/record-fields', undefined, token);
  },
  createRecord(values: RecordFormValues, token: string) {
    return request<VehicleRecord>('/records', {
      method: 'POST',
      body: JSON.stringify(values),
    }, token);
  },
  createRecordWithPhotos(values: RecordFormValues, photos: File[], token: string) {
    const formData = new FormData();

    Object.entries(values).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        formData.append(key, String(value));
      }
    });

    photos.forEach((photo) => {
      formData.append('photos', photo);
    });

    return requestWithFormData<VehicleRecord>('/records', formData, token);
  },
  updateRecord(recordId: string, values: VehicleEditPayload, token: string) {
    return request<VehicleRecord>(`/records/${recordId}`, {
      method: 'PATCH',
      body: JSON.stringify(values),
    }, token);
  },
  transferRecord(recordId: string, delegationId: string, reason: string, token: string) {
    return request<VehicleRecord>(`/records/${recordId}/transfer`, {
      method: 'POST',
      body: JSON.stringify({ delegationId, reason }),
    }, token);
  },
  deleteRecord(recordId: string, token: string) {
    return request<void>(`/records/${recordId}`, {
      method: 'DELETE',
    }, token);
  },
  submitRosterReport(notes: string, token: string) {
    return request<VehicleRosterReport>('/records/reports', {
      method: 'POST',
      body: JSON.stringify({ notes }),
    }, token);
  },
  submitRegionalRosterReport(regionId: string, notes: string, token: string) {
    return request<VehicleRosterReport>('/records/reports/region', {
      method: 'POST',
      body: JSON.stringify({ regionId, notes }),
    }, token);
  },
  getMyRosterReports(token: string) {
    return request<VehicleRosterReport[]>('/records/reports/my', undefined, token);
  },
  getMyRegionalRosterReports(token: string) {
    return request<VehicleRosterReport[]>('/records/reports/region/my', undefined, token);
  },
  getRosterReportOverview(token: string, regionId?: string) {
    const params = new URLSearchParams();

    if (regionId) {
      params.set('regionId', String(regionId));
    }

    const query = params.toString();
    const path = query ? `/records/reports/overview?${query}` : '/records/reports/overview';

    return request<RegionRosterReportOverviewRow[]>(path, undefined, token);
  },
  getRegionalRosterReportOverview(token: string, delegationId?: string) {
    const params = new URLSearchParams();

    if (delegationId) {
      params.set('delegationId', String(delegationId));
    }

    const query = params.toString();
    const path = query
      ? `/records/reports/region/overview?${query}`
      : '/records/reports/region/overview';

    return request<RosterReportOverviewRow[]>(path, undefined, token);
  },
  getMyRecords(token: string) {
    return request<VehicleRecord[]>('/records/my', undefined, token);
  },
  getRegionalOverview(token: string) {
    return request<GroupedRegionRecords[]>('/records/region/live', undefined, token);
  },
  getPlantillaVehicularOverview(
    token: string,
    regionId?: string,
    delegationId?: string,
    dateFrom?: string,
    dateTo?: string,
  ) {
    const params = new URLSearchParams();

    if (regionId) {
      params.set('regionId', regionId);
    }

    if (delegationId) {
      params.set('delegationId', delegationId);
    }

    if (dateFrom) {
      params.set('dateFrom', dateFrom);
    }

    if (dateTo) {
      params.set('dateTo', dateTo);
    }

    const query = params.toString();
    const path = query ? `/records/admin/overview?${query}` : '/records/admin/overview';

    return request<GroupedRegionRecords[]>(path, undefined, token);
  },
  getDirectorGeneralOverview(
    token: string,
    regionId?: string,
    delegationId?: string,
    dateFrom?: string,
    dateTo?: string,
  ) {
    const params = new URLSearchParams();

    if (regionId) {
      params.set('regionId', regionId);
    }

    if (delegationId) {
      params.set('delegationId', delegationId);
    }

    if (dateFrom) {
      params.set('dateFrom', dateFrom);
    }

    if (dateTo) {
      params.set('dateTo', dateTo);
    }

    const query = params.toString();
    const path = query ? `/records/director/overview?${query}` : '/records/director/overview';

    return request<DirectorOverview>(path, undefined, token);
  },
  getDirectorDelegationVehicles(
    token: string,
    delegationId: string,
    dateFrom?: string,
    dateTo?: string,
  ) {
    const params = new URLSearchParams();

    if (dateFrom) {
      params.set('dateFrom', dateFrom);
    }

    if (dateTo) {
      params.set('dateTo', dateTo);
    }

    const query = params.toString();
    const path = query
      ? `/records/director/delegations/${delegationId}/vehicles?${query}`
      : `/records/director/delegations/${delegationId}/vehicles`;

    return request<VehicleRecord[]>(path, undefined, token);
  },
  getUsers(token: string, page?: number, limit?: number) {
    const params = new URLSearchParams();

    if (page !== undefined) {
      params.set('page', String(page));
    }

    if (limit !== undefined) {
      params.set('limit', String(limit));
    }

    const query = params.toString();
    const path = query ? `/users?${query}` : '/users';

    return request<User[] | PaginatedResponse<User>>(path, undefined, token);
  },
  createUser(payload: CreateUserPayload, token: string) {
    return request<User>('/users', {
      method: 'POST',
      body: JSON.stringify(payload),
    }, token);
  },
  updateUser(userId: string, payload: UpdateUserPayload, token: string) {
    return request<User>(`/users/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }, token);
  },
  deleteUser(userId: string, token: string) {
    return request<void>(`/users/${userId}`, {
      method: 'DELETE',
    }, token);
  },
  getAuditLogs(token: string, page?: number, limit?: number) {
    const params = new URLSearchParams();

    if (page !== undefined) {
      params.set('page', String(page));
    }

    if (limit !== undefined) {
      params.set('limit', String(limit));
    }

    const query = params.toString();
    const path = query ? `/audit-logs/live?${query}` : '/audit-logs/live';

    return request<AuditLog[] | PaginatedResponse<AuditLog>>(path, undefined, token);
  },
  logout(token: string) {
    return request<void>('/auth/logout', { method: 'POST' }, token);
  },
  getMessagingPartners(token: string) {
    return request<User[]>('/messages/partners', undefined, token);
  },
  getConversations(token: string) {
    return request<Conversation[]>('/messages/conversations', undefined, token);
  },
  createConversation(participantIds: string[], title: string | undefined, token: string) {
    return request<Conversation>('/messages/conversations', {
      method: 'POST',
      body: JSON.stringify({ participantIds, title }),
    }, token);
  },
  getConversationMessages(conversationId: string, token: string) {
    return request<Message[]>(`/messages/conversations/${conversationId}/messages`, undefined, token);
  },
  sendMessage(conversationId: string, content: string, token: string) {
    return request<Message>('/messages', {
      method: 'POST',
      body: JSON.stringify({ conversationId, content }),
    }, token);
  },
  sendMessageWithPhotos(conversationId: string, content: string, photos: File[], token: string) {
    const formData = new FormData();
    formData.append('conversationId', conversationId);
    formData.append('content', content);

    photos.forEach((photo) => {
      formData.append('photos', photo);
    });

    return requestWithFormData<Message>('/messages/with-photos', formData, token);
  },
  markMessageAsRead(messageId: string, token: string) {
    return request<Message>('/messages/read', {
      method: 'PATCH',
      body: JSON.stringify({ messageId }),
    }, token);
  },
  markConversationAsRead(conversationId: string, token: string) {
    return request<void>(`/messages/conversations/${conversationId}/read-all`, {
      method: 'PATCH',
    }, token);
  },
};
