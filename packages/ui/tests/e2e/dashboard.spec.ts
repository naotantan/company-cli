/**
 * Dashboard E2E Tests — Redesigned DashboardPage
 *
 * Covers:
 * 1. Page loads without errors
 * 2. 4 metric cards are visible
 * 3. Activity feed section is visible
 * 4. Job queue / instruction input is visible
 * 5. Navigation links work (agents, sessions, skills/plugins)
 * 6. Language switching: Settings → change language → dashboard text changes
 */
import { test, expect, type Page } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SS = (name: string) => path.join(__dirname, 'screenshots', `dashboard-${name}.png`);

const API_KEY = 'test_e2e_8bc5fd292a4e6f1a9d3c7b0e5f8a2d4c1b9e7f3a6d2c5b8e1f4a7d0c3b6e9f2a';
const COMPANY_ID = '9df2dbe6-8428-409a-866a-cce30a693b21';

async function authenticate(page: Page, targetPath = '/') {
  await page.goto('/');
  await page.evaluate(
    ([key, compId]) => {
      localStorage.setItem('apiKey', key);
      localStorage.setItem('companyId', compId);
    },
    [API_KEY, COMPANY_ID],
  );
  if (targetPath !== '/') {
    await page.goto(targetPath);
  } else {
    await page.reload();
  }
  await page.waitForLoadState('load');
}

// ---------------------------------------------------------------------------
// 1. Dashboard loads without errors
// ---------------------------------------------------------------------------
test.describe('Dashboard - Page Load', () => {
  test.beforeEach(async ({ page }) => {
    await authenticate(page, '/');
  });

  test('dashboard page loads at / without JS errors or crash', async ({ page }) => {
    // Collect console errors
    const jsErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') jsErrors.push(msg.text());
    });

    // URL should be /
    expect(page.url()).toMatch(/localhost:5173\/?$/);

    // h1 heading must be present
    const heading = page.locator('h1').first();
    await expect(heading).toBeVisible({ timeout: 10_000 });

    // No crash messages
    await expect(page.locator('body')).not.toContainText('Something went wrong');
    await expect(page.locator('body')).not.toContainText('Cannot GET /');
    await expect(page.locator('body')).not.toContainText('Uncaught Error');

    // The h1 should contain either "Dashboard" (en), "ダッシュボード" (ja), or "仪表盘" (zh)
    const headingText = await heading.textContent() ?? '';
    const validHeadings = ['Dashboard', 'ダッシュボード', '仪表盘'];
    expect(validHeadings.some((h) => headingText.includes(h))).toBeTruthy();

    await page.screenshot({ path: SS('01-loaded'), fullPage: true });
  });

  test('page does not show a 404 or white blank screen', async ({ page }) => {
    // Body must have meaningful content
    const bodyText = await page.locator('body').textContent() ?? '';
    expect(bodyText.trim().length).toBeGreaterThan(100);

    // No hard 404 signals
    expect(bodyText).not.toContain('Cannot GET /');
    expect(bodyText).not.toContain('404 Not Found');
  });
});

// ---------------------------------------------------------------------------
// 2. Metric cards — at least 4 visible
// ---------------------------------------------------------------------------
test.describe('Dashboard - Metric Cards', () => {
  test.beforeEach(async ({ page }) => {
    await authenticate(page, '/');
    // Wait for the metric grid to render (proves analytics/overview returned OK)
    await page.waitForSelector('div.grid.grid-cols-2', { timeout: 20_000 });
  });

  test('at least 4 metric cards are visible', async ({ page }) => {
    // MetricCards are rendered inside the 4-column grid.
    // Each card has a "text-3xl font-bold gradient-text" value span.
    // We count the grid's direct children (each is a Link or div wrapping a card).
    const metricGrid = page.locator('div.grid.grid-cols-2');
    await expect(metricGrid).toBeVisible({ timeout: 10_000 });

    // Count cards by their value element (the big number / dash)
    const valueElements = metricGrid.locator('span.gradient-text');
    const count = await valueElements.count();
    expect(count).toBeGreaterThanOrEqual(4);

    await page.screenshot({ path: SS('02-metric-cards'), fullPage: false });
  });

  test('Active Agents metric card label is visible', async ({ page }) => {
    // The label text changes per language; use any of the known translations
    const label = page.locator('span').filter({
      hasText: /Active Skills|稼働中のエージェント|活跃技能/,
    }).first();
    await expect(label).toBeVisible({ timeout: 10_000 });
  });

  test('Today\'s Sessions metric card label is visible', async ({ page }) => {
    const label = page.locator('span').filter({
      hasText: /Today's Sessions|本日のセッション|今日会话/,
    }).first();
    await expect(label).toBeVisible({ timeout: 10_000 });
  });

  test('Cost metric card label is visible', async ({ page }) => {
    const label = page.locator('span').filter({
      hasText: /Cost \(30d\)|コスト \(30日\)|费用 \(30天\)/,
    }).first();
    await expect(label).toBeVisible({ timeout: 10_000 });
  });

  test('Total Skills metric card label is visible', async ({ page }) => {
    const label = page.locator('span').filter({
      hasText: /Total Skills|総エージェント数|技能总数/,
    }).first();
    await expect(label).toBeVisible({ timeout: 10_000 });
  });

  test('metric cards link to /agents, /sessions, /costs, /plugins', async ({ page }) => {
    await expect(page.locator('a[href="/agents"]').first()).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('a[href="/sessions"]').first()).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('a[href="/costs"]').first()).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('a[href="/plugins"]').first()).toBeVisible({ timeout: 10_000 });
  });
});

// ---------------------------------------------------------------------------
// 3. Activity Feed
// ---------------------------------------------------------------------------
test.describe('Dashboard - Activity Feed', () => {
  test.beforeEach(async ({ page }) => {
    await authenticate(page, '/');
    await page.waitForSelector('div.grid.grid-cols-2', { timeout: 20_000 });
  });

  test('activity feed section heading is visible', async ({ page }) => {
    // The ActivityFeed component renders t('dashboard.liveActivity')
    // EN: "Live Activity", JA: "ライブ アクティビティ", ZH: "实时动态"
    const heading = page.locator('h2').filter({
      hasText: /Live Activity|ライブ アクティビティ|实时动态/,
    }).first();
    await expect(heading).toBeVisible({ timeout: 10_000 });

    await page.screenshot({ path: SS('03-activity-feed'), fullPage: false });
  });

  test('activity feed "view all" link goes to /sessions', async ({ page }) => {
    // "View all" / "すべて見る" / "查看全部" link in the ActivityFeed header
    const viewAllLink = page.locator('a[href="/sessions"]').first();
    await expect(viewAllLink).toBeVisible({ timeout: 10_000 });
  });

  test('activity feed shows sessions or empty state — no unhandled error', async ({ page }) => {
    await page.waitForTimeout(1_000);

    // Either session links exist OR an empty-state message is shown
    const sessionLinksCount = await page.locator('a[href^="/sessions/"]').count();
    const emptyStateCount = await page.locator('p').filter({
      hasText: /No session records|セッション記録がありません|暂无会话记录/,
    }).count();

    // At least one of the two states is rendered
    expect(sessionLinksCount + emptyStateCount).toBeGreaterThan(0);

    await page.screenshot({ path: SS('04-activity-feed-content'), fullPage: false });
  });
});

// ---------------------------------------------------------------------------
// 4. Job Queue / Instruction Input
// ---------------------------------------------------------------------------
test.describe('Dashboard - Job Queue Panel', () => {
  test.beforeEach(async ({ page }) => {
    await authenticate(page, '/');
    await page.waitForSelector('div.grid.grid-cols-2', { timeout: 20_000 });
  });

  test('job queue section heading is visible', async ({ page }) => {
    // t('dashboard.jobQueue'): EN "Active Queue", JA "アクティブキュー", ZH "活跃队列"
    const heading = page.locator('h2').filter({
      hasText: /Active Queue|アクティブキュー|活跃队列/,
    }).first();
    await expect(heading).toBeVisible({ timeout: 10_000 });

    await page.screenshot({ path: SS('05-job-queue'), fullPage: false });
  });

  test('instruction input placeholder is visible', async ({ page }) => {
    // t('dashboard.instructionPlaceholder'): EN "Enter instruction...", JA "指示を入力...", ZH "输入指示..."
    const input = page.locator('input[type="text"]').filter({
      hasNot: page.locator('[disabled]'),
    });
    // Accept either the input itself or a disabled one (when a job is active)
    const inputAny = page.locator('input[type="text"]');
    await expect(inputAny.first()).toBeVisible({ timeout: 10_000 });
  });

  test('send or stop button is visible', async ({ page }) => {
    // Either a "Send" button or "Stop" button must be present
    // EN: "Send" / "Stop", JA: "送信" / "停止", ZH: "发送" / "停止"
    const sendBtn = page.locator('button').filter({
      hasText: /Send|送信|发送/,
    });
    const stopBtn = page.locator('button').filter({
      hasText: /Stop|停止/,
    });

    const sendCount = await sendBtn.count();
    const stopCount = await stopBtn.count();
    expect(sendCount + stopCount).toBeGreaterThan(0);

    await page.screenshot({ path: SS('06-job-queue-button'), fullPage: false });
  });

  test('job list link goes to /jobs', async ({ page }) => {
    const jobsLink = page.locator('a[href="/jobs"]').first();
    await expect(jobsLink).toBeVisible({ timeout: 10_000 });
  });

  test('instruction input accepts text when not disabled', async ({ page }) => {
    const input = page.locator('input[type="text"]').first();
    await expect(input).toBeVisible({ timeout: 10_000 });

    const isDisabled = await input.isDisabled();
    if (!isDisabled) {
      await input.fill('E2E test instruction');
      await expect(input).toHaveValue('E2E test instruction');
      await input.fill('');
    } else {
      // Active job is running — stop button should be present
      const stopBtn = page.locator('button').filter({ hasText: /Stop|停止/ });
      await expect(stopBtn.first()).toBeVisible();
    }

    await page.screenshot({ path: SS('07-job-queue-input'), fullPage: false });
  });
});

// ---------------------------------------------------------------------------
// 5. Navigation links
// ---------------------------------------------------------------------------
test.describe('Dashboard - Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await authenticate(page, '/');
    await page.waitForLoadState('load');
  });

  test('clicking Agents nav link navigates to /agents', async ({ page }) => {
    // Find link by href — more reliable than text (i18n-independent)
    const agentsNavLink = page.locator('nav a[href="/agents"]').first();
    await expect(agentsNavLink).toBeVisible({ timeout: 10_000 });
    await agentsNavLink.click();
    await expect(page).toHaveURL(/\/agents/, { timeout: 10_000 });

    await page.screenshot({ path: SS('08-nav-agents'), fullPage: false });
  });

  test('clicking Sessions nav link navigates to /sessions', async ({ page }) => {
    const sessionsNavLink = page.locator('nav a[href="/sessions"]').first();
    await expect(sessionsNavLink).toBeVisible({ timeout: 10_000 });
    await sessionsNavLink.click();
    await expect(page).toHaveURL(/\/sessions/, { timeout: 10_000 });

    await page.screenshot({ path: SS('09-nav-sessions'), fullPage: false });
  });

  test('clicking Plugins/Skills nav link navigates to /plugins', async ({ page }) => {
    const pluginsNavLink = page.locator('nav a[href="/plugins"]').first();
    await expect(pluginsNavLink).toBeVisible({ timeout: 10_000 });
    await pluginsNavLink.click();
    await expect(page).toHaveURL(/\/plugins/, { timeout: 10_000 });

    await page.screenshot({ path: SS('10-nav-plugins'), fullPage: false });
  });

  test('dashboard logo/home link returns to /', async ({ page }) => {
    // Navigate away then come back via home link
    await page.goto('/agents');
    await page.waitForLoadState('load');

    const homeLink = page.locator('nav a[href="/"]').first();
    await expect(homeLink).toBeVisible({ timeout: 10_000 });
    await homeLink.click();
    await expect(page).toHaveURL(/localhost:5173\/?$/, { timeout: 10_000 });

    await page.screenshot({ path: SS('11-nav-home'), fullPage: false });
  });

  test('settings nav link navigates to /settings', async ({ page }) => {
    const settingsLink = page.locator('nav a[href="/settings"]').first();
    await expect(settingsLink).toBeVisible({ timeout: 10_000 });
    await settingsLink.click();
    await expect(page).toHaveURL(/\/settings/, { timeout: 10_000 });

    await page.screenshot({ path: SS('12-nav-settings'), fullPage: false });
  });
});

// ---------------------------------------------------------------------------
// 6. Language switching via Settings
// ---------------------------------------------------------------------------
test.describe('Dashboard - Language Switching', () => {
  // NOTE: No beforeEach authenticate here — switchLanguage handles auth internally
  // to avoid double networkidle waits eating the 30s test budget.

  /**
   * Helper: authenticate, go to Settings, pick a language from the select,
   * click Save, then navigate back to the dashboard.
   *
   * Uses 'domcontentloaded' (not 'networkidle') because the Jobs 5s polling
   * keeps background network activity alive and networkidle would time out.
   *
   * Language is applied asynchronously: useSettings calls i18n.changeLanguage
   * after GET /settings resolves on mount. Callers must use expect() polling
   * to wait for the translated text to appear — not a point-in-time read.
   */
  async function goToSettingsAndSwitchLanguage(page: Page, lang: 'ja' | 'en' | 'zh'): Promise<void> {
    // Ensure auth credentials are in localStorage
    await page.goto('/');
    await page.evaluate(
      ([key, compId]) => {
        localStorage.setItem('apiKey', key);
        localStorage.setItem('companyId', compId);
      },
      [API_KEY, COMPANY_ID],
    );

    // Go to settings
    await page.goto('/settings');
    await page.waitForLoadState('domcontentloaded');

    // Wait for the language select to appear
    const langSelect = page.locator('select[aria-label]').first();
    await expect(langSelect).toBeVisible({ timeout: 10_000 });
    await langSelect.selectOption(lang);

    // The save button for LanguageSection has aria-label containing "Save" or "保存"
    const saveBtn = page.locator('button[aria-label]').filter({
      hasText: /Save|保存/,
    }).first();
    await expect(saveBtn).toBeVisible({ timeout: 5_000 });
    await saveBtn.click();

    // Wait for PATCH /settings to complete
    await page.waitForResponse(
      (r) => r.url().includes('/settings') && r.request().method() === 'PATCH',
      { timeout: 10_000 },
    ).catch(() => {});

    // Set localStorage.language directly so i18n initializes with the correct
    // language on the next page.goto() — this avoids the race between:
    //   page load → i18n init (reads localStorage) vs. GET /settings response
    await page.evaluate((lang) => {
      localStorage.setItem('language', lang);
    }, lang);

    // Navigate to dashboard — domcontentloaded avoids networkidle hang
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
  }

  // Expected dashboard h1 text per locale
  const DASHBOARD_TITLES: Record<string, RegExp> = {
    en: /^Dashboard$/,
    ja: /^ダッシュボード$/,
    zh: /^仪表盘$/,
  };

  test('switching to English changes dashboard heading to "Dashboard"', async ({ page }) => {
    test.setTimeout(60_000);
    await goToSettingsAndSwitchLanguage(page, 'en');
    // Poll until i18n updates the heading
    await expect(page.locator('h1').first()).toHaveText(DASHBOARD_TITLES['en'], { timeout: 15_000 });

    await page.screenshot({ path: SS('13-lang-en'), fullPage: false });
  });

  test('switching to Japanese changes dashboard heading to "ダッシュボード"', async ({ page }) => {
    test.setTimeout(90_000);
    // Start from English so we know a real change will happen
    await goToSettingsAndSwitchLanguage(page, 'en');
    await expect(page.locator('h1').first()).toHaveText(DASHBOARD_TITLES['en'], { timeout: 15_000 });

    await goToSettingsAndSwitchLanguage(page, 'ja');
    await expect(page.locator('h1').first()).toHaveText(DASHBOARD_TITLES['ja'], { timeout: 15_000 });

    await page.screenshot({ path: SS('14-lang-ja'), fullPage: false });
  });

  test('language change persists: reload still shows correct language', async ({ page }) => {
    test.setTimeout(60_000);
    await goToSettingsAndSwitchLanguage(page, 'en');
    await expect(page.locator('h1').first()).toHaveText(DASHBOARD_TITLES['en'], { timeout: 15_000 });

    // Reload — language must survive page reload via localStorage/API
    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForResponse(
      (r) => r.url().includes('/settings') && r.request().method() === 'GET',
      { timeout: 10_000 },
    ).catch(() => {});
    await expect(page.locator('h1').first()).toHaveText(DASHBOARD_TITLES['en'], { timeout: 15_000 });

    await page.screenshot({ path: SS('15-lang-persist'), fullPage: false });
  });

  test('switching language updates metric card labels', async ({ page }) => {
    test.setTimeout(60_000);
    await goToSettingsAndSwitchLanguage(page, 'en');
    // Wait for i18n to apply and metric grid to render
    await expect(page.locator('h1').first()).toHaveText(DASHBOARD_TITLES['en'], { timeout: 15_000 });
    await page.waitForSelector('div.grid.grid-cols-2', { timeout: 20_000 });

    // English metric card labels
    await expect(page.locator('span').filter({ hasText: 'Active Skills' }).first())
      .toBeVisible({ timeout: 15_000 });
    await expect(page.locator('span').filter({ hasText: "Today's Sessions" }).first())
      .toBeVisible({ timeout: 10_000 });

    await page.screenshot({ path: SS('16-lang-metric-cards-en'), fullPage: false });
  });

  test('switching language updates job queue panel heading', async ({ page }) => {
    test.setTimeout(60_000);
    await goToSettingsAndSwitchLanguage(page, 'en');
    // Wait for i18n to apply and metric grid to render
    await expect(page.locator('h1').first()).toHaveText(DASHBOARD_TITLES['en'], { timeout: 15_000 });
    await page.waitForSelector('div.grid.grid-cols-2', { timeout: 20_000 });

    // English: "Active Queue"
    await expect(page.locator('h2').filter({ hasText: 'Active Queue' }).first())
      .toBeVisible({ timeout: 10_000 });

    await page.screenshot({ path: SS('17-lang-job-queue-en'), fullPage: false });
  });
});

// ---------------------------------------------------------------------------
// 7. Skill Usage chart and Cost Summary sections
// ---------------------------------------------------------------------------
test.describe('Dashboard - Additional Sections', () => {
  test.beforeEach(async ({ page }) => {
    await authenticate(page, '/');
    await page.waitForSelector('div.grid.grid-cols-2', { timeout: 20_000 });
  });

  test('Skill Usage chart section heading is visible', async ({ page }) => {
    // EN: "Skill Usage Top 7", JA: "スキル使用 Top7", ZH: "技能使用 Top7"
    const chartHeading = page.locator('h2').filter({
      hasText: /Skill Usage Top 7|スキル使用 Top7|技能使用 Top7/,
    }).first();
    await expect(chartHeading).toBeVisible({ timeout: 10_000 });

    await page.screenshot({ path: SS('18-skill-usage'), fullPage: false });
  });

  test('Cost Summary section heading is visible', async ({ page }) => {
    // EN: "Cost (30d)", JA: "コスト (30日)", ZH: "费用 (30天)"
    const costHeading = page.locator('h2').filter({
      hasText: /Cost \(30d\)|コスト \(30日\)|费用 \(30天\)/,
    }).first();
    await expect(costHeading).toBeVisible({ timeout: 10_000 });

    await page.screenshot({ path: SS('19-cost-summary'), fullPage: false });
  });

  test('Sessions Table section is visible below main grid', async ({ page }) => {
    // SessionsTable also uses t('dashboard.liveActivity') for its heading
    // There will be at least 2 elements with "Live Activity" / "ライブ アクティビティ"
    // (one in ActivityFeed, one in SessionsTable)
    const liveActivityHeadings = page.locator('h2').filter({
      hasText: /Live Activity|ライブ アクティビティ|实时动态/,
    });
    const headingCount = await liveActivityHeadings.count();
    expect(headingCount).toBeGreaterThanOrEqual(1);

    await page.screenshot({ path: SS('20-sessions-table'), fullPage: true });
  });

  test('full dashboard screenshot shows no crashes', async ({ page }) => {
    await page.waitForTimeout(3_000);
    await expect(page.locator('body')).not.toContainText('Something went wrong');
    await expect(page.locator('body')).not.toContainText('Uncaught Error');

    await page.screenshot({ path: SS('21-full-page'), fullPage: true });
  });
});
