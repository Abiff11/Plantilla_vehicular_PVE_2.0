export type DynamicCatalogAliasSeed = {
  rawValue: string;
  source?: string;
};

export type DynamicCatalogItemSeed = {
  code: string;
  label: string;
  normalizedValue?: string;
  aliases?: DynamicCatalogAliasSeed[];
  metadata?: Record<string, unknown>;
  sortOrder?: number;
};

export type DynamicCatalogGroupSeed = {
  code: string;
  name: string;
  description: string;
  items: DynamicCatalogItemSeed[];
  sortOrder: number;
};

export const DYNAMIC_CATALOG_SEED: DynamicCatalogGroupSeed[] = [
  {
    code: 'vehicle_use',
    name: 'Uso vehicular',
    description: 'Usos operativos detectados en la plantilla vehicular Excel.',
    sortOrder: 10,
    items: [
      { code: 'OPERATIVO', label: 'OPERATIVO', sortOrder: 10 },
      { code: 'SUSTANTIVO', label: 'SUSTANTIVO', sortOrder: 20 },
      { code: 'ADMINISTRATIVO', label: 'ADMINISTRATIVO', sortOrder: 30 },
      {
        code: 'CAMIONETA',
        label: 'CAMIONETA',
        metadata: {
          reviewRequired: true,
          note: 'Detectado en columna USO; posiblemente corresponde a tipo de vehiculo.',
        },
        sortOrder: 40,
      },
    ],
  },
  {
    code: 'vehicle_class',
    name: 'Tipo de vehiculo',
    description: 'Clases de vehiculo detectadas en el Excel institucional.',
    sortOrder: 20,
    items: [
      { code: 'AUTOMOVIL', label: 'AUTOMOVIL', sortOrder: 10 },
      { code: 'CAMIONETA', label: 'CAMIONETA', sortOrder: 20 },
      { code: 'MOTOCICLETA', label: 'MOTOCICLETA', sortOrder: 30 },
      { code: 'BICICLETA', label: 'BICICLETA', sortOrder: 40 },
      {
        code: 'GRUA',
        label: 'GRUA',
        aliases: [{ rawValue: 'GRÚA', source: 'excel' }],
        sortOrder: 50,
      },
      {
        code: 'MINIBUS_CARROCERIA_ALUVAN',
        label: 'MINIBUS CARROCERIA ALUVAN',
        aliases: [{ rawValue: 'MINIBUS CARROCERÍA ALUVAN', source: 'excel' }],
        sortOrder: 60,
      },
      {
        code: 'CAMIONES_CAMIONETA',
        label: 'CAMIONES (CAMIONETA)',
        sortOrder: 70,
      },
    ],
  },
  {
    code: 'physical_status',
    name: 'Estado fisico',
    description: 'Estado fisico normalizado de la unidad.',
    sortOrder: 30,
    items: [
      { code: 'BUENO', label: 'BUENO', sortOrder: 10 },
      { code: 'REGULAR', label: 'REGULAR', sortOrder: 20 },
      {
        code: 'MALO',
        label: 'MALO',
        aliases: [
          { rawValue: 'SINIESTRADA', source: 'excel' },
          { rawValue: 'SINIESTRADO 08/10/2025', source: 'excel' },
        ],
        sortOrder: 30,
      },
    ],
  },
  {
    code: 'circulation_status',
    name: 'Estatus de circulacion',
    description: 'Valores originales detectados en la columna ESTATUS del Excel.',
    sortOrder: 40,
    items: [
      {
        code: 'CIRCULANDO',
        label: 'CIRCULANDO',
        metadata: { systemStatus: 'ACTIVO' },
        sortOrder: 10,
      },
      {
        code: 'NUEVA',
        label: 'NUEVA',
        metadata: { systemStatus: 'ACTIVO' },
        sortOrder: 20,
      },
      {
        code: 'REPOSICION',
        label: 'REPOSICION',
        metadata: { systemStatus: 'ACTIVO' },
        sortOrder: 30,
      },
      {
        code: 'NO_CIRCULANDO',
        label: 'NO CIRCULANDO',
        metadata: { systemStatus: 'INCATIVO' },
        sortOrder: 40,
      },
      {
        code: 'BAJA',
        label: 'BAJA',
        metadata: { systemStatus: 'PARA BAJA' },
        sortOrder: 50,
      },
      {
        code: 'ROJO',
        label: 'ROJO',
        metadata: { systemStatus: 'OTRO' },
        sortOrder: 60,
      },
      {
        code: 'SIN_ESTATUS',
        label: 'SIN ESTATUS',
        aliases: [{ rawValue: '', source: 'excel' }],
        metadata: { systemStatus: 'OTRO' },
        sortOrder: 70,
      },
    ],
  },
  {
    code: 'system_status',
    name: 'Estatus del sistema',
    description: 'Estatus interno usado por reportes y dashboard.',
    sortOrder: 50,
    items: [
      { code: 'ACTIVO', label: 'ACTIVO', sortOrder: 10 },
      { code: 'INCATIVO', label: 'INCATIVO', sortOrder: 20 },
      { code: 'SINIESTRADO', label: 'SINIESTRADO', sortOrder: 30 },
      { code: 'PARA_BAJA', label: 'PARA BAJA', sortOrder: 40 },
      { code: 'OTRO', label: 'OTRO', sortOrder: 50 },
    ],
  },
  {
    code: 'vehicle_brand',
    name: 'Marca vehicular',
    description: 'Marcas vehiculares detectadas o creadas por administracion.',
    sortOrder: 60,
    items: [],
  },
  {
    code: 'vehicle_type',
    name: 'Tipo / modelo comercial',
    description: 'Tipos comerciales de unidad detectados o creados por administracion.',
    sortOrder: 70,
    items: [],
  },
  {
    code: 'vehicle_color',
    name: 'Color de unidad',
    description: 'Colores detectados en la plantilla vehicular.',
    sortOrder: 80,
    items: [],
  },
  {
    code: 'asset_classification',
    name: 'Clasificacion del bien',
    description: 'Clasificacion patrimonial o administrativa de la unidad.',
    sortOrder: 90,
    items: [
      { code: 'PATRIMONIAL', label: 'PATRIMONIAL', sortOrder: 10 },
      { code: 'ARRENDAMIENTO', label: 'ARRENDAMIENTO', sortOrder: 20 },
      { code: 'OTRO', label: 'OTRO', sortOrder: 30 },
    ],
  },
  {
    code: 'adscription',
    name: 'Adscripcion',
    description: 'Adscripciones detectadas desde el Excel.',
    sortOrder: 100,
    items: [],
  },
  {
    code: 'real_location',
    name: 'Ubicacion real',
    description: 'Ubicaciones reales detectadas desde el Excel.',
    sortOrder: 110,
    items: [],
  },
  {
    code: 'excel_section',
    name: 'Seccion del Excel',
    description: 'Agrupadores operativos detectados dentro de la plantilla.',
    sortOrder: 120,
    items: [
      { code: 'DELEGACION_REGIONAL_PLAZA', label: 'DELEGACION REGIONAL PLAZA', sortOrder: 10 },
      { code: 'SUSTANTIVAS', label: 'SUSTANTIVAS', sortOrder: 20 },
      { code: 'COMISIONADAS', label: 'COMISIONADAS', sortOrder: 30 },
      { code: 'AGRUPAMIENTO_CICLISTA', label: 'AGRUPAMIENTO CICLISTA', sortOrder: 40 },
      { code: 'VALLES_CENTRALES_REGION_ZONA_NORTE', label: 'VALLES CENTRALES REGION ZONA NORTE', sortOrder: 50 },
      { code: 'VALLES_CENTRALES_REGION_ZONA_SUR', label: 'VALLES CENTRALES REGION ZONA SUR', sortOrder: 60 },
      {
        code: 'DELEGACION_REGIONAL_CANADA',
        label: 'DELEGACION REGIONAL DE LA CANADA',
        aliases: [{ rawValue: 'DELEGACIÓN REGIONAL DE LA CAÑADA', source: 'excel' }],
        sortOrder: 70,
      },
      { code: 'VALLES_CENTRALES_REGION_MIXTECA', label: 'VALLES CENTRALES REGION MIXTECA', sortOrder: 80 },
      { code: 'DELEGACION_REGIONAL_CUENCA', label: 'DELEGACION REGIONAL CUENCA', sortOrder: 90 },
      { code: 'DELEGACION_REGIONAL_COSTA', label: 'DELEGACION REGIONAL COSTA', sortOrder: 100 },
      { code: 'DELEGACION_REGIONAL_ISTMO_ZONA_NORTE', label: 'DELEGACION REGIONAL ISTMO ZONA NORTE', sortOrder: 110 },
      { code: 'DELEGACION_REGIONAL_ISTMO_ZONA_SUR', label: 'DELEGACION REGIONAL ISTMO ZONA SUR', sortOrder: 120 },
      { code: 'BAJAS_TERCER_BLOQUE', label: 'BAJAS TERCER BLOQUE', sortOrder: 130 },
    ],
  },
];
