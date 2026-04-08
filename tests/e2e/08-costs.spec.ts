/**
 * 08-costs.spec.ts
 * Cost management page tests — /costs
 */
import { test, expect, SCREENSHOTS_DIR } from './fixtures';

test.describe('Cost Management', () => {
  test('costs page loads without errors', async ({ authenticatedPage: page }) => {
    await page.goto('/costs');
    await page.waitForLoadState('networkidle');
    await expect(page.url()).not.toContain('/login');
    await expect(page.locator('body')).not.toContainText('Something went wrong');
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/08-costs-page.png` });
  });

  test('costs page shows heading', async ({ authenticatedPage: page }) => {
    await page.goto('/costs');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/08-costs-heading.png` });
  });

  test('costs page does not show 404', async ({ authenticatedPage: page }) => {
    await page.goto('/costs');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).not.toContainText('404');
    await expect(page.locator('body')).not.toContainText('Page not found');
  });

  test('costs page shows cost or budget related content', async ({ authenticatedPage: page }) => {
    await page.goto('/costs');
    await page.waitForLoadState('networkidle');
    const bodyText = (await page.locator('body').textContent()) ?? '';
    const hasContent =
      bodyText.includes('コスト') ||
      bodyText.includes('予算') ||
      bodyText.includes('Cost') ||
      bodyText.includes('Budget') ||
      bodyText.includes('円') ||
      bodyText.includes('$');
    expect(hasContent).toBeTruthy();
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/08-costs-content.png` });
  });

  test('costs page has interactive elements (period selector or filters)', async ({
    authenticatedPage: page,
  }) => {
    await page.goto('/costs');
    await page.waitForLoadState('networkidle');
    const interactiveCount = await page.locator('button, select, input').count();
    expect(interactiveCount).toBeGreaterThan(0);
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/08-costs-interactive.png` });
  });
});
