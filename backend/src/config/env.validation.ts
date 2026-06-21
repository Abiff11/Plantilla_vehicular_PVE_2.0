type EnvConfig = Record<string, string | undefined>;

type NormalizedEnvConfig = Record<string, string>;

const PLACEHOLDER_VALUES = new Set([
  '',
  'change_me',
  'changeme',
  'password',
  'secret',
  'admin',
  'postgres',
  'example',
  'example.com',
  'no_subir_password_real',
  'no_subir_secret_real_minimo_32_caracteres',
]);

const REQUIRED_IN_PRODUCTION = [
  'DATABASE_HOST',
  'DATABASE_PORT',
  'DATABASE_NAME',
  'DATABASE_USER',
  'DATABASE_PASSWORD',
  'JWT_SECRET',
  'FRONTEND_ORIGINS',
] as const;

const REQUIRED_R2_STORAGE = [
  'R2_ACCOUNT_ID',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_BUCKET',
] as const;

function requireValue(config: EnvConfig, key: string): string {
  const value = config[key]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return value;
}

function validateInteger(value: string, key: string, minimum: number, maximum: number): string {
  const parsedValue = Number(value);

  if (!Number.isInteger(parsedValue) || parsedValue < minimum || parsedValue > maximum) {
    throw new Error(`${key} must be an integer between ${minimum} and ${maximum}`);
  }

  return value;
}

function validateBoolean(value: string, key: string): string {
  if (value !== 'true' && value !== 'false') {
    throw new Error(`${key} must be true or false`);
  }

  return value;
}

function validateSecret(value: string, key: string, minimumLength: number): string {
  const normalizedValue = value.trim().toLowerCase();

  if (value.length < minimumLength || PLACEHOLDER_VALUES.has(normalizedValue)) {
    throw new Error(`${key} must be a real secret with at least ${minimumLength} characters`);
  }

  return value;
}

function isAllowedProductionHttpOrigin(origin: URL) {
  return origin.protocol === 'http:' && origin.hostname === '100.118.154.7';
}

function validateOrigins(value: string, isProduction: boolean): string {
  const origins = value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (origins.length === 0) {
    throw new Error('FRONTEND_ORIGINS must contain at least one origin');
  }

  for (const origin of origins) {
    let parsedOrigin: URL;

    try {
      parsedOrigin = new URL(origin);
    } catch {
      throw new Error(`Invalid FRONTEND_ORIGINS value: ${origin}`);
    }

    if (parsedOrigin.protocol !== 'http:' && parsedOrigin.protocol !== 'https:') {
      throw new Error(`FRONTEND_ORIGINS only supports http/https origins: ${origin}`);
    }

    const hostname = parsedOrigin.hostname.toLowerCase();
    const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';

    if (isProduction && isLocalhost) {
      throw new Error('FRONTEND_ORIGINS cannot use localhost in production');
    }

    if (
      isProduction &&
      parsedOrigin.protocol !== 'https:' &&
      !isAllowedProductionHttpOrigin(parsedOrigin)
    ) {
      throw new Error('FRONTEND_ORIGINS must use HTTPS or the approved VPN origin http://100.118.154.7 in production');
    }
  }

  return origins.join(',');
}

function validateOptionalUrl(value: string, key: string): string {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return '';
  }

  try {
    const parsedValue = new URL(trimmedValue);

    if (parsedValue.protocol !== 'http:' && parsedValue.protocol !== 'https:') {
      throw new Error();
    }

    return trimmedValue.replace(/\/+$/u, '');
  } catch {
    throw new Error(`${key} must be a valid http/https URL`);
  }
}

export function validateEnv(config: EnvConfig): NormalizedEnvConfig {
  const nodeEnv = config.NODE_ENV?.trim() || 'development';
  const isProduction = nodeEnv === 'production';

  const normalizedConfig: NormalizedEnvConfig = {
    ...config,
    NODE_ENV: nodeEnv,
    PORT: config.PORT?.trim() || '3101',
    HOST: config.HOST?.trim() || '0.0.0.0',
    TRUST_PROXY: config.TRUST_PROXY?.trim() || 'false',
    DATABASE_PORT: config.DATABASE_PORT?.trim() || '5432',
    DATABASE_SSL: config.DATABASE_SSL?.trim() || 'false',
    DATABASE_SSL_REJECT_UNAUTHORIZED: config.DATABASE_SSL_REJECT_UNAUTHORIZED?.trim() || 'true',
    DATABASE_MIGRATIONS_RUN: config.DATABASE_MIGRATIONS_RUN?.trim() || 'false',
    JWT_EXPIRES_IN: config.JWT_EXPIRES_IN?.trim() || '8h',
    AUTH_COOKIE_MAX_AGE_MS: config.AUTH_COOKIE_MAX_AGE_MS?.trim() || '28800000',
    RATE_LIMIT_WINDOW_MS: config.RATE_LIMIT_WINDOW_MS?.trim() || '60000',
    RATE_LIMIT_MAX_REQUESTS: config.RATE_LIMIT_MAX_REQUESTS?.trim() || '100',
    RATE_LIMIT_AUTH_MAX_REQUESTS: config.RATE_LIMIT_AUTH_MAX_REQUESTS?.trim() || '10',
    RATE_LIMIT_WRITE_MAX_REQUESTS: config.RATE_LIMIT_WRITE_MAX_REQUESTS?.trim() || '60',
    RATE_LIMIT_IMPORT_MAX_REQUESTS: config.RATE_LIMIT_IMPORT_MAX_REQUESTS?.trim() || '20',
    STORAGE_DRIVER: config.STORAGE_DRIVER?.trim() || 'local',
    R2_PUBLIC_URL: config.R2_PUBLIC_URL?.trim() || '',
  } as NormalizedEnvConfig;

  if (isProduction) {
    for (const key of REQUIRED_IN_PRODUCTION) {
      normalizedConfig[key] = requireValue(config, key);
    }

    normalizedConfig.FRONTEND_ORIGINS = validateOrigins(normalizedConfig.FRONTEND_ORIGINS, true);
    normalizedConfig.JWT_SECRET = validateSecret(normalizedConfig.JWT_SECRET, 'JWT_SECRET', 32);
    normalizedConfig.DATABASE_PASSWORD = validateSecret(
      normalizedConfig.DATABASE_PASSWORD,
      'DATABASE_PASSWORD',
      16,
    );

    if (normalizedConfig.STORAGE_DRIVER !== 'r2') {
      throw new Error('STORAGE_DRIVER must be r2 in production');
    }
  } else if (config.FRONTEND_ORIGINS?.trim()) {
    normalizedConfig.FRONTEND_ORIGINS = validateOrigins(config.FRONTEND_ORIGINS, false);
  }

  validateInteger(normalizedConfig.PORT, 'PORT', 1, 65535);
  validateInteger(normalizedConfig.DATABASE_PORT, 'DATABASE_PORT', 1, 65535);
  validateInteger(normalizedConfig.AUTH_COOKIE_MAX_AGE_MS, 'AUTH_COOKIE_MAX_AGE_MS', 60000, 31536000000);
  validateInteger(normalizedConfig.RATE_LIMIT_WINDOW_MS, 'RATE_LIMIT_WINDOW_MS', 1000, 3600000);
  validateInteger(normalizedConfig.RATE_LIMIT_MAX_REQUESTS, 'RATE_LIMIT_MAX_REQUESTS', 1, 10000);
  validateInteger(normalizedConfig.RATE_LIMIT_AUTH_MAX_REQUESTS, 'RATE_LIMIT_AUTH_MAX_REQUESTS', 1, 1000);
  validateInteger(normalizedConfig.RATE_LIMIT_WRITE_MAX_REQUESTS, 'RATE_LIMIT_WRITE_MAX_REQUESTS', 1, 5000);
  validateInteger(normalizedConfig.RATE_LIMIT_IMPORT_MAX_REQUESTS, 'RATE_LIMIT_IMPORT_MAX_REQUESTS', 1, 1000);

  validateBoolean(normalizedConfig.TRUST_PROXY, 'TRUST_PROXY');
  validateBoolean(normalizedConfig.DATABASE_SSL, 'DATABASE_SSL');
  validateBoolean(
    normalizedConfig.DATABASE_SSL_REJECT_UNAUTHORIZED,
    'DATABASE_SSL_REJECT_UNAUTHORIZED',
  );
  validateBoolean(normalizedConfig.DATABASE_MIGRATIONS_RUN, 'DATABASE_MIGRATIONS_RUN');

  if (!['local', 'r2'].includes(normalizedConfig.STORAGE_DRIVER)) {
    throw new Error('STORAGE_DRIVER must be local or r2');
  }

  if (normalizedConfig.STORAGE_DRIVER === 'r2') {
    for (const key of REQUIRED_R2_STORAGE) {
      normalizedConfig[key] = requireValue(config, key);
    }

    normalizedConfig.R2_SECRET_ACCESS_KEY = validateSecret(
      normalizedConfig.R2_SECRET_ACCESS_KEY,
      'R2_SECRET_ACCESS_KEY',
      32,
    );
    normalizedConfig.R2_PUBLIC_URL = validateOptionalUrl(
      normalizedConfig.R2_PUBLIC_URL,
      'R2_PUBLIC_URL',
    );
  }

  return normalizedConfig;
}
