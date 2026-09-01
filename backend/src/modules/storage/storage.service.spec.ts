import { LocalStorageProvider } from './providers/local-storage.provider';
import { StorageService } from './storage.service';

describe('StorageService', () => {
  const storedFile = {
    originalName: 'vehicle.jpg',
    fileName: 'generated.jpg',
    objectKey: 'vehicle-photos/generated.jpg',
    publicUrl: '/api/files/vehicle-photos/generated.jpg',
    mimeType: 'image/jpeg',
    size: 128,
    storageProvider: 'local' as const,
  };

  const object = {
    buffer: Buffer.from('test'),
    mimeType: 'image/jpeg',
    size: 4,
  };

  const localStorageProvider = {
    saveFile: jest.fn().mockResolvedValue(storedFile),
    getObject: jest.fn().mockResolvedValue(object),
    deleteObject: jest.fn().mockResolvedValue(undefined),
  } as unknown as LocalStorageProvider;

  const service = new StorageService(localStorageProvider);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('stores files only through LocalStorageProvider', async () => {
    const input = {
      folder: 'vehicle-photos' as const,
      file: {
        originalname: 'vehicle.jpg',
        mimetype: 'image/jpeg',
        buffer: Buffer.from('test'),
        size: 4,
      },
    };

    await expect(service.saveFile(input)).resolves.toEqual(storedFile);
    expect(localStorageProvider.saveFile).toHaveBeenCalledWith(input);
  });

  it('reads files only through LocalStorageProvider', async () => {
    await expect(service.getObject(storedFile.objectKey)).resolves.toEqual(object);
    expect(localStorageProvider.getObject).toHaveBeenCalledWith(storedFile.objectKey);
  });

  it('deletes files only through LocalStorageProvider', async () => {
    await expect(service.deleteObject(storedFile.objectKey)).resolves.toBeUndefined();
    expect(localStorageProvider.deleteObject).toHaveBeenCalledWith(storedFile.objectKey);
  });
});
