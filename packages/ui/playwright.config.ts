import { defineConfig, devices } from '@playwright/test';

const API_KEY = 'test_e2e_8bc5fd292a4e6f1a9d3c7b0e5f8a2d4c1b9e7f3a6d2c5b8e1f4a7d0c3b6e9f2a';
const COMPANY_ID = '9df2dbe6-8428-409a-866a-cce30a693b21';
const BASE_URL = 'http://localhost:5173';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: 1,
  reporter: [
    ['html', { outputFolder: 'tests/e2e/reports/html', open: 'never' }],
    ['junit', { outputFile: 'tests/e2e/reports/junit.xml' }],
    ['list'],
  ],
  outputDir: 'tests/e2e/test-results',
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    storageState: {
      cookies: [],
      origins: [
        {
          origin: BASE_URL,
          localStorage: [
            { name: 'apiKey', value: API_KEY },
            { name: 'companyId', value: COMPANY_ID },
          ],
        },
      ],
    },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
