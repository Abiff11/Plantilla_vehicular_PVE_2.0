export function resolveConfiguredNetworkUrl(
  configuredUrl: string | undefined,
  fallbackPath: string,
) {
  const trimmedUrl = configuredUrl?.trim();

  if (!trimmedUrl) {
    return null;
  }

  if (trimmedUrl.startsWith('/')) {
    return trimmedUrl.replace(/\/$/, '') || '/';
  }

  if (typeof window === 'undefined') {
    return trimmedUrl;
  }

  try {
    const resolvedUrl = new URL(trimmedUrl);
    const currentHostname = window.location.hostname;
    const isConfiguredLocalhost =
      resolvedUrl.hostname === 'localhost' || resolvedUrl.hostname === '127.0.0.1';
    const isCurrentLocalhost =
      currentHostname === 'localhost' || currentHostname === '127.0.0.1';

    if (isConfiguredLocalhost && !isCurrentLocalhost) {
      resolvedUrl.hostname = currentHostname;
    }

    return resolvedUrl.toString().replace(/\/$/, '');
  } catch {
    return fallbackPath;
  }
}
