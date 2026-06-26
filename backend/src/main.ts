import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { NextFunction, Request, Response } from 'express';
import { mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { AppModule } from './app.module';
import { csrfMiddleware, httpLoggingMiddleware, performanceGuardMiddleware, rateLimitMiddleware, requestIdMiddleware } from './common/middleware';

const SECURITY_HEADERS = {
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'X-DNS-Prefetch-Control': 'off',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-site',
  'Origin-Agent-Cluster': '?1',
  'X-Permitted-Cross-Domain-Policies': 'none',
  'X-XSS-Protection': '0',
  'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
  'Cache-Control': 'no-store',
};

function isProduction() {
  return process.env.NODE_ENV === 'production';
}

function isLocalDevelopmentOrigin(origin: string) {
  try {
    const parsedOrigin = new URL(origin);
    const hostname = parsedOrigin.hostname;
    const port = Number(parsedOrigin.port);
    const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
    const isPrivateIpv4 =
      /^10\./.test(hostname) ||
      /^192\.168\./.test(hostname) ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname);

    const isVitePort = port >= 5173 && port <= 5179;
    return parsedOrigin.protocol === 'http:' && isVitePort && (isLocalhost || isPrivateIpv4);
  } catch {
    return false;
  }
}

function buildCorsOriginChecker() {
  const configuredOrigins = (process.env.FRONTEND_ORIGINS ?? process.env.FRONTEND_ORIGIN ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  const defaultOrigins = isProduction() ? [] : ['http://localhost:5173', 'http://127.0.0.1:5173'];
  const allowedOrigins = new Set([...defaultOrigins, ...configuredOrigins]);

  if (isProduction() && allowedOrigins.size === 0) {
    throw new Error('FRONTEND_ORIGINS is required in production');
  }

  return (origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) => {
    if (!origin || allowedOrigins.has(origin) || (!isProduction() && isLocalDevelopmentOrigin(origin))) {
      callback(null, true);
      return;
    }

    callback(new Error(`CORS blocked for origin ${origin}`));
  };
}

function resolveTrustProxy() {
  const trustProxy = process.env.TRUST_PROXY?.trim();

  if (!trustProxy) {
    return false;
  }

  if (trustProxy === 'true') {
    return true;
  }

  if (trustProxy === 'false') {
    return false;
  }

  const parsedNumber = Number(trustProxy);
  return Number.isNaN(parsedNumber) ? trustProxy : parsedNumber;
}

async function bootstrap() {
  const vehiclePhotosDir = join(process.cwd(), 'uploads', 'vehicle-photos');
  const messagePhotosDir = join(process.cwd(), 'uploads', 'message-photos');

  if (!existsSync(vehiclePhotosDir)) {
    mkdirSync(vehiclePhotosDir, { recursive: true });
  }

  if (!existsSync(messagePhotosDir)) {
    mkdirSync(messagePhotosDir, { recursive: true });
  }

  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.getHttpAdapter().getInstance().set('trust proxy', resolveTrustProxy());

  app.use(requestIdMiddleware);
  app.use(performanceGuardMiddleware);
  app.use(rateLimitMiddleware);
  app.use(httpLoggingMiddleware);
  app.use(csrfMiddleware);

  app.enableCors({
    origin: buildCorsOriginChecker(),
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type', 'X-CSRF-Token', 'X-Requested-With'],
    exposedHeaders: ['X-Request-Id', 'X-RateLimit-Policy', 'X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
  });

  app.setGlobalPrefix('api');
  app.use((request: Request, response: Response, next: NextFunction) => {
    Object.entries(SECURITY_HEADERS).forEach(([headerName, headerValue]) => {
      response.setHeader(headerName, headerValue);
    });

    if (request.secure || request.headers['x-forwarded-proto'] === 'https') {
      response.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }

    next();
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port = Number(process.env.PORT ?? 3101);
  const host = process.env.HOST ?? '0.0.0.0';
  await app.listen(port, host);
  console.log('servidor listo');
}

bootstrap();
