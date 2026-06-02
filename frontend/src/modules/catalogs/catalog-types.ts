export type CatalogAlias = {
  id: string;
  rawValue: string;
  normalizedRawValue: string;
  source: string;
  createdAt: string;
  updatedAt: string;
};

export type CatalogItem = {
  id: string;
  code: string;
  label: string;
  normalizedValue: string;
  metadata: Record<string, unknown>;
  isActive: boolean;
  sortOrder: number;
  aliases?: CatalogAlias[];
  createdAt: string;
  updatedAt: string;
};

export type CatalogGroup = {
  id: string;
  code: string;
  name: string;
  description: string;
  isSystem: boolean;
  sortOrder: number;
  items?: CatalogItem[];
  createdAt: string;
  updatedAt: string;
};

export type CreateCatalogGroupPayload = {
  code: string;
  name: string;
  description?: string;
};

export type CreateCatalogItemPayload = {
  code: string;
  label: string;
  normalizedValue?: string;
  metadata?: Record<string, unknown>;
  isActive?: boolean;
};

export type UpdateCatalogItemPayload = {
  label?: string;
  normalizedValue?: string;
  metadata?: Record<string, unknown>;
  isActive?: boolean;
};

export type CreateCatalogAliasPayload = {
  rawValue: string;
  source?: string;
};
