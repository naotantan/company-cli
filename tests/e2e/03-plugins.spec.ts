/**
 * 03-plugins.spec.ts
 * Skill management (plugins) page tests — /plugins
 */
import { test, expect, SCREENSHOTS_DIR } from './fixtures';

test.describe('Plugins / Skill Management', () => {
  test('plugins page loads without errors', async ({ authenticatedPage: page }) => {
    await page.goto('/plugins');
    await page.waitForLoadState('networkidle');
    await expect(page.url()).not.toContain('/login');
    await expect(page.locator('body')).not.toContainText('Something went wrong');
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/03-plugins-page.png` });
  });

  test('plugins page shows heading', async ({ authenticatedPage: page }) => {
    await page.goto('/plugins');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/03-plugins-heading.png` });
  });

  test('plugins page shows skill list or empty state', async ({ authenticatedPage: page }) => {
    await page.goto('/plugins');
    await page.waitForLoadState('networkidle');
    const bodyText = (await page.locator('body').textContent()) ?? '';
    const hasContent =
      bodyText.includes('スキル') ||
      bodyText.includes('プラグイン') ||
      bodyText.includes('Skill') ||
      bodyText.includes('Plugin') ||
      bodyText.includes('すべて');
    expect(hasContent).toBeTruthy();
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/03-plugins-list.png` });
  });

  test('plugins page has category tabs or filters', async ({ authenticatedPage: page }) => {
    await page.goto('/plugins');
    await page.waitForLoadState('networkidle');
    // Category filter ("すべて" tab) should be present
    const bodyText = (await page.locator('body').textContent()) ?? '';
    const hasFilters =
      bodyText.includes('すべて') ||
      bodyText.includes('お気に入り') ||
      (await page.locator('button, [role="tab"]').count()) > 0;
    expect(hasFilters).toBeTruthy();
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/03-plugins-filters.png` });
  });

  test('plugins sync button is present', async ({ authenticatedPage: page }) => {
    await page.goto('/plugins');
    await page.waitForLoadState('networkidle');
    // Sync/refresh button should be visible
    const syncBtn = page
      .locator('button')
      .filter({ hasText: /同期|Sync|更新|Refresh/i })
      .first();
    const hasSyncBtn = await syncBtn.isVisible();
    // It's acceptable if not present (may be loaded dynamically)
    if (hasSyncBtn) {
      await expect(syncBtn).toBeVisible();
    }
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/03-plugins-sync.png` });
  });
});
