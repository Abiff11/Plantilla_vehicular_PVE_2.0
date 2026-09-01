import { resolveConfiguredNetworkUrl } from './resolve-network-url';
import type { VehiclePhoto } from '../types';

// CI validation branch: runtime behavior is identical to main.
function resolveApiBaseUrl() {
  const configuredUrl = resolveConfiguredNetworkUrl(import.meta.env.VITE_API_URL, '/api');

  if (configuredUrl) {
    const apiBaseUrl = configuredUrl.replace(/\/api$/, '');
    return apiBaseUrl || (typeof window === 'undefined' ? '' : window.location.origin);
  }

  if (typeof window === 'undefined') {
    return 'http://localhost:3101';
  }

  return window.location.origin;
}

const API_BASE_URL = resolveApiBaseUrl();

function joinUrl(base: string, path: string) {
  const cleanedBase = base.replace(/\/+$/, '');
  const cleanedPath = path.replace(/^\/+/u, '');
  return `${cleanedBase}/${cleanedPath}`;
}

export function resolveVehiclePhotoUrl(photo: VehiclePhoto) {
  const publicUrl = photo.publicUrl?.trim();
  const objectKey = photo.objectKey?.trim();
  const filePath = photo.filePath?.trim();

  if (publicUrl) {
    if (publicUrl.startsWith('http://') || publicUrl.startsWith('https://')) {
      return publicUrl;
    }

    if (publicUrl.startsWith('/uploads/')) {
      return joinUrl(API_BASE_URL, publicUrl);
    }

    if (!publicUrl.includes('/') && (publicUrl.includes('.') || publicUrl.length > 0)) {
      return joinUrl(API_BASE_URL, `/uploads/vehicle-photos/${publicUrl}`);
    }

    if (publicUrl.startsWith('/')) {
      return joinUrl(API_BASE_URL, publicUrl);
    }

    return joinUrl(API_BASE_URL, `/uploads/vehicle-photos/${publicUrl}`);
  }

  if (objectKey) {
    return joinUrl(API_BASE_URL, `/api/files/${objectKey}`);
  }

  if (filePath) {
    return joinUrl(API_BASE_URL, `/api/files/vehicle-photos/${filePath}`);
  }

  return '';
}
