/**
 * 06-sessions.spec.ts
 * Session recording page tests — /sessions
 */
import { test, expect, SCREENSHOTS_DIR } from './fixtures';

test.describe('Sessions', () => {
  test('sessions page loads without errors', async ({ authenticatedPage: page }) => {
    await page.goto('/sessions');
    await page.waitForLoadState('networkidle');
    await expect(page.url()).not.toContain('/login');
    await expect(page.locator('body')).not.toContainText('Something went wrong');
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/06-sessions-page.png` });
  });

  test('sessions page shows heading', async ({ authenticatedPage: page }) => {
    await page.goto('/sessions');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/06-sessions-heading.png` });
  });

  test('sessions page does not show 404', async ({ authenticatedPage: page }) => {
    await page.goto('/sessions');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).not.toContainText('404');
    await expect(page.locator('body')).not.toContainText('Page not found');
  });

  test('sessions page shows session list or empty state', async ({ authenticatedPage: page }) => {
    await page.goto('/sessions');
    await page.waitForLoadState('networkidle');
    const bodyText = (await page.locator('body').textContent()) ?? '';
    const hasContent =
      bodyText.includes('セッション') ||
      bodyText.includes('Session') ||
      bodyText.includes('記録');
    expect(hasContent).toBeTruthy();
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/06-sessions-content.png` });
  });

  test('session detail is accessible if sessions exist', async ({ authenticatedPage: page }) => {
    await page.goto('/sessions');
    await page.waitForLoadState('networkidle');

    const sessionLink = page.locator('a[href*="/sessions/"]').first();
    if (await sessionLink.isVisible()) {
      await sessionLink.click();
      await page.waitForLoadState('networkidle');
      expect(page.url()).toContain('/sessions/');
      await page.screenshot({ path: `${SCREENSHOTS_DIR}/06-session-detail.png` });
    } else {
      test.info().annotations.push({ type: 'info', description: 'No session links found' });
      await page.screenshot({ path: `${SCREENSHOTS_DIR}/06-sessions-empty.png` });
    }
  });
});
