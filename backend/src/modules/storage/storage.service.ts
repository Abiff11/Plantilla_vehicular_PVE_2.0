import { Inject, Injectable, Optional } from "@nestjs/common";
import { STORAGE_PROVIDER } from "./storage.constants";
import { SavedFileInput, StorageProvider, StoredFile } from "./storage.types";

@Injectable()
export class StorageService {
  constructor(
    @Optional() @Inject(STORAGE_PROVIDER) private readonly storageProvider?: StorageProvider,
  ) {}

  async saveFile(input: SavedFileInput): Promise<StoredFile> {
    if (!this.storageProvider) {
      throw new Error("Storage provider missing");
    }

    return this.storageProvider.saveFile(input);
  }

  async deleteObject(objectKey: string): Promise<void> {
    if (!this.storageProvider) {
      throw new Error("Storage provider missing");
    }

    await this.storageProvider.deleteObject(objectKey);
  }
}
