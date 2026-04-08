/**
 * 10-navigation.spec.ts
 * All primary navigation pages — smoke test that each loads without crash
 */
import { test, expect, SCREENSHOTS_DIR } from './fixtures';

const PAGES = [
  { path: '/activity', name: 'Activity' },
  { path: '/analytics', name: 'Analytics' },
  { path: '/approvals', name: 'Approvals' },
  { path: '/memory', name: 'Memory' },
  { path: '/notifications', name: 'Notifications' },
  { path: '/playbooks', name: 'Playbooks' },
  { path: '/recipes', name: 'Recipes' },
  { path: '/search', name: 'Search' },
  { path: '/skills', name: 'Skills' },
  { path: '/webhooks', name: 'Webhooks' },
];

test.describe('Navigation — All Pages Load', () => {
  for (const { path: pagePath, name } of PAGES) {
    test(`${name} page loads without crash`, async ({ authenticatedPage: page }) => {
      await page.goto(pagePath);
      await page.waitForLoadState('networkidle');

      // Must not redirect to login
      await expect(page.url()).not.toContain('/login');

      // Must not show generic crash messages
      await expect(page.locator('body')).not.toContainText('Page not found');
      await expect(page.locator('body')).not.toContainText('Something went wrong');

      await page.screenshot({
        path: `${SCREENSHOTS_DIR}/10-nav-${name.toLowerCase().replace(/\s+/g, '-')}.png`,
      });
    });
  }
});
