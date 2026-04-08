/**
 * 07-artifacts.spec.ts
 * Artifacts page tests — /artifacts
 */
import { test, expect, SCREENSHOTS_DIR } from './fixtures';

test.describe('Artifacts', () => {
  test('artifacts page loads without errors', async ({ authenticatedPage: page }) => {
    await page.goto('/artifacts');
    await page.waitForLoadState('networkidle');
    await expect(page.url()).not.toContain('/login');
    await expect(page.locator('body')).not.toContainText('Something went wrong');
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/07-artifacts-page.png` });
  });

  test('artifacts page shows heading', async ({ authenticatedPage: page }) => {
    await page.goto('/artifacts');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/07-artifacts-heading.png` });
  });

  test('artifacts page does not show 404', async ({ authenticatedPage: page }) => {
    await page.goto('/artifacts');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).not.toContainText('404');
    await expect(page.locator('body')).not.toContainText('Page not found');
  });

  test('artifacts page shows artifact list or empty state', async ({ authenticatedPage: page }) => {
    await page.goto('/artifacts');
    await page.waitForLoadState('networkidle');
    const bodyText = (await page.locator('body').textContent()) ?? '';
    const hasContent =
      bodyText.includes('成果物') ||
      bodyText.includes('Artifact') ||
      bodyText.includes('artifact');
    expect(hasContent).toBeTruthy();
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/07-artifacts-content.png` });
  });
});
