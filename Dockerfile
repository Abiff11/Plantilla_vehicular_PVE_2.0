# syntax=docker/dockerfile:1.7

FROM node:20-alpine AS deps
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app/backend
COPY --from=deps /app/backend/node_modules ./node_modules
COPY backend ./
RUN npm run build
RUN npm prune --omit=dev

FROM node:20-alpine AS runner
ENV NODE_ENV=production \
    PORT=3101 \
    HOST=0.0.0.0

WORKDIR /app/backend

COPY --from=builder --chown=node:node /app/backend/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/backend/package.json ./package.json
COPY --from=builder --chown=node:node /app/backend/dist ./dist

RUN mkdir -p /app/backend/uploads/vehicle-photos /app/backend/uploads/message-photos \
    && chown -R node:node /app/backend/uploads \
    && chmod -R 750 /app/backend/uploads

USER node

EXPOSE 3101

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/api/health" >/dev/null || exit 1

CMD ["node", "dist/main.js"]
