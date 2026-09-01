export const RECORD_FIELD_CATALOG = {
  useType: {
    label: 'Uso',
    allowsCustom: true,
    options: [
      { value: 'OPERATIVO', label: 'OPERATIVO' },
      { value: 'SUSTANTIVO', label: 'SUSTANTIVO' },
      { value: 'ADMINISTRATIVO', label: 'ADMINISTRATIVO' },
      { value: 'PATRULLA', label: 'PATRULLA' },
      { value: 'PARTICULAR', label: 'PARTICULAR' },
      { value: 'OTRO', label: 'OTRO' },
    ],
  },
  vehicleClass: {
    label: 'Clase de vehiculo',
    allowsCustom: false,
    options: [
      { value: 'AUTOMOVIL', label: 'AUTOMOVIL' },
      { value: 'CAMIONETA', label: 'CAMIONETA' },
      { value: 'SEDAN', label: 'SEDAN' },
      { value: 'PICK UP', label: 'PICK UP' },
      { value: 'MOTOCICLETA', label: 'MOTOCICLETA' },
      { value: 'GRUA', label: 'GRUA' },
      { value: 'BICICLETA', label: 'BICICLETA' },
      { value: 'MICROBUS', label: 'MICROBUS' },
    ],
  },
  physicalStatus: {
    label: 'Estado fisico',
    allowsCustom: false,
    options: [
      { value: 'BUENO', label: 'BUENO' },
      { value: 'REGULAR', label: 'REGULAR' },
      { value: 'MALO', label: 'MALO' },
    ],
  },
  status: {
    label: 'Estatus',
    allowsCustom: true,
    options: [
      { value: 'ACTIVO', label: 'ACTIVO' },
      { value: 'INCATIVO', label: 'INCATIVO' },
      { value: 'SINIESTRADO', label: 'SINIESTRADO' },
      { value: 'PARA BAJA', label: 'PARA BAJA' },
      { value: 'OTRO', label: 'OTRO' },
    ],
  },
  assetClassification: {
    label: 'Clasificacion del bien',
    allowsCustom: true,
    options: [
      { value: 'PATRIMONIAL', label: 'PATRIMONIAL' },
      { value: 'ARRENDAMIENTO', label: 'ARRENDAMIENTO' },
      { value: 'OTRO', label: 'OTRO' },
    ],
  },
} as const;
