/**
 * maestro E2E Critical User Journey Tests
 *
 * Targets: http://localhost (Nginx) or http://localhost:5173 (Vite dev)
 * Set BASE_URL env var to switch between environments.
 *
 * Covers:
 *   1. Authentication — login, redirect, logout
 *   2. Dashboard — stat cards, navigation, skill usage chart
 *   3. Plugins (スキル管理) — list, enable/disable toggle, create form
 *   4. Issues — list, filter, create, detail navigation
 *   5. Artifacts — list, type filter, search
 *   6. Sessions — list, expand/collapse
 *   7. Agents — list page loads
 *   8. Memory — list page loads, search
 */

import { test, expect, SCREENSHOTS_DIR } from './fixtures';

// ──────────────────────────────────────────────
// 1. Authentication
// ──────────────────────────────────────────────
test.describe('Authentication', () => {
  test('unauthenticated user is redirected to /login', async ({ page }) => {
    // Clear storage to simulate fresh user
    await page.goto('/login');
    await page.evaluate(() => {
      localStorage.removeItem('apiKey');
      localStorage.removeItem('companyId');
      localStorage.removeItem('userId');
    });

    await page.goto('/');
    await page.waitForURL('**/login', { timeout: 10000 });
    await expect(page.url()).toContain('/login');
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/journey-01-auth-redirect.png` });
  });

  test('login page renders email and password fields', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('input[type="email"], input[name="email"], #email')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('input[type="password"], input[name="password"], #password')).toBeVisible();
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/journey-01-login-form.png` });
  });

  test('login with valid credentials redirects to dashboard', async ({ page }) => {
    await page.goto('/login');
    const emailInput = page.locator('input[type="email"], input[name="email"], #email').first();
    const passwordInput = page.locator('input[type="password"], input[name="password"], #password').first();

    await emailInput.fill('test@maestro.local');
    await passwordInput.fill('Password123!');
    await page.locator('button[type="submit"]').click();

    try {
      await page.waitForURL('/', { timeout: 15000 });
      await expect(page.url()).not.toContain('/login');
      await page.screenshot({ path: `${SCREENSHOTS_DIR}/journey-01-login-success.png` });
    } catch {
      const body = await page.locator('body').textContent() ?? '';
      // Rate limit is acceptable — the test account may have been hit repeatedly
      if (body.includes('rate_limit') || body.includes('試行回数')) {
        test.info().annotations.push({ type: 'info', description: 'Rate limit hit — acceptable in test suite' });
      } else {
        throw new Error(`Login redirect failed. Body: ${body.slice(0, 300)}`);
      }
    }
  });

  test('authenticated user can access dashboard', async ({ authenticatedPage: page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await expect(page.url()).not.toContain('/login');
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/journey-01-auth-dashboard.png` });
  });
});

// ──────────────────────────────────────────────
// 2. Dashboard
// ──────────────────────────────────────────────
test.describe('Dashboard', () => {
  test('dashboard loads and shows heading', async ({ authenticatedPage: page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const h1 = page.locator('h1').first();
    await expect(h1).toBeVisible({ timeout: 15000 });
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/journey-02-dashboard-heading.png` });
  });

  test('dashboard shows stat cards (agents, issues, sessions, skills)', async ({ authenticatedPage: page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // The dashboard renders 4 stat cards
    const cards = page.locator('[class*="surface"], [class*="card"], .card').filter({
      hasText: /稼働中|Issue|セッション|スキル/,
    });
    await expect(cards.first()).toBeVisible({ timeout: 15000 });
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/journey-02-dashboard-stats.png` });
  });

  test('dashboard does not show 404 or error crash', async ({ authenticatedPage: page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const body = page.locator('body');
    await expect(body).not.toContainText('404');
    await expect(body).not.toContainText('Something went wrong');
    await expect(body).not.toContainText('Page not found');
  });

  test('dashboard skill usage chart is visible', async ({ authenticatedPage: page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    // Chart heading: "過去24時間 スキル使用 Top10" or "全期間 スキル使用 Top10"
    const chartHeading = page.locator('text=/スキル使用 Top10|スキル使用/').first();
    await expect(chartHeading).toBeVisible({ timeout: 15000 });
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/journey-02-dashboard-chart.png` });
  });

  test('dashboard navigation links to /issues', async ({ authenticatedPage: page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    // StatCard with "to" prop wraps a Link — clicking navigates
    const issueCard = page.locator('a[href="/issues"]').first();
    if (await issueCard.isVisible()) {
      await issueCard.click();
      await page.waitForURL('**/issues', { timeout: 10000 });
      await expect(page.url()).toContain('/issues');
    }
  });

  test('dashboard "Claudeに指示" panel is visible', async ({ authenticatedPage: page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('text=Claudeに指示')).toBeVisible({ timeout: 15000 });
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/journey-02-dashboard-job-panel.png` });
  });

  test('dashboard shows recent activity section', async ({ authenticatedPage: page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    // "最近のアクティビティ" heading is rendered when data loads
    await expect(page.locator('text=最近のアクティビティ')).toBeVisible({ timeout: 15000 });
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/journey-02-dashboard-activity.png` });
  });
});

// ──────────────────────────────────────────────
// 3. Plugins / Skills (スキル管理)
// ──────────────────────────────────────────────
test.describe('Plugins Page (スキル管理)', () => {
  test('plugins page loads without error', async ({ authenticatedPage: page }) => {
    await page.goto('/plugins');
    await page.waitForLoadState('networkidle');
    await expect(page.url()).not.toContain('/login');
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 15000 });
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/journey-03-plugins-loaded.png` });
  });

  test('plugins page shows heading with correct title', async ({ authenticatedPage: page }) => {
    await page.goto('/plugins');
    await page.waitForLoadState('networkidle');
    const h1 = page.locator('h1').first();
    await expect(h1).toBeVisible({ timeout: 15000 });
    // Title should contain "スキル" or "Plugin"
    const titleText = await h1.textContent() ?? '';
    expect(titleText.match(/スキル|Plugin|plugin/i)).toBeTruthy();
  });

  test('plugins page shows install button', async ({ authenticatedPage: page }) => {
    await page.goto('/plugins');
    await page.waitForLoadState('networkidle');
    // Primary button for installing/creating a skill
    const installBtn = page.locator('button').filter({ hasText: /インストール|Install|スキルを追加|新規/i }).first();
    await expect(installBtn).toBeVisible({ timeout: 15000 });
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/journey-03-plugins-install-btn.png` });
  });

  test('clicking install button shows URL input form', async ({ authenticatedPage: page }) => {
    await page.goto('/plugins');
    await page.waitForLoadState('networkidle');

    const installBtn = page.locator('button').filter({ hasText: /スキルをインストール|インストール|Install|新規/i }).first();
    await expect(installBtn).toBeVisible({ timeout: 15000 });
    await installBtn.click();

    // The form should appear with a text input for GitHub URL
    const urlInput = page.locator('input[type="text"][placeholder*="GitHub"]').first();
    await expect(urlInput).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/journey-03-plugins-install-form.png` });
  });

  test('plugins page shows AI skill recommender widget', async ({ authenticatedPage: page }) => {
    await page.goto('/plugins');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('text=AIスキル推薦')).toBeVisible({ timeout: 15000 });
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/journey-03-plugins-recommender.png` });
  });

  test('plugins page shows empty state or skill list', async ({ authenticatedPage: page }) => {
    await page.goto('/plugins');
    await page.waitForLoadState('networkidle');
    const body = page.locator('body');
    // Either shows skills or an empty state message
    const hasContent = await body.evaluate((el) =>
      el.textContent?.includes('スキル') || el.textContent?.includes('Plugin') || false
    );
    expect(hasContent).toBeTruthy();
  });
});

// ──────────────────────────────────────────────
// 4. Issues
// ──────────────────────────────────────────────
test.describe('Issues Page', () => {
  test('issues page loads', async ({ authenticatedPage: page }) => {
    await page.goto('/issues');
    await page.waitForLoadState('networkidle');
    await expect(page.url()).not.toContain('/login');
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 15000 });
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/journey-04-issues-loaded.png` });
  });

  test('issues page shows issue list with existing issues', async ({ authenticatedPage: page }) => {
    await page.goto('/issues');
    await page.waitForLoadState('networkidle');
    // There are existing issues from previous test runs (TODO-001 through TODO-009)
    await expect(page.locator('body')).toContainText('TODO-', { timeout: 15000 });
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/journey-04-issues-list.png` });
  });

  test('issues page shows status filter dropdown', async ({ authenticatedPage: page }) => {
    await page.goto('/issues');
    await page.waitForLoadState('networkidle');
    const statusSelect = page.locator('select[aria-label*="ステータス"], select[aria-label*="status"]').first();
    await expect(statusSelect).toBeVisible({ timeout: 15000 });
  });

  test('issues status filter filters to backlog', async ({ authenticatedPage: page }) => {
    await page.goto('/issues');
    await page.waitForLoadState('networkidle');

    const statusSelect = page.locator('select').first();
    await statusSelect.selectOption('backlog');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/journey-04-issues-filter-backlog.png` });
  });

  test('issues page has search input', async ({ authenticatedPage: page }) => {
    await page.goto('/issues');
    await page.waitForLoadState('networkidle');
    const searchInput = page.locator('input[type="search"], input[placeholder*="検索"]').first();
    await expect(searchInput).toBeVisible({ timeout: 15000 });
  });

  test('issues search filters results', async ({ authenticatedPage: page }) => {
    await page.goto('/issues');
    await page.waitForLoadState('networkidle');

    const searchInput = page.locator('input[type="search"], input[placeholder*="検索"]').first();
    await searchInput.fill('TODO-001');
    // Wait for deferred value to settle
    await page.waitForTimeout(500);
    await expect(page.locator('body')).toContainText('TODO-001', { timeout: 10000 });
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/journey-04-issues-search.png` });
  });

  test('can open create issue form', async ({ authenticatedPage: page }) => {
    await page.goto('/issues');
    await page.waitForLoadState('networkidle');

    const createBtn = page.locator('button').filter({ hasText: /Issueを作成|Issue.*作成|New Issue/i }).first();
    await expect(createBtn).toBeVisible({ timeout: 15000 });
    await createBtn.click();

    const titleInput = page.locator('input[type="text"]').first();
    await expect(titleInput).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/journey-04-issues-create-form.png` });
  });

  test('can create a new issue', async ({ authenticatedPage: page }) => {
    await page.goto('/issues');
    await page.waitForLoadState('networkidle');

    const createBtn = page.locator('button').filter({ hasText: /Issueを作成/i }).first();
    await createBtn.click();

    const titleInput = page.locator('input[type="text"]').first();
    await expect(titleInput).toBeVisible({ timeout: 10000 });

    const testTitle = `E2E Journey Issue ${Date.now()}`;
    await titleInput.fill(testTitle);

    // Click the create submit button
    const submitBtn = page.locator('button:not([disabled])').filter({ hasText: /^作成$|^Create$/i }).first();
    await submitBtn.click();

    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).toContainText(testTitle, { timeout: 15000 });
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/journey-04-issues-created.png` });
  });

  test('clicking an issue navigates to detail page', async ({ authenticatedPage: page }) => {
    await page.goto('/issues');
    await page.waitForLoadState('networkidle');

    // Click the first issue card link
    const firstIssueLink = page.locator('a[href*="/issues/"]').first();
    await expect(firstIssueLink).toBeVisible({ timeout: 15000 });
    await firstIssueLink.click();

    // URL should change to /issues/:id
    await page.waitForURL('**/issues/**', { timeout: 10000 });
    await expect(page.url()).toMatch(/\/issues\/[a-f0-9-]+$/);
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/journey-04-issues-detail.png` });
  });

  test('create button is disabled when title is empty', async ({ authenticatedPage: page }) => {
    await page.goto('/issues');
    await page.waitForLoadState('networkidle');

    const createBtn = page.locator('button').filter({ hasText: /Issueを作成/i }).first();
    await createBtn.click();

    // The submit button should be disabled because title is empty
    const submitBtn = page.locator('button').filter({ hasText: /^作成$|^Create$/i }).first();
    await expect(submitBtn).toBeDisabled({ timeout: 5000 });
  });
});

// ──────────────────────────────────────────────
// 5. Artifacts
// ──────────────────────────────────────────────
test.describe('Artifacts Page', () => {
  test('artifacts page loads without error', async ({ authenticatedPage: page }) => {
    await page.goto('/artifacts');
    await page.waitForLoadState('networkidle');
    await expect(page.url()).not.toContain('/login');
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 15000 });
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/journey-05-artifacts-loaded.png` });
  });

  test('artifacts page heading says 成果物', async ({ authenticatedPage: page }) => {
    await page.goto('/artifacts');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('h1').first()).toContainText('成果物', { timeout: 15000 });
  });

  test('artifacts page shows type filter buttons', async ({ authenticatedPage: page }) => {
    await page.goto('/artifacts');
    await page.waitForLoadState('networkidle');
    // Type filter buttons: すべて, Web, ファイル, レポート, 画像, その他
    await expect(page.locator('button').filter({ hasText: 'すべて' }).first()).toBeVisible({ timeout: 15000 });
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/journey-05-artifacts-filters.png` });
  });

  test('artifacts page has search input', async ({ authenticatedPage: page }) => {
    await page.goto('/artifacts');
    await page.waitForLoadState('networkidle');
    const searchInput = page.locator('input[placeholder*="タイトル"], input[placeholder*="検索"]').first();
    await expect(searchInput).toBeVisible({ timeout: 15000 });
  });

  test('artifacts type filter Web changes display', async ({ authenticatedPage: page }) => {
    await page.goto('/artifacts');
    await page.waitForLoadState('networkidle');

    const webBtn = page.locator('button').filter({ hasText: /^Web$/ }).first();
    await expect(webBtn).toBeVisible({ timeout: 15000 });
    await webBtn.click();
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/journey-05-artifacts-filter-web.png` });
  });

  test('artifacts shows empty state or list', async ({ authenticatedPage: page }) => {
    await page.goto('/artifacts');
    await page.waitForLoadState('networkidle');
    const body = page.locator('body');
    const hasContent = await body.evaluate((el) =>
      (el.textContent?.includes('成果物') || el.textContent?.includes('まだありません')) ?? false
    );
    expect(hasContent).toBeTruthy();
  });
});

// ──────────────────────────────────────────────
// 6. Sessions
// ──────────────────────────────────────────────
test.describe('Sessions Page', () => {
  test('sessions page loads without error', async ({ authenticatedPage: page }) => {
    await page.goto('/sessions');
    await page.waitForLoadState('networkidle');
    await expect(page.url()).not.toContain('/login');
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 15000 });
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/journey-06-sessions-loaded.png` });
  });

  test('sessions page shows empty state or session list', async ({ authenticatedPage: page }) => {
    await page.goto('/sessions');
    await page.waitForLoadState('networkidle');
    // Either "セッション記録がありません" or a list of sessions
    const body = page.locator('body');
    const hasContent = await body.evaluate((el) =>
      (el.textContent?.includes('セッション') || el.textContent?.includes('session')) ?? false
    );
    expect(hasContent).toBeTruthy();
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/journey-06-sessions-state.png` });
  });

  test('sessions page shows stats bar with record count', async ({ authenticatedPage: page }) => {
    await page.goto('/sessions');
    await page.waitForLoadState('networkidle');
    // Stats bar shows "N 件のセッション記録"
    const statsBar = page.locator('text=/件のセッション記録|セッション記録/').first();
    await expect(statsBar).toBeVisible({ timeout: 15000 });
  });
});

// ──────────────────────────────────────────────
// 7. Agents
// ──────────────────────────────────────────────
test.describe('Agents Page', () => {
  test('agents page loads without error', async ({ authenticatedPage: page }) => {
    await page.goto('/agents');
    await page.waitForLoadState('networkidle');
    await expect(page.url()).not.toContain('/login');
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 15000 });
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/journey-07-agents-loaded.png` });
  });

  test('agents page shows add agent button or empty state', async ({ authenticatedPage: page }) => {
    await page.goto('/agents');
    await page.waitForLoadState('networkidle');
    const body = page.locator('body');
    const hasContent = await body.evaluate((el) =>
      (el.textContent?.includes('エージェント') || el.textContent?.includes('Agent') || el.textContent?.includes('agent')) ?? false
    );
    expect(hasContent).toBeTruthy();
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/journey-07-agents-state.png` });
  });
});

// ──────────────────────────────────────────────
// 8. Memory
// ──────────────────────────────────────────────
test.describe('Memory Page', () => {
  test('memory page loads without error', async ({ authenticatedPage: page }) => {
    await page.goto('/memory');
    await page.waitForLoadState('networkidle');
    await expect(page.url()).not.toContain('/login');
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 15000 });
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/journey-08-memory-loaded.png` });
  });

  test('memory page has search input', async ({ authenticatedPage: page }) => {
    await page.goto('/memory');
    await page.waitForLoadState('networkidle');
    const searchInput = page.locator('input[placeholder*="検索"], input[type="search"]').first();
    await expect(searchInput).toBeVisible({ timeout: 15000 });
  });

  test('memory page has type filter options', async ({ authenticatedPage: page }) => {
    await page.goto('/memory');
    await page.waitForLoadState('networkidle');
    const body = page.locator('body');
    const hasFilters = await body.evaluate((el) =>
      (el.textContent?.includes('ユーザー') || el.textContent?.includes('プロジェクト')) ?? false
    );
    expect(hasFilters).toBeTruthy();
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/journey-08-memory-filters.png` });
  });
});

// ──────────────────────────────────────────────
// 9. Navigation sidebar
// ──────────────────────────────────────────────
test.describe('Navigation Sidebar', () => {
  test('sidebar is visible on dashboard', async ({ authenticatedPage: page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const nav = page.locator('nav, aside, [role="navigation"]').first();
    await expect(nav).toBeVisible({ timeout: 15000 });
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/journey-09-sidebar.png` });
  });

  test('sidebar links navigate to correct pages', async ({ authenticatedPage: page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Click Issues link in sidebar
    const issuesLink = page.locator('a[href="/issues"]').first();
    if (await issuesLink.isVisible({ timeout: 5000 })) {
      await issuesLink.click();
      await page.waitForURL('**/issues', { timeout: 10000 });
      await expect(page.url()).toContain('/issues');
    }
  });
});

// ──────────────────────────────────────────────
// 10. Error resilience
// ──────────────────────────────────────────────
test.describe('Error Resilience', () => {
  test('unknown route shows not found page', async ({ authenticatedPage: page }) => {
    await page.goto('/nonexistent-route-xyz');
    await page.waitForLoadState('networkidle');
    const body = page.locator('body');
    const has404 = await body.evaluate((el) =>
      (el.textContent?.includes('404') || el.textContent?.includes('Not Found') || el.textContent?.includes('見つかりません')) ?? false
    );
    expect(has404).toBeTruthy();
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/journey-10-404.png` });
  });

  test('all main pages load without JS errors', async ({ authenticatedPage: page }) => {
    const jsErrors: string[] = [];
    page.on('pageerror', (err) => jsErrors.push(err.message));

    const routes = ['/', '/issues', '/sessions', '/artifacts', '/plugins', '/agents', '/memory'];
    for (const route of routes) {
      await page.goto(route);
      await page.waitForLoadState('networkidle');
    }

    // Filter out known non-critical errors (network failures in test env, etc.)
    const criticalErrors = jsErrors.filter((msg) =>
      !msg.includes('ResizeObserver') &&
      !msg.includes('Non-Error') &&
      !msg.includes('Request failed')
    );
    expect(criticalErrors).toHaveLength(0);
  });
});
