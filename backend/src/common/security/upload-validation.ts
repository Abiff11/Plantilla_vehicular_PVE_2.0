type UploadLike = {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
};

function hasPrefix(buffer: Buffer, prefix: number[]) {
  return buffer.length >= prefix.length && buffer.subarray(0, prefix.length).equals(Buffer.from(prefix));
}

export function hasJpegSignature(file: UploadLike) {
  return hasPrefix(file.buffer, [0xff, 0xd8, 0xff]);
}

export function hasPngSignature(file: UploadLike) {
  return hasPrefix(file.buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
}

export function hasWebpSignature(file: UploadLike) {
  return (
    file.buffer.length >= 12 &&
    file.buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    file.buffer.subarray(8, 12).toString("ascii") === "WEBP"
  );
}

export function hasPdfSignature(file: UploadLike) {
  return hasPrefix(file.buffer, [0x25, 0x50, 0x44, 0x46, 0x2d]);
}

export function hasZipSignature(file: UploadLike) {
  return (
    hasPrefix(file.buffer, [0x50, 0x4b, 0x03, 0x04]) ||
    hasPrefix(file.buffer, [0x50, 0x4b, 0x05, 0x06]) ||
    hasPrefix(file.buffer, [0x50, 0x4b, 0x07, 0x08])
  );
}

export function assertValidImageSignature(file: UploadLike) {
  const isValid =
    (file.mimetype === "image/jpeg" || file.mimetype === "image/jpg") && hasJpegSignature(file) ||
    file.mimetype === "image/png" && hasPngSignature(file) ||
    file.mimetype === "image/webp" && hasWebpSignature(file);

  if (!isValid) {
    throw new Error("El archivo no coincide con una imagen valida.");
  }
}

export function assertValidExcelSignature(file: UploadLike) {
  const normalizedName = file.originalname.trim().toLowerCase();

  if (!normalizedName.endsWith(".xlsx")) {
    throw new Error("Solo se permite archivo .xlsx.");
  }

  if (!hasZipSignature(file)) {
    throw new Error("El archivo no coincide con un Excel .xlsx valido.");
  }
}

export function assertValidMessageAttachmentSignature(file: UploadLike) {
  const mimeType = file.mimetype;
  const isValid =
    (mimeType === "image/jpeg" || mimeType === "image/jpg") && hasJpegSignature(file) ||
    mimeType === "image/png" && hasPngSignature(file) ||
    mimeType === "image/webp" && hasWebpSignature(file) ||
    mimeType === "application/pdf" && hasPdfSignature(file) ||
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" &&
      hasZipSignature(file) ||
    mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" &&
      hasZipSignature(file);

  if (!isValid) {
    throw new Error("El archivo no coincide con un tipo permitido.");
  }
}
