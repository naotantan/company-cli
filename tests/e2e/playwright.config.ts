import { defineConfig, devices } from '@playwright/test';
import path from 'path';

export default defineConfig({
  testDir: '.',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: 1,
  reporter: [
    ['html', { outputFolder: path.join(__dirname, '../../playwright-report-e2e') }],
    ['junit', { outputFile: path.join(__dirname, '../../test-results-e2e/junit.xml') }],
    ['list'],
  ],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'on',
    video: 'on-first-retry',
    viewport: { width: 1280, height: 800 },
    actionTimeout: 30000,
    navigationTimeout: 30000,
  },
  outputDir: path.join(__dirname, '../../test-results-e2e/'),
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
