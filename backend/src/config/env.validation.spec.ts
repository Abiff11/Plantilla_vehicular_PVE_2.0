import { validateEnv } from './env.validation';

describe('validateEnv storage configuration', () => {
  it('removes deprecated remote-storage variables from runtime config', () => {
    const result = validateEnv({
      NODE_ENV: 'development',
      STORAGE_DRIVER: 'r2',
      R2_ACCOUNT_ID: 'legacy-account',
      R2_ACCESS_KEY_ID: 'legacy-access-key',
      R2_SECRET_ACCESS_KEY: 'legacy-secret',
      R2_BUCKET: 'legacy-bucket',
      R2_PUBLIC_URL: 'https://legacy.example.test',
    });

    expect(result.STORAGE_DRIVER).toBeUndefined();
    expect(result.R2_ACCOUNT_ID).toBeUndefined();
    expect(result.R2_ACCESS_KEY_ID).toBeUndefined();
    expect(result.R2_SECRET_ACCESS_KEY).toBeUndefined();
    expect(result.R2_BUCKET).toBeUndefined();
    expect(result.R2_PUBLIC_URL).toBeUndefined();
  });
});
