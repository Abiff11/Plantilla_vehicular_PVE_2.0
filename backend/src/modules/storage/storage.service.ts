import { Injectable } from "@nestjs/common";
import { LocalStorageProvider } from "./providers/local-storage.provider";
import { SavedFileInput, StoredFile } from "./storage.types";

@Injectable()
export class StorageService {
  constructor(private readonly localStorageProvider: LocalStorageProvider) {}

  saveFile(input: SavedFileInput): Promise<StoredFile> {
    return this.localStorageProvider.saveFile(input);
  }

  getObject(objectKey: string) {
    return this.localStorageProvider.getObject(objectKey);
  }

  deleteObject(objectKey: string) {
    return this.localStorageProvider.deleteObject(objectKey);
  }
}
