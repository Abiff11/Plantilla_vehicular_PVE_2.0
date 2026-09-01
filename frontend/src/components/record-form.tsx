import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import type { Delegation, RecordFieldCatalogMap, RecordFormValues } from '../types';

const customCatalogFields = ['useType', 'status', 'assetClassification'] as const;
const MAX_PHOTOS = 3;
const MAX_PHOTO_SIZE = 5 * 1024 * 1024;
const ALLOWED_PHOTO_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

const schema = z
  .object({
    delegationId: z.string().min(1),
    plates: z.string().min(1),
    brand: z.string().min(1),
    type: z.string().min(1),
    useType: z.string().min(1),
    useTypeCustom: z.string().optional(),
    vehicleClass: z.string().min(1),
    model: z.string().min(1),
    engineNumber: z.string().min(1),
    serialNumber: z.string().min(1),
    custodian: z.string().min(1),
    patrolNumber: z.string().min(1),
    physicalStatus: z.string().min(1),
    status: z.string().min(1),
    statusCustom: z.string().optional(),
    assetClassification: z.string().min(1),
    assetClassificationCustom: z.string().optional(),
    observation: z.string(),
  })
  .superRefine((values, context) => {
    for (const fieldName of customCatalogFields) {
      const customFieldName = `${fieldName}Custom` as const;

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

type PhotoFile = {
  file: File;
  preview: string;
};

type RecordFormProps = {
  delegations: Delegation[];
  fieldCatalogs: RecordFieldCatalogMap;
  initialValues?: RecordFormValues;
  mode?: 'create' | 'edit';
  delegationSelectionMode?: 'fixed' | 'select';
  onSubmit: (values: RecordFormValues, photos: File[]) => Promise<void>;
  onCancel?: () => void;
};

const textFields = [
  ['plates', 'Placas'],
  ['brand', 'Marca'],
  ['type', 'Tipo'],
  ['model', 'Modelo'],
  ['engineNumber', 'No. de motor'],
  ['serialNumber', 'No. de serie'],
  ['custodian', 'Resguardante'],
  ['patrolNumber', 'No. patrulla'],
] as const;

const catalogFields = [
  ['useType', 'Uso'],
  ['vehicleClass', 'Clase de vehiculo'],
  ['physicalStatus', 'Estado fisico'],
  ['status', 'Estatus'],
  ['assetClassification', 'Clasificacion del bien'],
] as const;

function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, ' ');
}

function normalizeUpper(value: string) {
  return normalizeText(value).toUpperCase();
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

const emptyFormValues = {
  delegationId: '',
  plates: '',
  brand: '',
  type: '',
  useType: '',
  useTypeCustom: '',
  vehicleClass: '',
  model: '',
  engineNumber: '',
  serialNumber: '',
  custodian: '',
  patrolNumber: '',
  physicalStatus: '',
  status: '',
  statusCustom: '',
  assetClassification: '',
  assetClassificationCustom: '',
  observation: '',
};

function toFormDefaults(initialValues?: RecordFormValues): RecordFormData {
  return {
    ...emptyFormValues,
    ...initialValues,
  };
}

function toSubmitValues(
  values: RecordFormData,
  fieldCatalogs: RecordFieldCatalogMap,
): RecordFormValues {
  return {
    delegationId: values.delegationId,
    plates: normalizeUpper(values.plates),
    brand: normalizeUpper(values.brand),
    type: normalizeUpper(values.type),
    useType: normalizeCatalogValue(
      values.useType,
      values.useTypeCustom,
      fieldCatalogs.useType.allowsCustom,
    ),
    vehicleClass: normalizeUpper(values.vehicleClass),
    model: normalizeUpper(values.model),
    engineNumber: normalizeUpper(values.engineNumber),
    serialNumber: normalizeUpper(values.serialNumber),
    custodian: normalizeUpper(values.custodian),
    patrolNumber: normalizeUpper(values.patrolNumber),
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

export function RecordForm({
  delegations,
  fieldCatalogs,
  initialValues,
  mode = 'create',
  delegationSelectionMode = 'fixed',
  onSubmit,
  onCancel,
}: RecordFormProps) {
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedUseType = watch('useType');
  const selectedStatus = watch('status');
  const selectedAssetClassification = watch('assetClassification');

  useEffect(() => {
    if (initialValues) {
      reset(toFormDefaults(initialValues));
      return;
    }

    if (delegationSelectionMode !== 'fixed' || !delegations.length) {
      return;
    }

    setValue('delegationId', delegations[0].id, {
      shouldValidate: true,
      shouldDirty: false,
    });
  }, [delegationSelectionMode, delegations, initialValues, reset, setValue]);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    const remaining = MAX_PHOTOS - photos.length;

    if (remaining <= 0) {
      setPhotoErrors(['Limite de 3 fotos alcanzado. Elimina una para agregar otra.']);
      return;
    }

    const rejectionReasons: string[] = [];

    const validFiles = files.filter((file) => {
      if (!ALLOWED_PHOTO_TYPES.includes(file.type)) {
        rejectionReasons.push(`${file.name}: tipo no permitido (solo JPG, JPEG, PNG, WEBP).`);
        return false;
      }
      if (file.size > MAX_PHOTO_SIZE) {
        const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
        rejectionReasons.push(`${file.name}: excede 5MB (${sizeMB}MB).`);
        return false;
      }
      return true;
    });

    const accepted = validFiles.slice(0, remaining);

    if (accepted.length < validFiles.length) {
      rejectionReasons.push(
        `Se omitieron ${validFiles.length - accepted.length} foto(s) por exceder el limite de ${MAX_PHOTOS}.`,
      );
    }

    if (rejectionReasons.length > 0) {
      setPhotoErrors(rejectionReasons);
    } else {
      setPhotoErrors([]);
    }

    if (accepted.length === 0) return;

    const newFiles = accepted.map((file) => ({
      file,
      preview: URL.createObjectURL(file),
    }));

    setPhotos((prev) => [...prev, ...newFiles]);
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => {
      const removed = prev[index];
      if (removed) {
        URL.revokeObjectURL(removed.preview);
      }
      return prev.filter((_, i) => i !== index);
    });
    setPhotoErrors([]);
  };

  useEffect(() => {
    return () => {
      photos.forEach((p) => URL.revokeObjectURL(p.preview));
    };
  }, [photos]);

  return (
    <form
      className="panel stack-md"
      onSubmit={handleSubmit(async (values) => {
        const photoFiles = photos.map((p) => p.file);
        const submitValues = toSubmitValues(values, fieldCatalogs);
        await onSubmit(submitValues, photoFiles);

        if (mode === 'create') {
          reset({
            ...emptyFormValues,
            delegationId:
              delegationSelectionMode === 'fixed' ? delegations[0]?.id ?? '' : '',
          });
          setPhotos([]);
          setPhotoErrors([]);
        }
      })}
    >
      <div className="panel-header">
        <div>
          <p className="eyebrow">Formulario</p>
          <h2>{mode === 'edit' ? 'Editar captura' : 'Nueva captura'}</h2>
        </div>
      </div>

      <label className="field">
        <span>Delegacion</span>
        {delegationSelectionMode === 'select' ? (
          <select {...register('delegationId')}>
            <option value="">Selecciona una delegacion</option>
            {delegations.map((delegation) => (
              <option key={delegation.id} value={delegation.id}>
                {delegation.name}
              </option>
            ))}
          </select>
        ) : (
          <>
            <input
              disabled
              readOnly
              value={delegations[0]?.name ?? 'Sin delegacion asignada'}
            />
            <input type="hidden" {...register('delegationId')} />
          </>
        )}
        {errors.delegationId && <small>{errors.delegationId.message}</small>}
      </label>

      <div className="form-grid">
        {textFields.map(([fieldName, label]) => (
          <label className="field" key={fieldName}>
            <span>{label}</span>
            <input {...register(fieldName)} />
            {errors[fieldName] && <small>{errors[fieldName]?.message}</small>}
          </label>
        ))}

        {catalogFields.map(([fieldName, fallbackLabel]) => {
          const catalog = fieldCatalogs[fieldName];
          const customFieldName = `${fieldName}Custom` as
            | 'useTypeCustom'
            | 'statusCustom'
            | 'assetClassificationCustom';
          const selectedValue =
            fieldName === 'useType'
              ? selectedUseType
              : fieldName === 'status'
                ? selectedStatus
                : fieldName === 'assetClassification'
                  ? selectedAssetClassification
                  : '';

          return (
            <div className="field" key={fieldName}>
              <span>{catalog?.label ?? fallbackLabel}</span>
              <select {...register(fieldName)}>
                <option value="">Selecciona una opcion</option>
                {catalog.options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {errors[fieldName] && <small>{errors[fieldName]?.message}</small>}

              {catalog.allowsCustom && selectedValue === 'OTRO' && (
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
        })}

        <label className="field field-full">
          <span>Observacion</span>
          <textarea rows={4} {...register('observation')} />
        </label>

        {mode === 'create' && (
          <div className="field field-full">
            <span>Fotos (opcional, maximo 3)</span>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp"
              multiple
              onChange={handlePhotoChange}
              disabled={photos.length >= MAX_PHOTOS}
            />
            <small>JPG, JPEG, PNG o WEBP. Maximo 5MB por archivo.</small>
            {photoErrors.length > 0 && (
              <small className="photo-error" style={{ color: '#dc2626' }}>
                {photoErrors.map((err, i) => (
                  <span key={i}>{err}{' '}</span>
                ))}
              </small>
            )}
            {photos.length >= MAX_PHOTOS && (
              <small>Limite de fotos alcanzado (3)</small>
            )}
            {photos.length > 0 && (
              <div className="photo-preview-grid">
                {photos.map((photo, index) => (
                  <div key={index} className="photo-preview-item">
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
        )}
      </div>

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
