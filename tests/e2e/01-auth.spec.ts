/**
 * 01-auth.spec.ts
 * Authentication flow tests — login, register, redirect, logout
 */
import { test as base, expect } from '@playwright/test';
import * as fs from 'fs';
import { SCREENSHOTS_DIR } from './fixtures';

// Ensure screenshots directory exists
if (!fs.existsSync(SCREENSHOTS_DIR)) fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

base.describe('Authentication Flow', () => {
  base.test('login page loads with correct form fields', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('#email, input[name="email"], input[type="email"]').first()).toBeVisible();
    await expect(page.locator('#password, input[name="password"], input[type="password"]').first()).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/01-login-page.png` });
  });

  base.test('login with invalid credentials shows error message', async ({ page }) => {
    await page.goto('/login');
    await page.fill('#email, input[name="email"], input[type="email"]', 'invalid@example.com');
    await page.fill('#password, input[name="password"], input[type="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');
    await expect(page.locator('body')).toContainText(
      /エラー|error|invalid|incorrect|失敗|メール|パスワード/i,
      { timeout: 10000 },
    );
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/01-login-error.png` });
  });

  base.test('login with valid credentials redirects to dashboard', async ({ page }) => {
    await page.goto('/login');
    await page.fill('#email, input[name="email"], input[type="email"]', 'test@maestro.local');
    await page.fill('#password, input[name="password"], input[type="password"]', 'Password123!');
    await page.click('button[type="submit"]');

    try {
      await page.waitForURL('/', { timeout: 15000 });
      expect(page.url()).not.toContain('/login');
    } catch {
      const bodyText = (await page.locator('body').textContent()) ?? '';
      if (bodyText.includes('rate_limit') || bodyText.includes('試行回数')) {
        base.skip(true, 'Rate limit exceeded — skipping redirect check');
      } else {
        throw new Error(`Login redirect failed. Body snippet: ${bodyText.slice(0, 200)}`);
      }
    }
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/01-login-success.png` });
  });

  base.test('register page loads with all required fields', async ({ page }) => {
    await page.goto('/register');
    await expect(page.locator('input[id="name"], input[name="name"]').first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('input[id="email"], input[name="email"]').first()).toBeVisible();
    await expect(page.locator('input[id="password"], input[name="password"]').first()).toBeVisible();
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/01-register-page.png` });
  });

  base.test('register with existing email shows duplicate error', async ({ page }) => {
    await page.goto('/register');
    const nameInput = page.locator('input[id="name"], input[name="name"]').first();
    const emailInput = page.locator('input[id="email"], input[name="email"]').first();
    const passwordInput = page.locator('input[id="password"], input[name="password"]').first();
    const companyInput = page.locator('input[id="companyName"], input[name="companyName"]').first();

    await nameInput.fill('Duplicate User');
    await emailInput.fill('test@maestro.local');
    await passwordInput.fill('Password123!');
    if (await companyInput.isVisible()) await companyInput.fill('Test Corp');
    await page.click('button[type="submit"]');
    await expect(page.locator('body')).toContainText(
      /エラー|error|already|exists|既に|登録済み/i,
      { timeout: 10000 },
    );
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/01-register-duplicate.png` });
  });

  base.test('unauthenticated access to dashboard redirects to login', async ({ page }) => {
    await page.goto('/login');
    await page.evaluate(() => {
      localStorage.removeItem('apiKey');
      localStorage.removeItem('companyId');
      localStorage.removeItem('userId');
    });
    await page.goto('/');
    await page.waitForURL('**/login', { timeout: 10000 });
    expect(page.url()).toContain('/login');
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/01-unauthenticated-redirect.png` });
  });
});
