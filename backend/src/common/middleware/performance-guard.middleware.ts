import type { NextFunction, Request, Response } from 'express';

const PAGE_SIZE_KEYS = ['limit', 'pageSize', 'perPage', 'take', 'size'];
const HEAVY_PATH_PATTERNS = [
  '/export',
  '/exports',
  '/report',
  '/reports',
  '/reporte',
  '/reportes',
  '/pdf',
];

let activeHeavyRequests = 0;

function parsePositiveInteger(value: unknown): number | null {
  if (typeof value !== 'string' || value.trim() === '') {
    return null;
  }

  const parsedValue = Number(value);
  return Number.isInteger(parsedValue) && parsedValue > 0 ? parsedValue : null;
}

function getMaxPageSize(): number {
  const configuredValue = Number(process.env.API_MAX_PAGE_SIZE ?? 100);
  return Number.isInteger(configuredValue) && configuredValue > 0
    ? configuredValue
    : 100;
}

function getMaxHeavyConcurrency(): number {
  const configuredValue = Number(process.env.HEAVY_REQUEST_CONCURRENCY ?? 2);
  return Number.isInteger(configuredValue) && configuredValue > 0
    ? configuredValue
    : 2;
}

function isHeavyRequest(request: Request): boolean {
  const path = (request.originalUrl || request.url).split('?')[0]?.toLowerCase() ?? '';
  return HEAVY_PATH_PATTERNS.some((pattern) => path.includes(pattern));
}

function rejectOversizedPagination(request: Request, response: Response): boolean {
  const maxPageSize = getMaxPageSize();

  for (const key of PAGE_SIZE_KEYS) {
    const queryValue = request.query[key];
    const value = Array.isArray(queryValue) ? queryValue[0] : queryValue;
    const parsedValue = parsePositiveInteger(value);

    if (parsedValue !== null && parsedValue > maxPageSize) {
      response.status(400).json({
        statusCode: 400,
        message: `${key} no puede ser mayor a ${maxPageSize}.`,
        error: 'Bad Request',
      });
      return true;
    }
  }

  return false;
}

export function performanceGuardMiddleware(
  request: Request,
  response: Response,
  next: NextFunction,
) {
  if (rejectOversizedPagination(request, response)) {
    return;
  }

  if (!isHeavyRequest(request)) {
    next();
    return;
  }

  const maxHeavyConcurrency = getMaxHeavyConcurrency();

  if (activeHeavyRequests >= maxHeavyConcurrency) {
    response.status(429).json({
      statusCode: 429,
      message: 'Hay demasiados reportes o exportaciones en proceso. Intenta nuevamente en unos segundos.',
      error: 'Too Many Requests',
    });
    return;
  }

  activeHeavyRequests += 1;

  const release = () => {
    activeHeavyRequests = Math.max(0, activeHeavyRequests - 1);
  };

  response.once('finish', release);
  response.once('close', release);
  next();
}
