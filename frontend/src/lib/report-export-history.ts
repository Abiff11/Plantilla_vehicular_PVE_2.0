export type ReportExportFormat = 'excel' | 'pdf';

export type ReportExportHistoryEntry = {
  id: string;
  title: string;
  format: ReportExportFormat;
  createdAt: string;
  recordCount: number;
  fieldCount: number;
  contextLines: string[];
};

const STORAGE_KEY = 'vehicle-report-export-history';
const MAX_HISTORY_ITEMS = 30;

function createHistoryId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `report-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function safeParseHistory(rawValue: string | null) {
  if (!rawValue) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawValue) as ReportExportHistoryEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function loadReportExportHistory() {
  if (typeof window === 'undefined') {
    return [];
  }

  return safeParseHistory(window.localStorage.getItem(STORAGE_KEY));
}

export function saveReportExportHistory(entries: ReportExportHistoryEntry[]) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_HISTORY_ITEMS)));
}

export function appendReportExportHistory(
  entry: Omit<ReportExportHistoryEntry, 'id' | 'createdAt'> & Partial<Pick<ReportExportHistoryEntry, 'id' | 'createdAt'>>,
) {
  const nextEntry: ReportExportHistoryEntry = {
    id: entry.id ?? createHistoryId(),
    title: entry.title,
    format: entry.format,
    createdAt: entry.createdAt ?? new Date().toISOString(),
    recordCount: entry.recordCount,
    fieldCount: entry.fieldCount,
    contextLines: entry.contextLines,
  };

  const currentHistory = loadReportExportHistory();
  const nextHistory = [nextEntry, ...currentHistory].slice(0, MAX_HISTORY_ITEMS);
  saveReportExportHistory(nextHistory);

  return nextEntry;
}

export function clearReportExportHistory() {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.removeItem(STORAGE_KEY);
}
