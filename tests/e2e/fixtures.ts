import { test as base, Page, expect } from '@playwright/test';
import path from 'path';

export const SCREENSHOTS_DIR = path.join(__dirname, '../../test-results-e2e/screenshots');

export const AUTH = {
  apiKey: 'comp_live_fc57fa837b1eac509f3f46add11058c4de63f055c5d57931534180a6698477ac',
  companyId: 'd492ce05-e901-45bd-93e0-bb993676c03b',
  userId: 'b2eaa0db-7a74-472e-818c-a0cd4c100083',
  email: 'test@maestro.local',
  password: 'Password123!',
};

const API_BASE = 'http://localhost:3000';
const UI_BASE = 'http://localhost:5173';

export async function getValidApiKey(): Promise<string> {
  // Verify the hardcoded key still works
  const res = await fetch(`${API_BASE}/api/issues`, {
    headers: { Authorization: `Bearer ${AUTH.apiKey}` },
  }).catch(() => null);

  if (res?.ok) return AUTH.apiKey;

  // Fallback: re-login to get a fresh key
  const login = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: AUTH.email, password: AUTH.password }),
  });

  if (login.ok) {
    const data = (await login.json()) as { apiKey: string };
    return data.apiKey;
  }

  throw new Error('Cannot obtain a valid API key for E2E tests');
}

export async function injectAuth(page: Page): Promise<void> {
  const apiKey = await getValidApiKey();
  await page.goto(`${UI_BASE}/login`);
  await page.evaluate(
    ([key, companyId, userId]) => {
      localStorage.setItem('apiKey', key);
      localStorage.setItem('companyId', companyId);
      localStorage.setItem('userId', userId);
    },
    [apiKey, AUTH.companyId, AUTH.userId],
  );
}

type Fixtures = { authenticatedPage: Page };

export const test = base.extend<Fixtures>({
  authenticatedPage: async ({ page }, use) => {
    await injectAuth(page);
    await use(page);
  },
});

export { expect };
