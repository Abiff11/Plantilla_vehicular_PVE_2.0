export type VehicleImportPendingCatalogValues = {
  catalogCode: string;
  values: string[];
};

export type VehicleImportErrorSummary = {
  rowNumber: number;
  section: string;
  messages: string[];
};

export type VehicleImportSampleRow = {
  civ: string;
  plates: string;
  brand: string;
  type: string;
  useType: string;
  vehicleClass: string;
  model: string;
  serialNumber: string;
  status: string;
  rawCirculationStatus: string;
  sourceSection: string;
  sourceRowNumber: number;
};

export type VehicleImportPreview = {
  importBatchId: string;
  fileName: string;
  sheetName: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  sourceSections: string[];
  pendingCatalogValues: VehicleImportPendingCatalogValues[];
  errors: VehicleImportErrorSummary[];
  sampleRows: VehicleImportSampleRow[];
};

export type VehicleImportCommitResult = {
  importBatchId: string;
  fileName: string;
  sheetName: string;
  importedRows: number;
};

export type VehicleImportBatch = {
  id: string;
  fileName: string;
  sheetName: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  importedRows: number;
  status: 'PREVIEWED' | 'IMPORTED' | 'FAILED' | 'CANCELLED';
  sourceSections: string[];
  pendingCatalogValues: VehicleImportPendingCatalogValues[];
  createdAt: string;
  updatedAt: string;
  finishedAt: string | null;
  createdBy?: {
    id: string;
    firstName: string;
    lastName: string;
    fullName?: string;
  };
};

export type VehicleImportError = {
  id: string;
  rowNumber: number;
  section: string;
  columnName: string;
  rawValue: string;
  errorType: string;
  message: string;
  createdAt: string;
};
