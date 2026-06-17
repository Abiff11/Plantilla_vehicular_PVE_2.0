const DEFAULT_TIME_ZONE = 'America/Mexico_City';

function buildDate(value: string | number | Date) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDateTimeMx(value: string | number | Date) {
  const date = buildDate(value);

  if (!date) {
    return '-';
  }

  return new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: DEFAULT_TIME_ZONE,
  }).format(date);
}

export function formatDateMx(value: string | number | Date) {
  const date = buildDate(value);

  if (!date) {
    return '-';
  }

  return new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'medium',
    timeZone: DEFAULT_TIME_ZONE,
  }).format(date);
}

export function formatTimeMx(value: string | number | Date) {
  const date = buildDate(value);

  if (!date) {
    return '-';
  }

  return new Intl.DateTimeFormat('es-MX', {
    timeStyle: 'short',
    timeZone: DEFAULT_TIME_ZONE,
  }).format(date);
}
