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
    <div class="vehicle-kardex-field">
      <span>${escapeHtml(label)}</span>
      <div class="vehicle-kardex-read-value">${escapeHtml(value || "No registrado")}</div>
    </div>
  `;
}

function renderTransferRow(transfer: VehicleTransferEvent) {
  return `
    <tr>
      <td>${formatDateTimeMx(transfer.movedAt)}</td>
      <td>${escapeHtml(formatUserName(transfer.movedBy))}</td>
      <td>${escapeHtml(transfer.fromDelegation.name)}</td>
      <td>${escapeHtml(transfer.toDelegation.name)}</td>
      <td>${escapeHtml(transfer.reason || "Sin motivo registrado")}</td>
    </tr>
  `;
}

function renderEditRows(edit: VehicleEditEvent) {
  const actor = escapeHtml(edit.actor ? formatUserName(edit.actor) : "Usuario no disponible");
  const editedAt = formatDateTimeMx(edit.editedAt);

  if (edit.changedFields.length === 0) {
    return `
      <tr>
        <td>${editedAt}</td>
        <td>${actor}</td>
        <td>Sin detalle de cambios</td>
        <td>-</td>
        <td>-</td>
      </tr>
    `;
  }

  return edit.changedFields
    .map((fieldName) => `
      <tr>
        <td>${editedAt}</td>
        <td>${actor}</td>
        <td>${escapeHtml(fieldName)}</td>
        <td>${escapeHtml(edit.before[fieldName] ?? "-")}</td>
        <td>${escapeHtml(edit.after[fieldName] ?? "-")}</td>
      </tr>
    `)
    .join("");
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

function getOrderedPhotos(record: VehicleRecord) {
  return [...(record.photos ?? [])].sort((left, right) => {
    if (left.isPrimary !== right.isPrimary) {
      return left.isPrimary ? -1 : 1;
    }

    return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
  });
}

function renderPhotoThumbnail(photo: VehiclePhoto) {
  const photoUrl = escapeHtml(resolvePhotoUrl(photo));
  const photoName = escapeHtml(photo.fileName);
  const primaryBadge = photo.isPrimary
    ? '<span class="vehicle-kardex-gallery-primary">Principal</span>'
    : "";

  return `
    <div class="photo-thumb" data-photo-url="${photoUrl}" data-photo-name="${photoName}">
      <img src="${photoUrl}" alt="${photoName}" onerror="this.style.display='none';this.nextElementSibling.style.display='grid';" />
      <div class="photo-fallback" style="display:none;">Imagen no disponible</div>
      ${primaryBadge}
    </div>
  `;
}

function renderIdentityPhoto(record: VehicleRecord) {
  const photo = getOrderedPhotos(record)[0];

  if (!photo) {
    return `
      <div class="vehicle-kardex-photo-placeholder" aria-label="Unidad sin fotografía">
        <span>SIN FOTO</span>
      </div>
    `;
  }

  const photoUrl = escapeHtml(resolvePhotoUrl(photo));
  const photoName = escapeHtml(photo.fileName);

  return `
    <button
      type="button"
      class="vehicle-kardex-photo"
      data-photo-url="${photoUrl}"
      data-photo-name="${photoName}"
      aria-label="Ver fotografía principal de la unidad"
    >
      <img src="${photoUrl}" alt="${photoName}" onerror="this.style.display='none';this.nextElementSibling.style.display='grid';" />
      <span class="vehicle-kardex-photo-fallback" style="display:none;">Imagen no disponible</span>
    </button>
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
  _options: OpenRecordDetailsOptions = {},
): Promise<RecordDetailsAction> {
  const displayPlates = resolveVehicleDisplayPlate(record);
  const historyCount = record.transferHistory.length + record.editHistory.length;
  const vehicleState = record.recordState === "CURRENT" ? "VIGENTE" : "TRASLADADO";
  const orderedPhotos = getOrderedPhotos(record);

  const vehicleIdentitySection = `
    <div class="vehicle-kardex-identity">
      <div class="vehicle-kardex-photo-wrap">
        ${renderIdentityPhoto(record)}
      </div>
      <div class="vehicle-kardex-identity-copy">
        <h3>${escapeHtml(record.patrolNumber || "Sin número de patrulla")}</h3>
        <p>${escapeHtml(record.brand || "Marca no registrada")} ${escapeHtml(record.type || "")} · Modelo ${escapeHtml(record.model || "No registrado")} · ${escapeHtml(displayPlates)}</p>
        <div class="vehicle-kardex-chip-row">
          <span class="vehicle-kardex-chip">ESTADO: ${escapeHtml(vehicleState)}</span>
          <span class="vehicle-kardex-chip">DELEGACIÓN: ${escapeHtml(record.delegation.name)}</span>
          <span class="vehicle-kardex-chip">CLASE: ${escapeHtml(record.vehicleClass || "No registrado")}</span>
          <span class="vehicle-kardex-chip">USO: ${escapeHtml(record.useType || "No registrado")}</span>
          <span class="vehicle-kardex-chip">FÍSICO: ${escapeHtml(record.physicalStatus || "No registrado")}</span>
        </div>
      </div>
    </div>
  `;

  const vehicleDetailsSection = `
    <div class="vehicle-kardex-read-body">
      <section class="vehicle-kardex-panel">
        <h4>Identificación y placas</h4>
        <div class="vehicle-kardex-grid">
          ${renderVehicleDetailField("No. patrulla", record.patrolNumber)}
          ${renderVehicleDetailField("CIV", record.civ)}
          ${renderVehicleDetailField("Placas anteriores", record.previousPlates)}
          ${renderVehicleDetailField("Placas 2024", record.plates2024)}
          ${renderVehicleDetailField("Placas 2025", record.plates2025)}
          ${renderVehicleDetailField("Placas 2026", record.plates2026)}
        </div>
      </section>

      <section class="vehicle-kardex-panel">
        <h4>Características</h4>
        <div class="vehicle-kardex-grid">
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

      <section class="vehicle-kardex-panel">
        <h4>Asignación y estado</h4>
        <div class="vehicle-kardex-grid">
          ${renderVehicleDetailField("Resguardante", record.custodian)}
          ${renderVehicleDetailField("Adscripción", record.adscription)}
          ${renderVehicleDetailField("Ubicación real", record.realLocation)}
          ${renderVehicleDetailField("Delegación actual", record.delegation.name)}
          ${renderVehicleDetailField("Delegación consultada", record.viewDelegation.name)}
          ${renderVehicleDetailField("Estado del registro", record.recordState === "CURRENT" ? "Vigente" : "Trasladado")}
          ${renderVehicleDetailField("Estado físico", record.physicalStatus)}
          ${renderVehicleDetailField("Estatus sistema", record.status)}
          ${renderVehicleDetailField("Estatus Excel", record.rawCirculationStatus)}
          ${renderVehicleDetailField("Clasificación del bien", record.assetClassification)}
          ${renderVehicleDetailField("Anotación general", record.rawAssetClassification)}
        </div>
      </section>
    </div>
  `;

  const transferHistory = record.transferHistory.length > 0
    ? record.transferHistory.map((transfer) => renderTransferRow(transfer)).join("")
    : '<tr><td colspan="5" class="vehicle-kardex-empty-row">Aún no hay traslados registrados para esta unidad.</td></tr>';

  const editHistory = record.editHistory.length > 0
    ? record.editHistory.map((edit) => renderEditRows(edit)).join("")
    : '<tr><td colspan="5" class="vehicle-kardex-empty-row">Aún no hay ediciones registradas para esta unidad.</td></tr>';

  const photosSection = orderedPhotos.length > 0
    ? `
      <section class="vehicle-kardex-panel">
        <div class="vehicle-kardex-panel-title-row">
          <div>
            <h4>Fotografías</h4>
            <p>Evidencia visual registrada para la unidad. La imagen marcada como principal se utiliza en la cabecera del Kárdex.</p>
          </div>
          <span class="vehicle-kardex-count">${orderedPhotos.length}</span>
        </div>
        <div class="photo-gallery vehicle-kardex-gallery">
          ${orderedPhotos.map((photo) => renderPhotoThumbnail(photo)).join("")}
        </div>
      </section>
    `
    : `
      <section class="vehicle-kardex-panel">
        <h4>Fotografías</h4>
        <div class="vehicle-kardex-empty">Sin fotografías cargadas.</div>
      </section>
    `;

  const historySection = `
    <div class="vehicle-kardex-read-body">
      <section class="vehicle-kardex-panel">
        <div class="vehicle-kardex-panel-title-row">
          <div>
            <h4>Historial de traslados</h4>
            <p>Fecha, usuario, delegación de origen, destino y motivo.</p>
          </div>
          <span class="vehicle-kardex-count">${record.transferHistory.length}</span>
        </div>
        <div class="vehicle-kardex-table-wrap">
          <table class="vehicle-kardex-table">
            <thead><tr><th>Fecha</th><th>Usuario</th><th>Origen</th><th>Destino</th><th>Motivo</th></tr></thead>
            <tbody>${transferHistory}</tbody>
          </table>
        </div>
      </section>

      <section class="vehicle-kardex-panel">
        <div class="vehicle-kardex-panel-title-row">
          <div>
            <h4>Historial de ediciones</h4>
            <p>Campo modificado, valor anterior, valor nuevo, fecha y usuario.</p>
          </div>
          <span class="vehicle-kardex-count">${record.editHistory.length}</span>
        </div>
        <div class="vehicle-kardex-table-wrap">
          <table class="vehicle-kardex-table">
            <thead><tr><th>Fecha</th><th>Usuario</th><th>Campo</th><th>Antes</th><th>Después</th></tr></thead>
            <tbody>${editHistory}</tbody>
          </table>
        </div>
      </section>
    </div>
  `;

  await Swal.fire({
    title: "Kárdex vehicular",
    width: 980,
    confirmButtonText: "Cerrar",
    showCancelButton: false,
    focusConfirm: false,
    customClass: {
      popup: "vehicle-detail-popup",
      title: "vehicle-kardex-modal-title",
      actions: "vehicle-kardex-modal-actions",
      confirmButton: "vehicle-kardex-close-primary",
    },
    html: `
      <div class="vehicle-kardex-modal-subtitle">
        <span>Consulta de información de la unidad.</span>
        <span class="vehicle-kardex-mode-badge">Modo Consulta</span>
      </div>

      ${vehicleIdentitySection}

      <div class="vehicle-detail-tabs" role="tablist" aria-label="Secciones del kárdex vehicular">
        <button type="button" class="vehicle-detail-tab is-active" role="tab" aria-selected="true" aria-controls="vehicle-detail-panel-details" data-vehicle-tab="details">
          Detalles del vehículo
        </button>
        <button type="button" class="vehicle-detail-tab" role="tab" aria-selected="false" aria-controls="vehicle-detail-panel-history" data-vehicle-tab="history" tabindex="-1">
          Historial <span class="vehicle-detail-tab-count">${historyCount}</span>
        </button>
      </div>

      <div id="vehicle-detail-panel-details" class="vehicle-detail-tab-panel is-active" role="tabpanel" data-vehicle-tab-panel="details">
        ${vehicleDetailsSection}
        ${photosSection}
      </div>

      <div id="vehicle-detail-panel-history" class="vehicle-detail-tab-panel" role="tabpanel" data-vehicle-tab-panel="history" hidden>
        ${historySection}
      </div>
    `,
    didOpen: () => {
      const popup = Swal.getPopup();
      if (!popup) return;

      const tabButtons = Array.from(popup.querySelectorAll<HTMLButtonElement>("[data-vehicle-tab]"));
      const tabPanels = Array.from(popup.querySelectorAll<HTMLElement>("[data-vehicle-tab-panel]"));

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
        button.addEventListener("click", () => activateTab(button.dataset.vehicleTab ?? "details"));
        button.addEventListener("keydown", (event) => {
          if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
          event.preventDefault();

          let targetIndex = index;
          if (event.key === "ArrowLeft") targetIndex = (index - 1 + tabButtons.length) % tabButtons.length;
          if (event.key === "ArrowRight") targetIndex = (index + 1) % tabButtons.length;
          if (event.key === "Home") targetIndex = 0;
          if (event.key === "End") targetIndex = tabButtons.length - 1;

          const targetButton = tabButtons[targetIndex];
          targetButton?.focus();
          activateTab(targetButton?.dataset.vehicleTab ?? "details");
        });
      });

      popup.querySelectorAll<HTMLElement>("[data-photo-url]").forEach((thumb) => {
        thumb.addEventListener("click", () => {
          const photoUrl = thumb.getAttribute("data-photo-url");
          const photoName = thumb.getAttribute("data-photo-name");
          if (!photoUrl) return;

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

  return "closed";
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
