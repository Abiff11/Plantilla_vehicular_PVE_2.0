import Swal from "sweetalert2";
import { api } from "../../lib/api";
import { formatDateMx, formatDateTimeMx } from "../../lib/date-format";
import { formatUserName } from "../../lib/format-user-name";
import { resolveConfiguredNetworkUrl } from "../../lib/resolve-network-url";
import { resolveVehicleDisplayPlate } from "../../lib/vehicle-plates";
import type { Region, VehicleEditEvent, VehiclePhoto, VehicleRecord, VehicleTransferEvent } from "../../types";

export type RecordDetailsAction = "closed" | "edit";

type OpenRecordDetailsOptions = {
  canEdit?: boolean;
  editButtonText?: string;
};

function resolveApiBaseUrl() {
  const configuredUrl = resolveConfiguredNetworkUrl(import.meta.env.VITE_API_URL, "/api");

  if (configuredUrl) {
    const apiBaseUrl = configuredUrl.replace(/\/api$/, "");
    return apiBaseUrl || (typeof window === "undefined" ? "" : window.location.origin);
  }

  if (typeof window === "undefined") {
    return "http://localhost:3101";
  }

  return window.location.origin;
}

const API_BASE_URL = resolveApiBaseUrl();

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderVehicleDetailField(label: string, value: unknown) {
  return `
    <div class="vehicle-detail-field">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value || "-")}</strong>
    </div>
  `;
}

function renderTransferLine(transfer: VehicleTransferEvent) {
  return `
    <div class="activity-item">
      <div class="activity-item-head">
        <strong>${escapeHtml(transfer.fromDelegation.name)} -> ${escapeHtml(transfer.toDelegation.name)}</strong>
        <span>${formatDateTimeMx(transfer.movedAt)}</span>
      </div>
      <p>Hecho por ${escapeHtml(formatUserName(transfer.movedBy))}.</p>
      <span>${escapeHtml(transfer.reason || "Sin motivo registrado.")}</span>
    </div>
  `;
}

function renderEditLine(edit: VehicleEditEvent) {
  const changes =
    edit.changedFields.length > 0
      ? edit.changedFields
          .map((fieldName) => {
            const beforeValue = escapeHtml(edit.before[fieldName] ?? "-");
            const afterValue = escapeHtml(edit.after[fieldName] ?? "-");

            return `<div><strong>${escapeHtml(fieldName)}</strong>: ${beforeValue} -> ${afterValue}</div>`;
          })
          .join("")
      : "<div>Sin detalle de cambios.</div>";

  return `
    <div class="activity-item">
      <div class="activity-item-head">
        <strong>Edicion registrada</strong>
        <span>${formatDateTimeMx(edit.editedAt)}</span>
      </div>
      <p>Hecho por ${escapeHtml(edit.actor ? formatUserName(edit.actor) : "Usuario no disponible")}.</p>
      <span>${changes}</span>
    </div>
  `;
}

function joinUrl(base: string, path: string) {
  const cleanedBase = base.replace(/\/+$/, "");
  const cleanedPath = path.replace(/^\/+/u, "");
  return `${cleanedBase}/${cleanedPath}`;
}

function resolvePhotoUrl(photo: VehiclePhoto) {
  const publicUrl = photo.publicUrl?.trim();
  const objectKey = photo.objectKey?.trim();
  const filePath = photo.filePath?.trim();

  if (publicUrl) {
    if (publicUrl.startsWith("http://") || publicUrl.startsWith("https://")) {
      return publicUrl;
    }

    if (publicUrl.startsWith("/uploads/")) {
      return joinUrl(API_BASE_URL, publicUrl);
    }

    if (!publicUrl.includes("/") && (publicUrl.includes(".") || publicUrl.length > 0)) {
      return joinUrl(API_BASE_URL, `/uploads/vehicle-photos/${publicUrl}`);
    }

    if (publicUrl.startsWith("/")) {
      return joinUrl(API_BASE_URL, publicUrl);
    }

    return joinUrl(API_BASE_URL, `/uploads/vehicle-photos/${publicUrl}`);
  }

  if (objectKey) {
    return joinUrl(API_BASE_URL, `/uploads/${objectKey}`);
  }

  if (filePath) {
    return joinUrl(API_BASE_URL, `/uploads/vehicle-photos/${filePath}`);
  }

  return "";
}

function renderPhotoThumbnail(photo: VehiclePhoto) {
  const photoUrl = escapeHtml(resolvePhotoUrl(photo));
  const photoName = escapeHtml(photo.fileName);

  return `
    <div class="photo-thumb" data-photo-url="${photoUrl}" data-photo-name="${photoName}">
      <img src="${photoUrl}" alt="${photoName}" onerror="this.style.display='none';this.nextElementSibling.style.display='grid';" />
      <div class="photo-fallback" style="display:none;">Imagen no disponible</div>
    </div>
  `;
}

export function getRecordActivitySummary(record: VehicleRecord) {
  const parts = [];

  if (record.recordState === "TRANSFERRED_OUT" && record.latestTransfer) {
    parts.push(`Trasladado a ${record.latestTransfer.toDelegation.name}`);
  } else if (record.latestTransfer) {
    parts.push(`Recibido desde ${record.latestTransfer.fromDelegation.name}`);
  }

  if (record.latestEdit) {
    parts.push(`Editado el ${formatDateMx(record.latestEdit.editedAt)}`);
  }

  if (record.importBatchId) {
    parts.push("Importado desde Excel");
  }

  return parts.length > 0 ? parts.join(" · ") : "Sin movimientos recientes";
}

export async function openRecordDetails(
  record: VehicleRecord,
  options: OpenRecordDetailsOptions = {},
): Promise<RecordDetailsAction> {
  const displayPlates = resolveVehicleDisplayPlate(record);
  const vehicleIdentifier = record.patrolNumber || displayPlates;
  const canEdit = options.canEdit === true && record.recordState === "CURRENT";
  const historyCount = record.transferHistory.length + record.editHistory.length;

  const vehicleSummarySection = `
    <div class="activity-item vehicle-detail-summary">
      <div class="vehicle-detail-summary-top">
        <div>
          <span class="vehicle-detail-eyebrow">Kardex vehicular</span>
          <strong>${escapeHtml(record.patrolNumber || "Sin número de patrulla")}</strong>
        </div>
        <span class="record-chip is-info">${escapeHtml(displayPlates)}</span>
      </div>
      <div class="vehicle-detail-sections">
        <section class="vehicle-detail-section">
          <h5>Identificación y placas</h5>
          <div class="vehicle-detail-grid">
            ${renderVehicleDetailField("No. patrulla", record.patrolNumber)}
            ${renderVehicleDetailField("CIV", record.civ)}
            ${renderVehicleDetailField("Placas anteriores", record.previousPlates)}
            ${renderVehicleDetailField("Placas 2024", record.plates2024)}
            ${renderVehicleDetailField("Placas 2025", record.plates2025)}
            ${renderVehicleDetailField("Placas 2026", record.plates2026)}
          </div>
        </section>

        <section class="vehicle-detail-section">
          <h5>Características</h5>
          <div class="vehicle-detail-grid">
            ${renderVehicleDetailField("Clase", record.vehicleClass)}
            ${renderVehicleDetailField("Uso", record.useType)}
            ${renderVehicleDetailField("Marca", record.brand)}
            ${renderVehicleDetailField("Tipo", record.type)}
            ${renderVehicleDetailField("Modelo", record.model)}
            ${renderVehicleDetailField("Cilindros", record.cylinders)}
            ${renderVehicleDetailField("Capacidad litros", record.fuelCapacityLiters)}
            ${renderVehicleDetailField("Número de motor", record.engineNumber)}
            ${renderVehicleDetailField("Número de serie", record.serialNumber)}
            ${renderVehicleDetailField("Color", record.color)}
          </div>
        </section>

        <section class="vehicle-detail-section">
          <h5>Asignación y estado</h5>
          <div class="vehicle-detail-grid">
            ${renderVehicleDetailField("Resguardante", record.custodian)}
            ${renderVehicleDetailField("Adscripción", record.adscription)}
            ${renderVehicleDetailField("Ubicación real", record.realLocation)}
            ${renderVehicleDetailField("Delegación actual", record.delegation.name)}
            ${renderVehicleDetailField("Estado físico", record.physicalStatus)}
            ${renderVehicleDetailField("Estatus sistema", record.status)}
            ${renderVehicleDetailField("Estatus Excel", record.rawCirculationStatus)}
            ${renderVehicleDetailField("Clasificación del bien", record.assetClassification)}
            ${renderVehicleDetailField("Anotación general", record.rawAssetClassification)}
          </div>
        </section>
      </div>
    </div>
  `;

  const currentStateSection = `
    <div class="vehicle-detail-current-card">
      <div class="vehicle-detail-current-item">
        <span>Estado del registro</span>
        <strong>${escapeHtml(record.recordState === "CURRENT" ? "Vigente" : "Trasladado")}</strong>
      </div>
      <div class="vehicle-detail-current-item">
        <span>Delegación actual</span>
        <strong>${escapeHtml(record.delegation.name)}</strong>
      </div>
      <div class="vehicle-detail-current-item">
        <span>Delegación consultada</span>
        <strong>${escapeHtml(record.viewDelegation.name)}</strong>
      </div>
      <div class="vehicle-detail-current-item">
        <span>Placas visibles</span>
        <strong>${escapeHtml(displayPlates)}</strong>
      </div>
    </div>
  `;

  const transferHistory =
    record.transferHistory.length > 0
      ? record.transferHistory.map((transfer) => renderTransferLine(transfer)).join("")
      : '<div class="activity-item"><span>Sin traslados registrados.</span></div>';

  const editHistory =
    record.editHistory.length > 0
      ? record.editHistory.map((edit) => renderEditLine(edit)).join("")
      : '<div class="activity-item"><span>Sin ediciones registradas.</span></div>';

  const photosSection =
    record.photos && record.photos.length > 0
      ? `
        <div class="activity-item">
          <div class="activity-item-head">
            <strong>Fotos de la unidad</strong>
            <span>${record.photos.length} imagen(es)</span>
          </div>
          <div class="photo-gallery">
            ${record.photos.map((photo) => renderPhotoThumbnail(photo)).join("")}
          </div>
        </div>
      `
      : '<div class="activity-item"><span>Sin fotos cargadas.</span></div>';

  const result = await Swal.fire({
    title: `Kárdex vehicular · ${vehicleIdentifier}`,
    width: 900,
    confirmButtonText: canEdit ? (options.editButtonText ?? "Editar vehículo") : "Cerrar",
    showCancelButton: canEdit,
    cancelButtonText: "Cerrar",
    focusConfirm: false,
    customClass: {
      popup: "vehicle-detail-popup",
      confirmButton: canEdit ? "vehicle-detail-edit-primary" : undefined,
    },
    html: `
      <div class="vehicle-detail-tabs" role="tablist" aria-label="Secciones del kárdex vehicular">
        <button
          type="button"
          class="vehicle-detail-tab is-active"
          role="tab"
          aria-selected="true"
          aria-controls="vehicle-detail-panel-details"
          data-vehicle-tab="details"
        >
          Detalles del vehículo
        </button>
        <button
          type="button"
          class="vehicle-detail-tab"
          role="tab"
          aria-selected="false"
          aria-controls="vehicle-detail-panel-history"
          data-vehicle-tab="history"
          tabindex="-1"
        >
          Historial
          <span class="vehicle-detail-tab-count">${historyCount}</span>
        </button>
      </div>

      <div
        id="vehicle-detail-panel-details"
        class="vehicle-detail-tab-panel is-active"
        role="tabpanel"
        data-vehicle-tab-panel="details"
      >
        <div class="vehicle-detail-primary-stack">
          ${vehicleSummarySection}
          ${currentStateSection}
          ${photosSection}
        </div>
      </div>

      <div
        id="vehicle-detail-panel-history"
        class="vehicle-detail-tab-panel"
        role="tabpanel"
        data-vehicle-tab-panel="history"
        hidden
      >
        <div class="vehicle-detail-history-stack">
          <section class="vehicle-detail-history-section">
            <div class="vehicle-detail-history-header">
              <div class="vehicle-detail-history-heading">
                <strong>Historial de traslados</strong>
                <span>Cambios de delegación registrados para esta unidad.</span>
              </div>
              <span class="vehicle-detail-history-count">${record.transferHistory.length}</span>
            </div>
            <div class="vehicle-detail-history-body">
              ${transferHistory}
            </div>
          </section>

          <section class="vehicle-detail-history-section">
            <div class="vehicle-detail-history-header">
              <div class="vehicle-detail-history-heading">
                <strong>Historial de ediciones</strong>
                <span>Modificaciones realizadas sobre los datos del vehículo.</span>
              </div>
              <span class="vehicle-detail-history-count">${record.editHistory.length}</span>
            </div>
            <div class="vehicle-detail-history-body">
              ${editHistory}
            </div>
          </section>
        </div>
      </div>
    `,
    didOpen: () => {
      const popup = Swal.getPopup();

      if (!popup) {
        return;
      }

      const tabButtons = Array.from(
        popup.querySelectorAll<HTMLButtonElement>("[data-vehicle-tab]"),
      );
      const tabPanels = Array.from(
        popup.querySelectorAll<HTMLElement>("[data-vehicle-tab-panel]"),
      );

      const activateTab = (tabName: string) => {
        tabButtons.forEach((button) => {
          const isActive = button.dataset.vehicleTab === tabName;
          button.classList.toggle("is-active", isActive);
          button.setAttribute("aria-selected", String(isActive));
          button.tabIndex = isActive ? 0 : -1;
        });

        tabPanels.forEach((panel) => {
          const isActive = panel.dataset.vehicleTabPanel === tabName;
          panel.classList.toggle("is-active", isActive);
          panel.hidden = !isActive;
        });
      };

      tabButtons.forEach((button, index) => {
        button.addEventListener("click", () => {
          activateTab(button.dataset.vehicleTab ?? "details");
        });

        button.addEventListener("keydown", (event) => {
          if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
            return;
          }

          event.preventDefault();

          let targetIndex = index;

          if (event.key === "ArrowLeft") {
            targetIndex = (index - 1 + tabButtons.length) % tabButtons.length;
          } else if (event.key === "ArrowRight") {
            targetIndex = (index + 1) % tabButtons.length;
          } else if (event.key === "Home") {
            targetIndex = 0;
          } else if (event.key === "End") {
            targetIndex = tabButtons.length - 1;
          }

          const targetButton = tabButtons[targetIndex];
          targetButton?.focus();
          activateTab(targetButton?.dataset.vehicleTab ?? "details");
        });
      });

      popup.querySelectorAll(".photo-thumb").forEach((thumb) => {
        thumb.addEventListener("click", () => {
          const photoUrl = (thumb as HTMLElement).getAttribute("data-photo-url");
          const photoName = (thumb as HTMLElement).getAttribute("data-photo-name");

          if (!photoUrl) {
            return;
          }

          void Swal.fire({
            imageUrl: photoUrl,
            imageAlt: photoName ?? "Foto del vehículo",
            showConfirmButton: false,
            showCloseButton: true,
            width: "90%",
          });
        });
      });
    },
  });

  return canEdit && result.isConfirmed ? "edit" : "closed";
}

export async function openTransferDialog(params: {
  record: VehicleRecord;
  regions: Region[];
  token: string;
  onTransferred: () => Promise<void> | void;
}) {
  const delegationOptions = Object.fromEntries(
    params.regions
      .flatMap((region) =>
        region.delegations.map((delegation) => [delegation.id, `${region.name} - ${delegation.name}`]),
      )
      .filter(([delegationId]) => delegationId !== params.record.delegation.id),
  );

  const targetConfirmation = await Swal.fire({
    icon: "question",
    title: "Trasladar vehículo",
    text: `Selecciona la nueva delegación para ${resolveVehicleDisplayPlate(params.record)}.`,
    input: "select",
    inputOptions: delegationOptions,
    inputPlaceholder: "Selecciona una delegación",
    showCancelButton: true,
    confirmButtonText: "Continuar",
    cancelButtonText: "Cancelar",
    inputValidator: (value) => (!value ? "Selecciona una delegación." : null),
  });

  if (!targetConfirmation.isConfirmed || typeof targetConfirmation.value !== "string") {
    return false;
  }

  const reasonConfirmation = await Swal.fire({
    icon: "question",
    title: "Motivo del traslado",
    input: "textarea",
    inputPlaceholder: "Captura el motivo del traslado",
    showCancelButton: true,
    confirmButtonText: "Registrar traslado",
    cancelButtonText: "Cancelar",
    inputValidator: (value) => (!value.trim() ? "Captura el motivo." : null),
  });

  if (!reasonConfirmation.isConfirmed || typeof reasonConfirmation.value !== "string") {
    return false;
  }

  await api.transferRecord(params.record.id, targetConfirmation.value, reasonConfirmation.value, params.token);

  await params.onTransferred();

  return true;
}
