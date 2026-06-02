import { Logger, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { STORAGE_PROVIDER } from './storage.constants';
import { createStorageConfig } from './storage.config';
import { LocalStorageProvider } from './providers/local-storage.provider';
import { R2StorageProvider } from './providers/r2-storage.provider';
import { StorageService } from './storage.service';

const storageLogger = new Logger('StorageModule');

@Module({
  imports: [ConfigModule],
  providers: [
    LocalStorageProvider,
    {
      provide: STORAGE_PROVIDER,
      inject: [ConfigService, LocalStorageProvider],
      useFactory: (
        configService: ConfigService,
        localStorageProvider: LocalStorageProvider,
      ) => {
        const storageConfig = createStorageConfig(configService);

        if (storageConfig.driver === 'local') {
          storageLogger.log('Storage provider initialized: local');
          return localStorageProvider;
        }

        storageLogger.log('Storage provider initialized: r2');
        storageLogger.log(`R2 bucket: ${storageConfig.r2.bucket}`);
        storageLogger.log(`R2 publicUrl: ${storageConfig.r2.publicUrl}`);
        return new R2StorageProvider(configService);
      },
    },
    StorageService,
  ],
  exports: [StorageService, STORAGE_PROVIDER],
})
export class StorageModule {}
