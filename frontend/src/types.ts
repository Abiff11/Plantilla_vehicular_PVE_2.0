export type Role = 'enlace' | 'director_operativo' | 'plantilla_vehicular' | 'director_general' | 'superadmin' | 'coordinacion';
export type RecordCatalogField =
  | 'useType'
  | 'vehicleClass'
  | 'physicalStatus'
  | 'status'
  | 'assetClassification';

export type CatalogOption = {
  value: string;
  label: string;
};

export type RecordFieldCatalog = {
  label: string;
  allowsCustom: boolean;
  options: CatalogOption[];
};

export type RecordFieldCatalogMap = Record<RecordCatalogField, RecordFieldCatalog>;

export type Region = {
  id: string;
  name: string;
  code: string;
  delegations: Delegation[];
};

export type Delegation = {
  id: string;
  name: string;
};

export type User = {
  id: string;
  firstName: string;
  lastName: string;
  fullName?: string;
  grade: string;
  phone: string;
  email: string;
  role: Role;
  region?: Region | null;
  delegation?: Delegation | null;
};

export type CreateUserPayload = {
  firstName: string;
  lastName: string;
  grade: string;
  email: string;
  password: string;
  role: Role;
  phone: string;
  regionId?: string;
  delegationId?: string;
};

export type UpdateUserPayload = Partial<CreateUserPayload>;

export type RecordFormValues = {
  delegationId: string;
  plates: string;
  brand: string;
  type: string;
  useType: string;
  vehicleClass: string;
  model: string;
  engineNumber: string;
  serialNumber: string;
  custodian: string;
  patrolNumber: string;
  physicalStatus: string;
  status: string;
  assetClassification: string;
  observation: string;
};

export type VehiclePhoto = {
  id: string;
  fileName: string;
  filePath: string;
  objectKey: string;
  publicUrl: string;
  mimeType: string;
  size: number;
  storageProvider: 'local' | 'r2';
  uploadedBy: User;
  createdAt: string;
};

export type VehicleRecord = RecordFormValues & {
  id: string;
  createdAt: string;
  updatedAt: string;
  recordState: 'CURRENT' | 'TRANSFERRED_OUT';
  delegation: {
    id: string;
    name: string;
    region: {
      id: string;
      name: string;
    };
  };
  viewDelegation: {
    id: string;
    name: string;
    region: {
      id: string;
      name: string;
    };
  };
  createdBy: User;
  photos: VehiclePhoto[];
  latestTransfer: VehicleTransferEvent | null;
  latestEdit: VehicleEditEvent | null;
  transferHistory: VehicleTransferEvent[];
  editHistory: VehicleEditEvent[];
};

export type VehicleTransferEvent = {
  id: string;
  movedAt: string;
  reason: string;
  fromDelegation: {
    id: string;
    name: string;
    region: {
      id: string;
      name: string;
    };
  };
  toDelegation: {
    id: string;
    name: string;
    region: {
      id: string;
      name: string;
    };
  };
  movedBy: User;
};

export type VehicleEditEvent = {
  id: string;
  editedAt: string;
  changedFields: string[];
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  actor: User | null;
};

export type VehicleRosterReport = {
  id: string;
  reportScope: 'DELEGATION' | 'REGION';
  hasChanges: boolean;
  changesSinceLastReport: number;
  confirmedDelegationReports: number;
  notes: string;
  submittedAt: string;
  createdAt: string;
  delegation: {
    id: string;
    name: string;
    region: {
      id: string;
      name: string;
    };
  } | null;
  region: {
    id: string;
    name: string;
  } | null;
  submittedBy: User;
};

export type RosterReportOverviewRow = {
  delegationId: string;
  delegationName: string;
  regionId: string;
  regionName: string;
  status:
    | 'NOT_REPORTED'
    | 'PENDING_CHANGES'
    | 'REPORTED_WITH_CHANGES'
    | 'REPORTED_WITHOUT_CHANGES';
  pendingChanges: number;
  lastReport: VehicleRosterReport | null;
};

export type RegionRosterReportOverviewRow = {
  regionId: string;
  regionName: string;
  status:
    | 'NOT_REPORTED'
    | 'PENDING_CHANGES'
    | 'REPORTED_WITH_CHANGES'
    | 'REPORTED_WITHOUT_CHANGES';
  totalDelegations: number;
  confirmedDelegationReports: number;
  pendingDelegationReports: number;
  lastReport: VehicleRosterReport | null;
};

export type GroupedRegionRecords = {
  regionId: string;
  regionName: string;
  delegations: {
    delegationId: string;
    delegationName: string;
    records: VehicleRecord[];
  }[];
};

export type AuditLog = {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  actor?: User | null;
};

export type DirectorOverview = {
  kpis: {
    totalRecords: number;
    totalRegions: number;
    totalDelegations: number;
    totalActive: number;
    notReported: number;
    pendingChanges: number;
    reportedWithoutChanges: number;
    reportedWithChanges: number;
  };
  table: {
    date: string;
    statuses: string[];
    physicalStatuses: string[];
    rows: {
      vehicleClass: string;
      totalUnits: number;
      totalActive: number;
      statusBreakdown: Record<string, number>;
      physicalStatusBreakdown: Record<string, number>;
    }[];
    resume: {
      totalUnits: number;
      totalActive: number;
      statusBreakdown: Record<string, number>;
      physicalStatusBreakdown: Record<string, number>;
    };
    customStatusDescriptions: string[];
    observations: string[];
  };
  map: {
    delegations: {
      delegationId: string;
      delegationName: string;
      regionId: string;
      regionName: string;
      totalUnits: number;
      totalActive: number;
      dominantVehicleClass: string | null;
      vehicleClasses: {
        vehicleClass: string;
        totalUnits: number;
        totalActive: number;
      }[];
    }[];
  };
  filters: {
    selectedRegionId: string | null;
    selectedDelegationId: string | null;
    regions: {
      regionId: string;
      regionName: string;
      delegations: {
        id: string;
        name: string;
      }[];
    }[];
  };
};

export type AuthResponse = {
  accessToken: string;
  csrfToken?: string;
  user: User;
};

export type PaginatedMeta = {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
};

export type PaginatedResponse<T> = {
  items: T[];
  meta: PaginatedMeta;
};

export type Conversation = {
  id: string;
  title: string | null;
  isGroup: boolean;
  participants: User[];
  lastMessageAt: string | null;
  createdAt: string;
  updatedAt: string;
  unreadCount?: number;
  lastMessage?: Message | null;
};

export type MessagePhoto = {
  id: string;
  fileName: string;
  filePath: string;
  objectKey: string;
  publicUrl: string;
  mimeType: string;
  size: number;
  storageProvider: 'local' | 'r2';
  uploadedBy: User;
  createdAt: string;
};

export type Message = {
  id: string;
  content: string;
  isRead: boolean;
  readAt: string | null;
  sender: User;
  conversation: Conversation;
  photos: MessagePhoto[];
  createdAt: string;
  updatedAt: string;
};