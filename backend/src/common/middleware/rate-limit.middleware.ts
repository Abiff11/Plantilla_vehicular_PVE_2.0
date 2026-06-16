import { HttpStatus } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

type WindowEntry = {
  count: number;
  resetAt: number;
};

type Policy = {
  name: string;
  max: number;
};

const WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60_000);
const LIMITS = {
  general: Number(process.env.RATE_LIMIT_MAX_REQUESTS ?? 100),
  auth: Number(process.env.RATE_LIMIT_AUTH_MAX_REQUESTS ?? 10),
  write: Number(process.env.RATE_LIMIT_WRITE_MAX_REQUESTS ?? 60),
  import: Number(process.env.RATE_LIMIT_IMPORT_MAX_REQUESTS ?? 20),
};

const store = new Map<string, WindowEntry>();

function getClientKey(request: Request, policyName: string): string {
  const ip = request.ip ?? request.socket.remoteAddress ?? 'unknown';
  return `${policyName}:${ip}`;
}

function getRequestPath(request: Request): string {
  return (request.originalUrl || request.url).split('?')[0] ?? '';
}

function selectPolicy(request: Request): Policy | null {
  const path = getRequestPath(request);
  const method = request.method.toUpperCase();

  if (path === '/api/health' || path === '/api/health/ready') {
    return null;
  }

  if (path.startsWith('/api/auth/')) {
    return { name: 'auth', max: LIMITS.auth };
  }

  if (path.includes('/import') || path.includes('/upload')) {
    return { name: 'import', max: LIMITS.import };
  }

  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    return { name: 'write', max: LIMITS.write };
  }

  return { name: 'general', max: LIMITS.general };
}

function getEntry(key: string): WindowEntry {
  const now = Date.now();
  const currentEntry = store.get(key);

  if (currentEntry && now <= currentEntry.resetAt) {
    return currentEntry;
  }

  const nextEntry = {
    count: 0,
    resetAt: now + WINDOW_MS,
  };

  store.set(key, nextEntry);
  return nextEntry;
}

function cleanup() {
  const now = Date.now();

  for (const [key, entry] of store.entries()) {
    if (now > entry.resetAt) {
      store.delete(key);
    }
  }
}

setInterval(cleanup, Math.min(WINDOW_MS * 2, 5 * 60 * 1000)).unref();

export function rateLimitMiddleware(
  request: Request,
  response: Response,
  next: NextFunction,
) {
  const policy = selectPolicy(request);

  if (!policy) {
    next();
    return;
  }

  const entry = getEntry(getClientKey(request, policy.name));
  entry.count += 1;

  const remaining = Math.max(0, policy.max - entry.count);
  const retryAfter = Math.ceil((entry.resetAt - Date.now()) / 1000);

  response.setHeader('X-RateLimit-Policy', policy.name);
  response.setHeader('X-RateLimit-Limit', String(policy.max));
  response.setHeader('X-RateLimit-Remaining', String(remaining));
  response.setHeader('X-RateLimit-Reset', String(entry.resetAt));

  if (entry.count > policy.max) {
    response.setHeader('Retry-After', String(retryAfter));
    response.status(HttpStatus.TOO_MANY_REQUESTS).json({
      statusCode: HttpStatus.TOO_MANY_REQUESTS,
      message: 'Too many requests. Please try again later.',
      retryAfter,
      timestamp: new Date().toISOString(),
      path: request.url,
      requestId: (request as Request & { requestId?: string }).requestId,
    });
    return;
  }

  next();
}
