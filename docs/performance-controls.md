# Controles de rendimiento

## Pool de PostgreSQL

El backend usa un pool explicito mediante `extra` de TypeORM/pg.

Variables:

```env
DB_POOL_MAX=20
DB_POOL_IDLE_TIMEOUT_MS=30000
DB_POOL_CONNECTION_TIMEOUT_MS=5000
```

## Cache de consultas

La cache de query de TypeORM queda disponible pero apagada por defecto para evitar cachear datos sensibles.

Variables:

```env
CACHE_QUERY_ENABLED=false
CACHE_QUERY_DURATION_MS=30000
```

## Limite de concurrencia / rate limit

El backend mantiene el middleware propio de rate limit por politica:

- `general`
- `auth`
- `write`
- `import`

El almacenamiento actual es en memoria del proceso. Es suficiente para una sola instancia. Si se escala horizontalmente, mover el rate limit a Redis o al Nginx central.

## Nota operativa

No se habilito cache por defecto porque el sistema maneja informacion institucional sensible. Para usar cache, habilitar solo en consultas seguras, de catalogo o lectura no sensible.
