import { Module } from '@nestjs/common';
import { LocalStorageProvider } from './providers/local-storage.provider';
import { StorageService } from './storage.service';

@Module({
  providers: [LocalStorageProvider, StorageService],
  exports: [StorageService],
})
export class StorageModule {}
