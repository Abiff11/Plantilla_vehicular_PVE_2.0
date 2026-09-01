import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import type {
  Delegation,
  RecordFieldCatalog,
  RecordFieldCatalogMap,
  RecordFormValues,
  Region,
  VehicleEditFormValues,
} from '../types';

const MAX_PHOTOS = 3;
const MAX_PHOTO_SIZE = 5 * 1024 * 1024;
const ALLOWED_PHOTO_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

const requiredText = z.string().trim().min(1, 'Campo obligatorio.');
const optionalText = z.string();

const schema = z
  .object({
    delegationId: requiredText,
    civ: optionalText,
    previousPlates: optionalText,
    plates2024: optionalText,
    plates2025: optionalText,
    plates2026: optionalText,
    patrolNumber: requiredText,
    vehicleClass: requiredText,
    useType: requiredText,
    useTypeCustom: optionalText,
    brand: requiredText,
    type: requiredText,
    model: requiredText,
    cylinders: optionalText,
    fuelCapacityLiters: optionalText,
    engineNumber: requiredText,
    serialNumber: requiredText,
    color: optionalText,
    custodian: optionalText,
    adscription: requiredText,
    realLocation: optionalText,
    physicalStatus: requiredText,
    status: requiredText,
    statusCustom: optionalText,
    assetClassification: requiredText,
    assetClassificationCustom: optionalText,
    observation: optionalText,
  })
  .superRefine((values, context) => {
    const customCatalogFields = [
      ['useType', 'useTypeCustom'],
      ['status', 'statusCustom'],
      ['assetClassification', 'assetClassificationCustom'],
    ] as const;

    for (const [fieldName, customFieldName] of customCatalogFields) {
      if (values[fieldName] === 'OTRO' && !values[customFieldName]?.trim()) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Captura el valor personalizado.',
          path: [customFieldName],
        });
      }
    }
  });

type RecordFormData = z.infer<typeof schema>;

type CompleteRecordFormValues = RecordFormValues &
  Pick<
    VehicleEditFormValues,
    | 'civ'
    | 'previousPlates'
    | 'plates2024'
    | 'plates2025'
    | 'plates2026'
    | 'cylinders'
    | 'fuelCapacityLiters'
    | 'color'
    | 'adscription'
    | 'realLocation'
  >;

type ExtendedRecordFieldCatalogMap = RecordFieldCatalogMap &
  Record<'brand' | 'type' | 'color' | 'adscription' | 'realLocation', RecordFieldCatalog>;

type PhotoFile = {
  file: File;
  preview: string;
};

type RecordFormProps = {
  delegations?: Delegation[];
  regions?: Region[];
  fieldCatalogs: RecordFieldCatalogMap;
  initialValues?: RecordFormValues;
  mode?: 'create' | 'edit';
  delegationSelectionMode?: 'fixed' | 'select';
  onSubmit: (values: CompleteRecordFormValues, photos: File[]) => Promise<void>;
  onCancel?: () => void;
};

const emptyFormValues: RecordFormData = {
  delegationId: '',
  civ: '',
  previousPlates: '',
  plates2024: '',
  plates2025: '',
  plates2026: '',
  patrolNumber: '',
  vehicleClass: '',
  useType: '',
  useTypeCustom: '',
  brand: '',
  type: '',
  model: '',
  cylinders: '',
  fuelCapacityLiters: '',
  engineNumber: '',
  serialNumber: '',
  color: '',
  custodian: '',
  adscription: '',
  realLocation: '',
  physicalStatus: '',
  status: '',
  statusCustom: '',
  assetClassification: '',
  assetClassificationCustom: '',
  observation: '',
};

function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, ' ');
}

function normalizeUpper(value: string) {
  return normalizeText(value).toUpperCase();
}

function normalizeCode(value: string) {
  return normalizeUpper(value).replace(/\s+/g, '');
}

function normalizeCatalogValue(
  selectedValue: string,
  customValue: string | undefined,
  allowsCustom: boolean,
) {
  if (allowsCustom && selectedValue === 'OTRO') {
    return normalizeUpper(customValue ?? '');
  }

  return normalizeUpper(selectedValue);
}

function toFormDefaults(initialValues?: RecordFormValues): RecordFormData {
  return {
    ...emptyFormValues,
    ...initialValues,
  };
}

function toSubmitValues(
  values: RecordFormData,
  fieldCatalogs: ExtendedRecordFieldCatalogMap,
): CompleteRecordFormValues {
  const previousPlates = normalizeCode(values.previousPlates);
  const plates2024 = normalizeCode(values.plates2024);
  const plates2025 = normalizeCode(values.plates2025);
  const plates2026 = normalizeCode(values.plates2026);
  const plates = plates2026 || plates2025 || plates2024 || previousPlates || '';

  return {
    delegationId: values.delegationId,
    plates,
    civ: normalizeCode(values.civ),
    previousPlates,
    plates2024,
    plates2025,
    plates2026,
    patrolNumber: normalizeCode(values.patrolNumber),
    vehicleClass: normalizeUpper(values.vehicleClass),
    useType: normalizeCatalogValue(
      values.useType,
      values.useTypeCustom,
      fieldCatalogs.useType.allowsCustom,
    ),
    brand: normalizeUpper(values.brand),
    type: normalizeUpper(values.type),
    model: normalizeUpper(values.model),
    cylinders: normalizeUpper(values.cylinders),
    fuelCapacityLiters: normalizeUpper(values.fuelCapacityLiters),
    engineNumber: normalizeCode(values.engineNumber),
    serialNumber: normalizeCode(values.serialNumber),
    color: normalizeUpper(values.color),
    custodian: normalizeUpper(values.custodian),
    adscription: normalizeUpper(values.adscription),
    realLocation: normalizeUpper(values.realLocation),
    physicalStatus: normalizeUpper(values.physicalStatus),
    status: normalizeCatalogValue(
      values.status,
      values.statusCustom,
      fieldCatalogs.status.allowsCustom,
    ),
    assetClassification: normalizeCatalogValue(
      values.assetClassification,
      values.assetClassificationCustom,
      fieldCatalogs.assetClassification.allowsCustom,
    ),
    observation: normalizeText(values.observation),
  };
}

function RequiredMark() {
  return <strong aria-hidden="true"> *</strong>;
}

export function RecordForm({
  delegations = [],
  regions = [],
  fieldCatalogs,
  initialValues,
  mode = 'create',
  delegationSelectionMode = 'fixed',
  onSubmit,
  onCancel,
}: RecordFormProps) {
  const catalogs = fieldCatalogs as ExtendedRecordFieldCatalogMap;
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<RecordFormData>({
    resolver: zodResolver(schema),
    defaultValues: toFormDefaults(initialValues),
  });

  const [photos, setPhotos] = useState<PhotoFile[]>([]);
  const [photoErrors, setPhotoErrors] = useState<string[]>([]);
  const [selectedRegionId, setSelectedRegionId] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const photosRef = useRef<PhotoFile[]>([]);

  const selectedUseType = watch('useType');
  const selectedStatus = watch('status');
  const selectedAssetClassification = watch('assetClassification');
  const selectedDelegationId = watch('delegationId');
  const usesRegionDelegationCascade = delegationSelectionMode === 'select' && regions.length > 0;
  const selectedRegion = regions.find((region) => region.id === selectedRegionId) ?? null;
  const selectableDelegations = usesRegionDelegationCascade
    ? selectedRegion?.delegations ?? []
    : delegations;
  const selectedDelegation = selectableDelegations.find(
    (delegation) => delegation.id === selectedDelegationId,
  );
  const currentDelegationLabel =
    selectedDelegation?.name ?? delegations[0]?.name ?? 'Pendiente de selección';

  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);

  useEffect(() => {
    return () => {
      photosRef.current.forEach((photo) => URL.revokeObjectURL(photo.preview));
    };
  }, []);

  useEffect(() => {
    if (initialValues) {
      reset(toFormDefaults(initialValues));

      if (usesRegionDelegationCascade) {
        const initialRegion = regions.find((region) =>
          region.delegations.some((delegation) => delegation.id === initialValues.delegationId),
        );
        setSelectedRegionId(initialRegion?.id ?? '');
      }
      return;
    }

    if (delegationSelectionMode !== 'fixed' || !delegations.length) {
      return;
    }

    setValue('delegationId', delegations[0].id, {
      shouldValidate: true,
      shouldDirty: false,
    });
  }, [
    delegationSelectionMode,
    delegations,
    initialValues,
    regions,
    reset,
    setValue,
    usesRegionDelegationCascade,
  ]);

  const handleRegionChange = (regionId: string) => {
    setSelectedRegionId(regionId);
    setValue('delegationId', '', {
      shouldValidate: false,
      shouldDirty: true,
    });
  };

  const handlePhotoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    const remaining = MAX_PHOTOS - photos.length;
    if (remaining <= 0) {
      setPhotoErrors(['Límite de 3 fotos alcanzado. Elimina una para agregar otra.']);
      return;
    }

    const rejectionReasons: string[] = [];
    const validFiles = files.filter((file) => {
      if (!ALLOWED_PHOTO_TYPES.includes(file.type)) {
        rejectionReasons.push(`${file.name}: tipo no permitido (solo JPG, JPEG, PNG, WEBP).`);
        return false;
      }

      if (file.size > MAX_PHOTO_SIZE) {
        const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
        rejectionReasons.push(`${file.name}: excede 5MB (${sizeMb}MB).`);
        return false;
      }

      return true;
    });

    const accepted = validFiles.slice(0, remaining);
    if (accepted.length < validFiles.length) {
      rejectionReasons.push(
        `Se omitieron ${validFiles.length - accepted.length} foto(s) por exceder el límite de ${MAX_PHOTOS}.`,
      );
    }

    setPhotoErrors(rejectionReasons);
    if (accepted.length === 0) {
      return;
    }

    setPhotos((currentPhotos) => [
      ...currentPhotos,
      ...accepted.map((file) => ({
        file,
        preview: URL.createObjectURL(file),
      })),
    ]);
  };

  const removePhoto = (index: number) => {
    setPhotos((currentPhotos) => {
      const removed = currentPhotos[index];
      if (removed) {
        URL.revokeObjectURL(removed.preview);
      }
      return currentPhotos.filter((_, photoIndex) => photoIndex !== index);
    });
    setPhotoErrors([]);
  };

  const renderCatalogField = (
    fieldName: 'useType' | 'vehicleClass' | 'physicalStatus' | 'status' | 'assetClassification',
    required = false,
  ) => {
    const catalog = catalogs[fieldName];
    const selectedValue =
      fieldName === 'useType'
        ? selectedUseType
        : fieldName === 'status'
          ? selectedStatus
          : fieldName === 'assetClassification'
            ? selectedAssetClassification
            : watch(fieldName);
    const customFieldName =
      fieldName === 'useType'
        ? 'useTypeCustom'
        : fieldName === 'status'
          ? 'statusCustom'
          : fieldName === 'assetClassification'
            ? 'assetClassificationCustom'
            : null;

    return (
      <div className="field" key={fieldName}>
        <span>
          {catalog.label}
          {required && <RequiredMark />}
        </span>
        <select {...register(fieldName)}>
          <option value="">Selecciona una opción</option>
          {catalog.options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {errors[fieldName] && <small>{errors[fieldName]?.message}</small>}

        {customFieldName && catalog.allowsCustom && selectedValue === 'OTRO' && (
          <>
            <input
              placeholder={`Especifica ${catalog.label.toLowerCase()}`}
              {...register(customFieldName)}
            />
            {errors[customFieldName] && <small>{errors[customFieldName]?.message}</small>}
          </>
        )}
      </div>
    );
  };

  const renderSimpleCatalogField = (
    fieldName: 'brand' | 'type' | 'color' | 'adscription' | 'realLocation',
    required = false,
  ) => {
    const catalog = catalogs[fieldName];

    return (
      <label className="field" key={fieldName}>
        <span>
          {catalog.label}
          {required && <RequiredMark />}
        </span>
        <select {...register(fieldName)}>
          <option value="">Selecciona una opción</option>
          {catalog.options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {errors[fieldName] && <small>{errors[fieldName]?.message}</small>}
      </label>
    );
  };

  return (
    <form
      className="panel stack-md"
      onSubmit={handleSubmit(async (values) => {
        const photoFiles = photos.map((photo) => photo.file);
        await onSubmit(toSubmitValues(values, catalogs), photoFiles);

        if (mode === 'create') {
          photos.forEach((photo) => URL.revokeObjectURL(photo.preview));
          reset({
            ...emptyFormValues,
            delegationId:
              delegationSelectionMode === 'fixed' ? delegations[0]?.id ?? '' : '',
          });
          if (usesRegionDelegationCascade) {
            setSelectedRegionId('');
          }
          setPhotos([]);
          setPhotoErrors([]);
        }
      })}
    >
      <div className="panel-header">
        <div>
          <p className="eyebrow">Formulario</p>
          <h2>{mode === 'edit' ? 'Editar captura' : 'Nueva captura'}</h2>
          <small>Los campos marcados con * son obligatorios.</small>
        </div>
      </div>

      <section className="panel stack-md">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Ubicación administrativa</p>
            <h3>Región, delegación y adscripción</h3>
          </div>
        </div>

        <div className="form-grid">
          {delegationSelectionMode === 'select' ? (
            usesRegionDelegationCascade ? (
              <>
                <label className="field">
                  <span>Región<RequiredMark /></span>
                  <select
                    value={selectedRegionId}
                    required
                    onChange={(event) => handleRegionChange(event.target.value)}
                  >
                    <option value="">Selecciona una región</option>
                    {regions.map((region) => (
                      <option key={region.id} value={region.id}>
                        {region.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field">
                  <span>Delegación<RequiredMark /></span>
                  <select {...register('delegationId')} disabled={!selectedRegionId}>
                    <option value="">
                      {selectedRegionId
                        ? 'Selecciona una delegación'
                        : 'Selecciona primero una región'}
                    </option>
                    {selectableDelegations.map((delegation) => (
                      <option key={delegation.id} value={delegation.id}>
                        {delegation.name}
                      </option>
                    ))}
                  </select>
                  {errors.delegationId && <small>{errors.delegationId.message}</small>}
                </label>
              </>
            ) : (
              <label className="field">
                <span>Delegación<RequiredMark /></span>
                <select {...register('delegationId')}>
                  <option value="">Selecciona una delegación</option>
                  {delegations.map((delegation) => (
                    <option key={delegation.id} value={delegation.id}>
                      {delegation.name}
                    </option>
                  ))}
                </select>
                {errors.delegationId && <small>{errors.delegationId.message}</small>}
              </label>
            )
          ) : (
            <label className="field">
              <span>Delegación<RequiredMark /></span>
              <input disabled readOnly value={delegations[0]?.name ?? 'Sin delegación asignada'} />
              <input type="hidden" {...register('delegationId')} />
              {errors.delegationId && <small>{errors.delegationId.message}</small>}
            </label>
          )}

          {renderSimpleCatalogField('adscription', true)}
        </div>

        <label className="field field-full">
          <span>Resguardante</span>
          <input {...register('custodian')} />
        </label>
      </section>

      <section className="panel stack-md">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Identificación y placas</p>
            <h3>Identificadores de la unidad</h3>
          </div>
        </div>
        <div className="form-grid">
          <label className="field">
            <span>No. patrulla<RequiredMark /></span>
            <input {...register('patrolNumber')} />
            {errors.patrolNumber && <small>{errors.patrolNumber.message}</small>}
          </label>
          <label className="field">
            <span>CIV</span>
            <input {...register('civ')} />
          </label>
          <label className="field">
            <span>Placas anteriores</span>
            <input {...register('previousPlates')} />
          </label>
          <label className="field">
            <span>Placas 2024</span>
            <input {...register('plates2024')} />
          </label>
          <label className="field">
            <span>Placas 2025</span>
            <input {...register('plates2025')} />
          </label>
          <label className="field">
            <span>Placas 2026</span>
            <input {...register('plates2026')} />
          </label>
        </div>
      </section>

      <section className="panel stack-md">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Características</p>
            <h3>Datos técnicos de la unidad</h3>
          </div>
        </div>
        <div className="form-grid">
          {renderCatalogField('vehicleClass', true)}
          {renderCatalogField('useType', true)}
          {renderSimpleCatalogField('brand', true)}
          {renderSimpleCatalogField('type', true)}
          <label className="field">
            <span>Modelo<RequiredMark /></span>
            <input {...register('model')} />
            {errors.model && <small>{errors.model.message}</small>}
          </label>
          <label className="field">
            <span>Cilindros</span>
            <input {...register('cylinders')} />
          </label>
          <label className="field">
            <span>Capacidad litros</span>
            <input {...register('fuelCapacityLiters')} />
          </label>
          <label className="field">
            <span>Número de motor<RequiredMark /></span>
            <input {...register('engineNumber')} />
            {errors.engineNumber && <small>{errors.engineNumber.message}</small>}
          </label>
          <label className="field">
            <span>Número de serie<RequiredMark /></span>
            <input {...register('serialNumber')} />
            {errors.serialNumber && <small>{errors.serialNumber.message}</small>}
          </label>
          {renderSimpleCatalogField('color')}
        </div>
      </section>

      <section className="panel stack-md">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Asignación y estado</p>
            <h3>Situación operativa</h3>
          </div>
        </div>
        <div className="form-grid">
          {renderSimpleCatalogField('realLocation')}
          <label className="field">
            <span>Delegación actual</span>
            <input disabled readOnly value={currentDelegationLabel} />
          </label>
          <label className="field">
            <span>Estado del registro</span>
            <input disabled readOnly value="VIGENTE" />
          </label>
          {renderCatalogField('physicalStatus', true)}
          {renderCatalogField('status', true)}
          {renderCatalogField('assetClassification', true)}
        </div>
        <small>
          La delegación consultada es un dato contextual del Kárdex y se determina automáticamente al consultar la unidad.
        </small>
      </section>

      <section className="panel stack-md">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Anotación general</p>
            <h3>Observaciones</h3>
          </div>
        </div>
        <label className="field">
          <span>Anotación general</span>
          <textarea rows={4} {...register('observation')} />
        </label>
      </section>

      {mode === 'create' && (
        <section className="panel stack-md">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Expediente fotográfico</p>
              <h3>Fotografías de la unidad</h3>
            </div>
          </div>
          <div className="field">
            <span>Fotos (opcional, máximo 3)</span>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp"
              multiple
              onChange={handlePhotoChange}
              disabled={photos.length >= MAX_PHOTOS}
            />
            <small>JPG, JPEG, PNG o WEBP. Máximo 5MB por archivo.</small>
            {photoErrors.length > 0 && (
              <small className="photo-error" style={{ color: '#dc2626' }}>
                {photoErrors.map((error) => (
                  <span key={error}>{error} </span>
                ))}
              </small>
            )}
            {photos.length >= MAX_PHOTOS && <small>Límite de fotos alcanzado (3).</small>}
            {photos.length > 0 && (
              <div className="photo-preview-grid">
                {photos.map((photo, index) => (
                  <div key={`${photo.file.name}-${index}`} className="photo-preview-item">
                    <img src={photo.preview} alt={photo.file.name} />
                    <button
                      type="button"
                      className="photo-remove-btn"
                      onClick={() => removePhoto(index)}
                    >
                      X
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      <div className="form-actions">
        {onCancel && (
          <button className="ghost-button" disabled={isSubmitting} type="button" onClick={onCancel}>
            Cancelar
          </button>
        )}
        <button className="primary-button" disabled={isSubmitting} type="submit">
          {isSubmitting
            ? 'Guardando...'
            : mode === 'edit'
              ? 'Guardar cambios'
              : 'Guardar captura'}
        </button>
      </div>
    </form>
  );
}
