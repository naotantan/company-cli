/**
 * 09-settings.spec.ts
 * Settings page tests — /settings
 */
import { test, expect, SCREENSHOTS_DIR } from './fixtures';

test.describe('Settings', () => {
  test('settings page loads without errors', async ({ authenticatedPage: page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
    await expect(page.url()).not.toContain('/login');
    await expect(page.locator('body')).not.toContainText('Something went wrong');
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/09-settings-page.png` });
  });

  test('settings page shows heading', async ({ authenticatedPage: page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/09-settings-heading.png` });
  });

  test('settings page has form elements or tabs', async ({ authenticatedPage: page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
    const elemCount = await page.locator('input, select, [role="tab"], button').count();
    expect(elemCount).toBeGreaterThan(0);
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/09-settings-elements.png` });
  });

  test('settings page does not show 404', async ({ authenticatedPage: page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).not.toContainText('404');
    await expect(page.locator('body')).not.toContainText('Page not found');
  });

  test('organization page loads', async ({ authenticatedPage: page }) => {
    await page.goto('/org');
    await page.waitForLoadState('networkidle');
    await expect(page.url()).not.toContain('/login');
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/09-org-page.png` });
  });

  test('organization page shows org name', async ({ authenticatedPage: page }) => {
    await page.goto('/org');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).toContainText(
      /test corp|organization|組織|org/i,
      { timeout: 10000 },
    );
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/09-org-content.png` });
  });
});
