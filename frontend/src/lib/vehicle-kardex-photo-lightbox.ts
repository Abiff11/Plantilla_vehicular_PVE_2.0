import './vehicle-kardex-photo-lightbox.css';

const OVERLAY_ID = 'vehicle-kardex-photo-lightbox';

let previouslyFocusedElement: HTMLElement | null = null;

function getOrCreateOverlay() {
  const existing = document.getElementById(OVERLAY_ID);
  if (existing) {
    return existing;
  }

  const overlay = document.createElement('div');
  overlay.id = OVERLAY_ID;
  overlay.className = 'vehicle-kardex-lightbox';
  overlay.hidden = true;
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Fotografía ampliada del vehículo');
  overlay.innerHTML = `
    <div class="vehicle-kardex-lightbox__backdrop" data-kardex-lightbox-close></div>
    <div class="vehicle-kardex-lightbox__content">
      <button
        type="button"
        class="vehicle-kardex-lightbox__close"
        data-kardex-lightbox-close
        aria-label="Cerrar fotografía y regresar al Kárdex"
      >
        ×
      </button>
      <img class="vehicle-kardex-lightbox__image" alt="Fotografía del vehículo" />
      <div class="vehicle-kardex-lightbox__caption"></div>
    </div>
  `;

  overlay.querySelectorAll<HTMLElement>('[data-kardex-lightbox-close]').forEach((element) => {
    element.addEventListener('click', () => closeVehicleKardexPhotoLightbox());
  });

  document.body.appendChild(overlay);
  return overlay;
}

function openVehicleKardexPhotoLightbox(photoUrl: string, photoName: string) {
  const overlay = getOrCreateOverlay();
  const image = overlay.querySelector<HTMLImageElement>('.vehicle-kardex-lightbox__image');
  const caption = overlay.querySelector<HTMLElement>('.vehicle-kardex-lightbox__caption');
  const closeButton = overlay.querySelector<HTMLButtonElement>('.vehicle-kardex-lightbox__close');

  if (!image || !caption || !closeButton) {
    return;
  }

  previouslyFocusedElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  image.src = photoUrl;
  image.alt = photoName || 'Fotografía del vehículo';
  caption.textContent = photoName || 'Fotografía del vehículo';
  overlay.hidden = false;
  document.body.classList.add('vehicle-kardex-lightbox-open');
  closeButton.focus();
}

export function closeVehicleKardexPhotoLightbox() {
  const overlay = document.getElementById(OVERLAY_ID);
  if (!overlay || overlay.hidden) {
    return false;
  }

  overlay.hidden = true;
  document.body.classList.remove('vehicle-kardex-lightbox-open');

  const image = overlay.querySelector<HTMLImageElement>('.vehicle-kardex-lightbox__image');
  if (image) {
    image.removeAttribute('src');
  }

  previouslyFocusedElement?.focus();
  previouslyFocusedElement = null;
  return true;
}

function isVehicleKardexPhotoTarget(target: EventTarget | null): target is HTMLElement {
  return target instanceof HTMLElement && Boolean(target.closest('.vehicle-detail-popup [data-photo-url]'));
}

document.addEventListener(
  'click',
  (event) => {
    if (!isVehicleKardexPhotoTarget(event.target)) {
      return;
    }

    const photoElement = event.target.closest<HTMLElement>('.vehicle-detail-popup [data-photo-url]');
    const photoUrl = photoElement?.getAttribute('data-photo-url');
    if (!photoElement || !photoUrl) {
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();

    openVehicleKardexPhotoLightbox(
      photoUrl,
      photoElement.getAttribute('data-photo-name') ?? 'Fotografía del vehículo',
    );
  },
  true,
);

document.addEventListener(
  'keydown',
  (event) => {
    if (event.key !== 'Escape') {
      return;
    }

    if (closeVehicleKardexPhotoLightbox()) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  },
  true,
);
