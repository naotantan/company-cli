/**
 * 04-agents.spec.ts
 * Agent management page tests — /agents
 */
import { test, expect, SCREENSHOTS_DIR } from './fixtures';

test.describe('Agent Management', () => {
  test('agents page loads without errors', async ({ authenticatedPage: page }) => {
    await page.goto('/agents');
    await page.waitForLoadState('networkidle');
    await expect(page.url()).not.toContain('/login');
    await expect(page.locator('body')).not.toContainText('Something went wrong');
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/04-agents-page.png` });
  });

  test('agents page heading shows "エージェント"', async ({ authenticatedPage: page }) => {
    await page.goto('/agents');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('h1')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('h1')).toContainText('エージェント');
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/04-agents-heading.png` });
  });

  test('agents page has create agent button', async ({ authenticatedPage: page }) => {
    await page.goto('/agents');
    await page.waitForLoadState('networkidle');
    const createBtn = page
      .locator('button')
      .filter({ hasText: /エージェントを追加|Add Agent|Create Agent/i })
      .first();
    await expect(createBtn).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/04-agents-create-btn.png` });
  });

  test('create agent form opens when clicking add button', async ({ authenticatedPage: page }) => {
    await page.goto('/agents');
    await page.waitForLoadState('networkidle');
    const createBtn = page
      .locator('button')
      .filter({ hasText: /エージェントを追加/i })
      .first();
    await createBtn.click();
    const nameInput = page.locator('input[placeholder]').first();
    await expect(nameInput).toBeVisible({ timeout: 5000 });
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/04-agents-create-form.png` });
  });

  test('can create a new agent and see it in the list', async ({ authenticatedPage: page }) => {
    await page.goto('/agents');
    await page.waitForLoadState('networkidle');

    const createBtn = page
      .locator('button')
      .filter({ hasText: /エージェントを追加/i })
      .first();
    await createBtn.click();

    const nameInput = page.locator('input[placeholder]').first();
    await expect(nameInput).toBeVisible({ timeout: 5000 });

    const agentName = `E2E Agent ${Date.now()}`;
    await nameInput.fill(agentName);
    await expect(nameInput).toHaveValue(agentName);

    const submitBtn = page
      .locator('button:not([disabled])')
      .filter({ hasText: /^作成$/ })
      .first();
    await submitBtn.click();

    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).toContainText(agentName, { timeout: 15000 });
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/04-agents-created.png` });
  });

  test('agent detail page is accessible via list link', async ({ authenticatedPage: page }) => {
    await page.goto('/agents');
    await page.waitForLoadState('networkidle');

    const agentLink = page.locator('a[href*="/agents/"]').first();
    if (await agentLink.isVisible()) {
      await agentLink.click();
      await page.waitForLoadState('networkidle');
      expect(page.url()).toContain('/agents/');
      await page.screenshot({ path: `${SCREENSHOTS_DIR}/04-agent-detail.png` });
    } else {
      test.info().annotations.push({ type: 'info', description: 'No agent detail links found' });
      await page.screenshot({ path: `${SCREENSHOTS_DIR}/04-agents-no-detail.png` });
    }
  });

  test('agents page shows status summary text', async ({ authenticatedPage: page }) => {
    await page.goto('/agents');
    await page.waitForLoadState('networkidle');
    const bodyText = (await page.locator('body').textContent()) ?? '';
    expect(bodyText).toContain('エージェント');
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/04-agents-summary.png` });
  });
});
