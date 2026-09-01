import type { VehicleRecord } from '../types';
import { resolveConfiguredNetworkUrl } from './resolve-network-url';

function resolveApiUrl() {
  const configuredApiUrl = resolveConfiguredNetworkUrl(import.meta.env.VITE_API_URL, '/api');

  if (configuredApiUrl) {
    return configuredApiUrl;
  }

  if (typeof window === 'undefined') {
    return 'http://localhost:3101/api';
  }

  return `${window.location.origin}/api`;
}

const API_URL = resolveApiUrl();

async function parseResponse(response: Response): Promise<VehicleRecord> {
  const responseText = await response.text();

  if (!response.ok) {
    if (responseText.trim()) {
      try {
        const payload = JSON.parse(responseText) as { message?: string | string[] };
        const message = Array.isArray(payload.message)
          ? payload.message.join(' ')
          : payload.message;

        if (message) {
          throw new Error(message);
        }
      } catch (error) {
        if (error instanceof Error && error.message !== responseText) {
          throw error;
        }
      }
    }

    throw new Error('No se pudo actualizar el expediente fotográfico.');
  }

  return JSON.parse(responseText) as VehicleRecord;
}

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}` };
}

export const recordPhotoApi = {
  async addPhotos(recordId: string, photos: File[], token: string) {
    const formData = new FormData();
    photos.forEach((photo) => formData.append('photos', photo));

    const response = await fetch(`${API_URL}/records/${recordId}/photos`, {
      method: 'POST',
      headers: authHeaders(token),
      body: formData,
    });

    return parseResponse(response);
  },

  async setPrimary(recordId: string, photoId: string, token: string) {
    const response = await fetch(`${API_URL}/records/${recordId}/photos/${photoId}/primary`, {
      method: 'PATCH',
      headers: authHeaders(token),
    });

    return parseResponse(response);
  },

  async replacePhoto(recordId: string, photoId: string, photo: File, token: string) {
    const formData = new FormData();
    formData.append('photo', photo);

    const response = await fetch(`${API_URL}/records/${recordId}/photos/${photoId}/replace`, {
      method: 'POST',
      headers: authHeaders(token),
      body: formData,
    });

    return parseResponse(response);
  },

  async deletePhoto(recordId: string, photoId: string, token: string) {
    const response = await fetch(`${API_URL}/records/${recordId}/photos/${photoId}`, {
      method: 'DELETE',
      headers: authHeaders(token),
    });

    return parseResponse(response);
  },
};
