const CSRF_COOKIE_NAME = 'pve_vehicle_csrf_token';
const CSRF_HEADER_NAME = 'X-CSRF-Token';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function getCookie(name: string) {
  const cookie = document.cookie
    .split(';')
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(`${name}=`));

  if (!cookie) {
    return null;
  }

  return decodeURIComponent(cookie.slice(name.length + 1));
}

function resolveMethod(init?: RequestInit) {
  return (init?.method ?? 'GET').toUpperCase();
}

function withSecurityHeaders(init?: RequestInit): RequestInit {
  const method = resolveMethod(init);

  if (SAFE_METHODS.has(method)) {
    return init ?? {};
  }

  const csrfToken = getCookie(CSRF_COOKIE_NAME);

  if (!csrfToken) {
    return init ?? {};
  }

  return {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      [CSRF_HEADER_NAME]: csrfToken,
    },
  };
}

const originalBrowserRequest = globalThis.fetch.bind(globalThis);

globalThis.fetch = (input: RequestInfo | URL, init?: RequestInit) =>
  originalBrowserRequest(input, {
    ...withSecurityHeaders(init),
    credentials: init?.credentials ?? 'include',
  });
