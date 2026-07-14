import { defineConfig } from '@playwright/test';

import { SINGAPORE_TIME_ZONE } from './lib/timezone';

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: /.*\.spec\.ts/,
  use: {
    baseURL: 'http://127.0.0.1:3000',
    timezoneId: SINGAPORE_TIME_ZONE,
  },
  webServer: {
    command: 'pnpm dev',
    url: 'http://127.0.0.1:3000',
    reuseExistingServer: true,
  },
});