/**
 * 02-dashboard.spec.ts
 * Dashboard (home) page tests
 */
import { test, expect, SCREENSHOTS_DIR } from './fixtures';

test.describe('Dashboard', () => {
  test('dashboard loads after authentication', async ({ authenticatedPage: page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).not.toContainText('Error');
    await expect(page.locator('body')).not.toContainText('404');
    await expect(page.url()).not.toContain('/login');
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/02-dashboard.png` });
  });

  test('dashboard shows navigation sidebar or top nav', async ({ authenticatedPage: page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const nav = page.locator('nav, aside, [role="navigation"]').first();
    await expect(nav).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/02-dashboard-nav.png` });
  });

  test('dashboard heading is visible', async ({ authenticatedPage: page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/02-dashboard-heading.png` });
  });

  test('dashboard does not show 404 or Not Found', async ({ authenticatedPage: page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).not.toContainText('404');
    await expect(page.locator('body')).not.toContainText('Not Found');
  });

  test('dashboard shows skill usage or activity content', async ({ authenticatedPage: page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const bodyText = (await page.locator('body').textContent()) ?? '';
    // Dashboard should contain agent/skill/activity related content
    const hasDashboardContent =
      bodyText.includes('スキル') ||
      bodyText.includes('エージェント') ||
      bodyText.includes('Issue') ||
      bodyText.includes('セッション') ||
      bodyText.includes('ダッシュボード');
    expect(hasDashboardContent).toBeTruthy();
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/02-dashboard-content.png` });
  });
});
