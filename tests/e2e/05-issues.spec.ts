/**
 * 05-issues.spec.ts
 * Issue management page tests — /issues
 */
import { test, expect, SCREENSHOTS_DIR } from './fixtures';

test.describe('Issue Management', () => {
  test('issues page loads without errors', async ({ authenticatedPage: page }) => {
    await page.goto('/issues');
    await page.waitForLoadState('networkidle');
    await expect(page.url()).not.toContain('/login');
    await expect(page.locator('body')).not.toContainText('Something went wrong');
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/05-issues-page.png` });
  });

  test('issues page heading is visible', async ({ authenticatedPage: page }) => {
    await page.goto('/issues');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('h1')).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/05-issues-heading.png` });
  });

  test('issues page shows issue content or empty state', async ({ authenticatedPage: page }) => {
    await page.goto('/issues');
    await page.waitForLoadState('networkidle');
    const bodyText = (await page.locator('body').textContent()) ?? '';
    expect(bodyText.toLowerCase()).toMatch(/issue/i);
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/05-issues-state.png` });
  });

  test('create issue button is visible', async ({ authenticatedPage: page }) => {
    await page.goto('/issues');
    await page.waitForLoadState('networkidle');
    const createBtn = page
      .locator('button')
      .filter({ hasText: /Issueを作成|Issue.*作成|Create.*Issue|New Issue/i })
      .first();
    await expect(createBtn).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/05-issues-create-btn.png` });
  });

  test('create issue form opens on button click', async ({ authenticatedPage: page }) => {
    await page.goto('/issues');
    await page.waitForLoadState('networkidle');
    const createBtn = page
      .locator('button')
      .filter({ hasText: /Issueを作成|Issue.*作成/i })
      .first();
    await createBtn.click();
    const titleInput = page.locator('input[type="text"]').first();
    await expect(titleInput).toBeVisible({ timeout: 5000 });
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/05-issues-create-form.png` });
  });

  test('can create a new issue and see it in the list', async ({ authenticatedPage: page }) => {
    await page.goto('/issues');
    await page.waitForLoadState('networkidle');

    const createBtn = page
      .locator('button')
      .filter({ hasText: /Issueを作成|Issue.*作成/i })
      .first();
    await createBtn.click();

    const titleInput = page.locator('input[type="text"]').first();
    await expect(titleInput).toBeVisible({ timeout: 5000 });

    const issueTitle = `E2E Issue ${Date.now()}`;
    await titleInput.fill(issueTitle);
    await expect(titleInput).toHaveValue(issueTitle);

    const submitBtn = page
      .locator('button:not([disabled])')
      .filter({ hasText: /^作成$|^Create$|^Submit$/i })
      .first();
    await submitBtn.click();

    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).toContainText(issueTitle, { timeout: 15000 });
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/05-issues-created.png` });
  });

  test('create button is disabled when title is empty', async ({ authenticatedPage: page }) => {
    await page.goto('/issues');
    await page.waitForLoadState('networkidle');

    const createBtn = page
      .locator('button')
      .filter({ hasText: /Issueを作成/i })
      .first();
    await createBtn.click();

    const hasDisabledBtn = (await page.locator('button[disabled]').count()) > 0;
    expect(hasDisabledBtn).toBeTruthy();
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/05-issues-validation.png` });
  });
});
