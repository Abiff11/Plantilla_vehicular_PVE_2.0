export type StorageFolder = "vehicle-photos" | "message-photos";

export type UploadableFiles = {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
};

export type SavedFileInput = {
  file: UploadableFiles;
  folder: StorageFolder;
};

export type StoredFile = {
  originalName: string;
  fileName: string;
  objectKey: string;
  publicUrl: string;
  mimeType: string;
  size: number;
  storageProvider: "local";
};

export type StoredFileObject = {
  buffer: Buffer;
  mimeType: string;
  size: number;
};

export interface StorageProvider {
  saveFile(input: SavedFileInput): Promise<StoredFile>;
  getObject(objectKey: string): Promise<StoredFileObject>;
  deleteObject(objectKey: string): Promise<void>;
}
