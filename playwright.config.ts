import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: true,
  forbidOnly: true,
  retries: 0,
  timeout: 30_000,
  expect: { timeout: 5_000 },
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'SCRIPTLEDGER_BASE_PATH=/scriptledger npm run build && SCRIPTLEDGER_BASE_PATH=/scriptledger npm run preview',
      url: 'http://127.0.0.1:4173/scriptledger/',
      reuseExistingServer: false,
      timeout: 30_000,
    },
    {
      command: 'npm run prepare:local-report-fixture && npm run preview:local-report-fixture',
      url: 'http://127.0.0.1:4174',
      reuseExistingServer: false,
      timeout: 30_000,
    },
  ],
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
