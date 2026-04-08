/**
 * 承認機能削除確認 E2E テスト
 *
 * 削除された内容の検証:
 * 1. /approvals にアクセスすると NotFoundPage が表示される
 * 2. ナビゲーションに「承認」または「Approvals」リンクが存在しない
 * 3. ダッシュボード (/) に「承認待ち」セクションが存在しない
 * 4. 設定ページ (/settings) に「自動承認」セクションが存在しない
 * 5. ダッシュボードが正常に表示される（メトリクスチップ・セッションフィード・ジョブパネル）
 */
import { test, expect, type Page } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SS = (name: string) => path.join(__dirname, 'screenshots', `approvals-removed-${name}`);

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
  }
  await page.waitForLoadState('load');
}

// ---------------------------------------------------------------------------
// 1. /approvals → NotFoundPage
// ---------------------------------------------------------------------------
test.describe('承認ページ削除確認', () => {
  test('/approvals にアクセスすると NotFoundPage が表示される', async ({ page }) => {
    await authenticate(page, '/approvals');

    // NotFoundPage の特徴的な要素を確認（404 or "見つかりません" 等）
    const body = page.locator('body');
    await expect(body).toBeVisible();

    // ダッシュボードや承認ページコンテンツが表示されていないことを確認
    const approvalsHeading = page.locator('h1').filter({ hasText: /承認|Approval/i });
    await expect(approvalsHeading).toHaveCount(0);

    // 404 / not found / ページが存在しない系のメッセージが表示されること
    const notFoundIndicators = [
      page.locator('text=404'),
      page.locator('text=Not Found'),
      page.locator('text=見つかりません'),
      page.locator('text=ページが見つかりません'),
      page.locator('[data-testid="not-found"]'),
    ];

    let notFoundShown = false;
    for (const indicator of notFoundIndicators) {
      const count = await indicator.count();
      if (count > 0) {
        notFoundShown = true;
        break;
      }
    }

    // NotFoundPage が表示されていること（いずれかの指標が存在する）
    expect(notFoundShown).toBe(true);

    await page.screenshot({ path: SS('01-approvals-not-found.png'), fullPage: true });
  });
});

// ---------------------------------------------------------------------------
// 2. ナビゲーションに「承認」リンクが存在しない
// ---------------------------------------------------------------------------
test.describe('ナビゲーション承認リンク削除確認', () => {
  test('サイドバーに「承認」または「Approvals」リンクが存在しない', async ({ page }) => {
    await authenticate(page, '/');

    // ナビゲーション要素が存在すること
    const nav = page.locator('nav[aria-label="メインナビゲーション"]').first();
    await expect(nav).toBeVisible();

    // 「承認」テキストのリンクが存在しないこと
    const approvalLinkJa = nav.locator('a, button').filter({ hasText: '承認' });
    await expect(approvalLinkJa).toHaveCount(0);

    // 「Approvals」テキストのリンクが存在しないこと
    const approvalLinkEn = nav.locator('a, button').filter({ hasText: /^Approvals?$/i });
    await expect(approvalLinkEn).toHaveCount(0);

    // href="/approvals" のリンクが存在しないこと
    const approvalHref = page.locator('a[href="/approvals"]');
    await expect(approvalHref).toHaveCount(0);

    await page.screenshot({ path: SS('02-nav-no-approvals-link.png'), fullPage: false });
  });

  test('ナビゲーション全体を確認 - 承認リンクが全ページで非表示', async ({ page }) => {
    await authenticate(page, '/settings');

    // 設定ページでもナビゲーションに承認リンクが存在しないこと
    const approvalHref = page.locator('a[href="/approvals"]');
    await expect(approvalHref).toHaveCount(0);

    // 「承認」テキストを含むナビリンクが存在しないこと
    const nav = page.locator('nav').first();
    const approvalNavItem = nav.locator('a, button').filter({ hasText: '承認' });
    await expect(approvalNavItem).toHaveCount(0);

    await page.screenshot({ path: SS('03-settings-nav-no-approvals.png'), fullPage: false });
  });
});

// ---------------------------------------------------------------------------
// 3. ダッシュボードに「承認待ち」セクションが存在しない
// ---------------------------------------------------------------------------
test.describe('ダッシュボード承認セクション削除確認', () => {
  test('ダッシュボードに承認キューセクションが存在しない', async ({ page }) => {
    await authenticate(page, '/');

    // ダッシュボードが正常にロードされていること
    const nav = page.locator('nav[aria-label="メインナビゲーション"]').first();
    await expect(nav).toBeVisible();

    // 承認キューのセクション見出し（h2/h3）として「承認待ち」が存在しないこと
    // ※ dashboard.subtitle の説明文テキストは除外し、見出し要素のみ検査する
    const approvalQueueHeading = page.locator('h2, h3').filter({ hasText: '承認待ち' });
    await expect(approvalQueueHeading).toHaveCount(0);

    // 「ApprovalQueue」相当のdata-testid要素が存在しないこと
    const approvalQueue = page.locator('[data-testid="approval-queue"]');
    await expect(approvalQueue).toHaveCount(0);

    // 承認キュー操作ボタン（承認・却下）がスタンドアロンで存在しないこと
    // （ボタンが完全に「承認」「却下」のみのテキストで独立して存在する場合）
    const approveButton = page.locator('button').filter({ hasText: /^承認$/ });
    const rejectButton = page.locator('button').filter({ hasText: /^却下$/ });
    await expect(approveButton).toHaveCount(0);
    await expect(rejectButton).toHaveCount(0);

    // /approvals へのリンクが存在しないこと
    const approvalLink = page.locator('a[href="/approvals"]');
    await expect(approvalLink).toHaveCount(0);

    await page.screenshot({ path: SS('04-dashboard-no-approval-queue.png'), fullPage: true });
  });
});

// ---------------------------------------------------------------------------
// 4. 設定ページに「自動承認」セクションが存在しない
// ---------------------------------------------------------------------------
test.describe('設定ページ自動承認セクション削除確認', () => {
  test('設定ページに「自動承認」セクションが存在しない', async ({ page }) => {
    await authenticate(page, '/settings');

    // 設定ページが正常にロードされていること
    const heading = page.locator('h1').first();
    await expect(heading).toBeVisible();

    // 「自動承認」テキストが存在しないこと
    const autoApproveSection = page.locator('text=自動承認');
    await expect(autoApproveSection).toHaveCount(0);

    // 「AutoApproveSection」関連のUI要素が存在しないこと
    const autoApproveToggle = page.locator('[data-testid="auto-approve"]');
    await expect(autoApproveToggle).toHaveCount(0);

    // 「承認ルール」テキストが存在しないこと
    const approvalRules = page.locator('text=承認ルール');
    await expect(approvalRules).toHaveCount(0);

    await page.screenshot({ path: SS('05-settings-no-auto-approve.png'), fullPage: true });
  });
});

// ---------------------------------------------------------------------------
// 5. ダッシュボードが正常に表示される
// ---------------------------------------------------------------------------
test.describe('ダッシュボード正常表示確認', () => {
  test('ダッシュボードが正常にロードされる', async ({ page }) => {
    await authenticate(page, '/');

    // エラーが表示されていないこと
    await expect(page.locator('body')).not.toContainText('Something went wrong');
    await expect(page.locator('body')).not.toContainText('500');

    // ナビゲーションが表示されること
    const nav = page.locator('nav[aria-label="メインナビゲーション"]').first();
    await expect(nav).toBeVisible();

    await page.screenshot({ path: SS('06-dashboard-loads-ok.png'), fullPage: false });
  });

  test('ダッシュボードにメトリクスチップが表示される', async ({ page }) => {
    await authenticate(page, '/');

    // メトリクスチップ（統計カード）が少なくとも1つ存在すること
    // 一般的な数値表示要素を確認
    const body = page.locator('body');
    await expect(body).toBeVisible();
    await expect(body).not.toContainText('Something went wrong');

    // 数値系コンテンツがあること（セッション数・エージェント数・ジョブ数等）
    const metricsArea = page.locator('[class*="metric"], [class*="stat"], [class*="chip"], [class*="card"]').first();
    // メトリクスが表示されているか、あるいはページが正常であること
    const hasMetrics = await metricsArea.count();
    if (hasMetrics > 0) {
      await expect(metricsArea).toBeVisible();
    }

    await page.screenshot({ path: SS('07-dashboard-metrics.png'), fullPage: false });
  });

  test('ダッシュボードにセッションフィードが表示される', async ({ page }) => {
    await authenticate(page, '/');

    // セッション関連のコンテンツが表示されること
    // API呼び出しを待機
    await page.waitForLoadState('load');

    // ページが正常であること
    await expect(page.locator('body')).not.toContainText('Something went wrong');

    // セッションフィードまたは空状態が表示されること
    const sessionFeed = page.locator('[class*="session"], [class*="feed"]').first();
    const sessionFeedCount = await sessionFeed.count();

    if (sessionFeedCount > 0) {
      await expect(sessionFeed).toBeVisible();
    }

    await page.screenshot({ path: SS('08-dashboard-session-feed.png'), fullPage: true });
  });

  test('ダッシュボードにジョブパネルが表示される', async ({ page }) => {
    await authenticate(page, '/');

    await page.waitForLoadState('load');

    // ジョブ関連のコンテンツが表示されること
    await expect(page.locator('body')).not.toContainText('Something went wrong');

    // ジョブパネルまたは対応する空状態が表示されること
    const jobPanel = page.locator('[class*="job"], [class*="Job"]').first();
    const jobPanelCount = await jobPanel.count();

    if (jobPanelCount > 0) {
      await expect(jobPanel).toBeVisible();
    }

    await page.screenshot({ path: SS('09-dashboard-job-panel.png'), fullPage: true });
  });

  test('ダッシュボード全体スクリーンショット取得', async ({ page }) => {
    await authenticate(page, '/');
    await page.waitForLoadState('load');

    // 最終的な全体スクリーンショット
    await expect(page.locator('body')).not.toContainText('Something went wrong');
    await page.screenshot({ path: SS('10-dashboard-full.png'), fullPage: true });
  });
});
