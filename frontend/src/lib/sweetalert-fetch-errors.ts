import { showApiErrorAlert } from './alerts';

type FetchInput = Parameters<typeof fetch>[0];
type FetchInit = Parameters<typeof fetch>[1];

const INSTALL_FLAG = '__pveSweetAlertFetchErrorsInstalled__';

type WindowWithAlertFetchFlag = Window & typeof globalThis & {
  [INSTALL_FLAG]?: boolean;
};

function resolveUrl(input: FetchInput): URL | null {
  try {
    const rawUrl = input instanceof Request ? input.url : String(input);
    return new URL(rawUrl, window.location.origin);
  } catch {
    return null;
  }
}

function resolveMethod(input: FetchInput, init?: FetchInit): string {
  if (init?.method) {
    return init.method.toUpperCase();
  }

  if (input instanceof Request) {
    return input.method.toUpperCase();
  }

  return 'GET';
}

function shouldInspect(input: FetchInput): boolean {
  const url = resolveUrl(input);
  if (!url) {
    return false;
  }

  return url.pathname.includes('/api') || url.href.includes('/api/');
}

function shouldSuppressAuthRetryNoise(response: Response, input: FetchInput): boolean {
  if (response.status !== 401) {
    return false;
  }

  const url = resolveUrl(input);
  const pathname = url?.pathname ?? '';

  return !pathname.includes('/auth/refresh');
}

function shouldSuppressCsrfRetryNoise(response: Response, input: FetchInput, init?: FetchInit): boolean {
  if (response.status !== 403) {
    return false;
  }

  const method = resolveMethod(input, init);
  return ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
}

async function extractErrorMessage(response: Response): Promise<string> {
  try {
    const text = await response.clone().text();
    if (!text.trim()) {
      return `Error HTTP ${response.status}`;
    }

    try {
      const payload = JSON.parse(text) as { message?: string | string[]; error?: string };
      if (Array.isArray(payload.message)) {
        return payload.message.join(', ');
      }
      if (typeof payload.message === 'string' && payload.message.trim()) {
        return payload.message;
      }
      if (typeof payload.error === 'string' && payload.error.trim()) {
        return payload.error;
      }
    } catch {
      return text;
    }
  } catch {
    return `Error HTTP ${response.status}`;
  }

  return `Error HTTP ${response.status}`;
}

function installSweetAlertFetchErrors() {
  const currentWindow = window as WindowWithAlertFetchFlag;
  if (currentWindow[INSTALL_FLAG]) {
    return;
  }

  currentWindow[INSTALL_FLAG] = true;
  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input: FetchInput, init?: FetchInit) => {
    const inspect = shouldInspect(input);

    try {
      const response = await originalFetch(input, init);

      if (
        inspect &&
        !response.ok &&
        !shouldSuppressAuthRetryNoise(response, input) &&
        !shouldSuppressCsrfRetryNoise(response, input, init)
      ) {
        const message = await extractErrorMessage(response);
        void showApiErrorAlert({ status: response.status, message });
      }

      return response;
    } catch (error) {
      if (inspect) {
        const message = error instanceof Error ? error.message : 'No se pudo conectar con la API.';
        void showApiErrorAlert({ status: 0, message });
      }

      throw error;
    }
  };
}

installSweetAlertFetchErrors();
