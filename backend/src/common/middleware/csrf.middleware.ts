import { ForbiddenException } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

const CSRF_COOKIE_NAME = 'pve_vehicle_csrf_token';
const CSRF_HEADER_NAME = 'x-csrf-token';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const EXCLUDED_PATHS = new Set(['/api/auth/login']);
const EXCLUDED_PREFIXES = ['/api/integrations/control-personal/'];

function parseCookie(cookieHeader: string | undefined, name: string) {
  if (!cookieHeader) {
    return null;
  }

  const cookie = cookieHeader
    .split(';')
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(`${name}=`));

  if (!cookie) {
    return null;
  }

  return decodeURIComponent(cookie.slice(name.length + 1));
}

function resolveAllowedOrigins() {
  return new Set(
    (process.env.FRONTEND_ORIGINS ?? process.env.FRONTEND_ORIGIN ?? '')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  );
}

function validateRequestOrigin(request: Request) {
  const origin = request.headers.origin;

  if (!origin) {
    return;
  }

  const configuredOrigins = resolveAllowedOrigins();
  const requestOrigin = `${request.protocol}://${request.get('host')}`;

  if (origin === requestOrigin || configuredOrigins.has(origin)) {
    return;
  }

  throw new ForbiddenException('Origen no permitido.');
}

function isCsrfExcludedPath(path: string) {
  return EXCLUDED_PATHS.has(path) || EXCLUDED_PREFIXES.some((prefix) => path.startsWith(prefix));
}

export function csrfMiddleware(request: Request, _response: Response, next: NextFunction) {
  if (SAFE_METHODS.has(request.method) || isCsrfExcludedPath(request.path)) {
    next();
    return;
  }

  try {
    validateRequestOrigin(request);

    const cookieToken = parseCookie(request.headers.cookie, CSRF_COOKIE_NAME);
    const headerToken = request.headers[CSRF_HEADER_NAME];

    if (!cookieToken || typeof headerToken !== 'string' || cookieToken !== headerToken) {
      throw new ForbiddenException('Token CSRF invalido.');
    }

    next();
  } catch (error) {
    next(error);
  }
}
