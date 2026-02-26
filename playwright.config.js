import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: 'http://127.0.0.1:5190',
    headless: true
  },
  webServer: {
    command: 'node src/server/index.mjs',
    url: 'http://127.0.0.1:5190/api/health',
    reuseExistingServer: false,
    env: {
      PORT: '5190',
      BASE_URL: 'http://127.0.0.1:5190',
      JWT_SECRET: 'playwright-test-secret',
      ADMIN_EMAIL: 'admin@local',
      ADMIN_PASSWORD: 'admin123456',
      // keep test DB isolated
      DATA_DIR: 'data-playwright'
    }
  }
});

