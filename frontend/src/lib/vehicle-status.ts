export function resolveVehicleStatusTone(status: string): string {
  const normalizedStatus = status.trim().toUpperCase();

  if (normalizedStatus === 'ACTIVO') return 'is-success';
  if (normalizedStatus === 'INACTIVO' || normalizedStatus === 'INCATIVO') return 'is-muted';
  if (normalizedStatus === 'SINIESTRADO') return 'is-danger';
  if (normalizedStatus === 'PARA BAJA') return 'is-warning';
  if (normalizedStatus === 'OTRO') return 'is-info';

  return 'is-neutral';
}


export function resolveVehiclePhysicalStatusTone(physicalStatus: string): string {
  const normalizedStatus = physicalStatus.trim().toUpperCase();

  if (normalizedStatus === 'BUENO') return 'is-success';
  if (normalizedStatus === 'REGULAR') return 'is-warning';
  if (normalizedStatus === 'MALO') return 'is-danger';
  if (normalizedStatus === 'OTRO') return 'is-info';

  return 'is-neutral';
}

