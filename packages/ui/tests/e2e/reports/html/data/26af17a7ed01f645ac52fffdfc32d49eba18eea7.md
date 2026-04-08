# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: maestro.spec.ts >> Navigation >> sidebar does not contain a standalone "スキル" nav link
- Location: tests/e2e/maestro.spec.ts:272:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('nav a[href="/plugins"]')
Expected: visible
Error: strict mode violation: locator('nav a[href="/plugins"]') resolved to 3 elements:
    1) <a href="/plugins" class="group flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] transition-all duration-150 text-[#5e5d59] font-normal hover:text-[#141413] hover:bg-[#e8e6dc]">…</a> aka getByRole('link', { name: 'プラグイン' })
    2) <a href="/plugins" class="group flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] transition-all duration-150 text-[#5e5d59] font-normal hover:text-[#141413] hover:bg-[#e8e6dc]">…</a> aka locator('a').filter({ hasText: 'プラグイン' }).nth(1)
    3) <a href="/plugins" class="flex flex-col items-center justify-center gap-1 rounded-th-md px-2 py-2 text-[10px] font-medium transition-colors text-th-text-4 hover:text-th-text-2">…</a> aka getByLabel('モバイルナビゲーション').locator('a').filter({ hasText: 'プラグイン' })

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for locator('nav a[href="/plugins"]')

```

# Page snapshot

```yaml
- generic [ref=e3]:
  - button "Open command palette" [ref=e4] [cursor=pointer]:
    - img [ref=e5]
    - text: Search...
    - generic [ref=e8]: ⌘K
  - generic [ref=e9]:
    - complementary [ref=e10]:
      - generic [ref=e11]:
        - generic [ref=e12]:
          - generic [ref=e14]: M
          - generic [ref=e15]: maestro
        - paragraph [ref=e16]: AIスキル組織の実行状況を横断管理
      - navigation "メインナビゲーション" [ref=e17]:
        - generic [ref=e18]:
          - generic [ref=e19]:
            - paragraph [ref=e20]: ホーム
            - generic [ref=e21]:
              - link "ダッシュボード" [ref=e22] [cursor=pointer]:
                - /url: /
                - img [ref=e23]
                - generic [ref=e26]: ダッシュボード
              - link "アクティビティ" [ref=e27] [cursor=pointer]:
                - /url: /activity
                - img [ref=e28]
                - generic [ref=e30]: アクティビティ
          - generic [ref=e31]:
            - paragraph [ref=e32]: タスク管理
            - generic [ref=e33]:
              - link "Issue" [ref=e34] [cursor=pointer]:
                - /url: /issues
                - img [ref=e35]
                - generic [ref=e38]: Issue
              - link "プロジェクト" [ref=e39] [cursor=pointer]:
                - /url: /projects
                - img [ref=e40]
                - generic [ref=e42]: プロジェクト
              - link "承認" [ref=e43] [cursor=pointer]:
                - /url: /approvals
                - img [ref=e44]
                - generic [ref=e47]: 承認
              - link "Plane (ゴール管理)" [ref=e48] [cursor=pointer]:
                - /url: http://localhost:8090
                - img [ref=e49]
                - generic [ref=e53]: Plane (ゴール管理)
                - img [ref=e54]
          - generic [ref=e58]:
            - paragraph [ref=e59]: AI実行
            - generic [ref=e60]:
              - link "エージェント" [ref=e61] [cursor=pointer]:
                - /url: /agents
                - img [ref=e62]
                - generic [ref=e65]: エージェント
              - link "ジョブ" [ref=e66] [cursor=pointer]:
                - /url: /jobs
                - img [ref=e67]
                - generic [ref=e70]: ジョブ
              - link "ルーティン" [ref=e71] [cursor=pointer]:
                - /url: /routines
                - img [ref=e72]
                - generic [ref=e76]: ルーティン
              - link "指示書" [ref=e77] [cursor=pointer]:
                - /url: /playbooks
                - img [ref=e78]
                - generic [ref=e81]: 指示書
          - generic [ref=e82]:
            - paragraph [ref=e83]: ツール・知識
            - generic [ref=e84]:
              - link "プラグイン" [ref=e85] [cursor=pointer]:
                - /url: /plugins
                - img [ref=e86]
                - generic [ref=e88]: プラグイン
              - link "開発レシピ" [ref=e89] [cursor=pointer]:
                - /url: /recipes
                - img [ref=e90]
                - generic [ref=e92]: 開発レシピ
              - link "メモリ" [ref=e93] [cursor=pointer]:
                - /url: /memory
                - img [ref=e94]
                - generic [ref=e104]: メモリ
          - generic [ref=e105]:
            - paragraph [ref=e106]: 記録・分析
            - generic [ref=e107]:
              - link "セッション" [ref=e108] [cursor=pointer]:
                - /url: /sessions
                - img [ref=e109]
                - generic [ref=e112]: セッション
              - link "成果物" [ref=e113] [cursor=pointer]:
                - /url: /artifacts
                - img [ref=e114]
                - generic [ref=e118]: 成果物
              - link "分析" [ref=e119] [cursor=pointer]:
                - /url: /analytics
                - img [ref=e120]
                - generic [ref=e121]: 分析
          - generic [ref=e122]:
            - paragraph [ref=e123]: システム管理
            - generic [ref=e124]:
              - link "Webhook" [ref=e125] [cursor=pointer]:
                - /url: /webhooks
                - img [ref=e126]
                - generic [ref=e129]: Webhook
              - link "コスト" [ref=e130] [cursor=pointer]:
                - /url: /costs
                - img [ref=e131]
                - generic [ref=e134]: コスト
              - link "組織" [ref=e135] [cursor=pointer]:
                - /url: /org
                - img [ref=e136]
                - generic [ref=e140]: 組織
              - link "設定" [ref=e141] [cursor=pointer]:
                - /url: /settings
                - img [ref=e142]
                - generic [ref=e145]: 設定
      - button "ログアウト" [ref=e147] [cursor=pointer]:
        - img [ref=e148]
        - generic [ref=e151]: ログアウト
    - main [ref=e153]:
      - generic [ref=e154]:
        - generic [ref=e155]:
          - heading "ダッシュボード" [level=1] [ref=e156]
          - paragraph [ref=e157]: 組織全体の稼働状況、未処理タスク、承認待ちを一画面で確認できます。
        - generic [ref=e158]:
          - generic [ref=e159]:
            - generic [ref=e160]:
              - generic [ref=e161]: 稼働中のスキル
              - img [ref=e163]
            - paragraph [ref=e166]: 稼働中のスキルなし
          - link "未完了のToDo 10 done 以外の ToDo を集計" [ref=e167] [cursor=pointer]:
            - /url: /issues
            - generic [ref=e169]:
              - generic [ref=e170]:
                - paragraph [ref=e171]: 未完了のToDo
                - paragraph [ref=e172]: "10"
                - paragraph [ref=e173]: done 以外の ToDo を集計
              - img [ref=e175]
          - generic [ref=e179] [cursor=pointer]:
            - generic [ref=e180]:
              - paragraph [ref=e181]: 本日のセッション
              - paragraph [ref=e182]: "1"
              - paragraph [ref=e183]: 今日の作業セッション数
            - img [ref=e185]
          - link "登録スキル数 328 利用可能なスキル総数" [ref=e187] [cursor=pointer]:
            - /url: /skills
            - generic [ref=e189]:
              - generic [ref=e190]:
                - paragraph [ref=e191]: 登録スキル数
                - paragraph [ref=e192]: "328"
                - paragraph [ref=e193]: 利用可能なスキル総数
              - img [ref=e195]
        - generic [ref=e198]:
          - heading "Claudeに指示" [level=2] [ref=e199]
          - generic [ref=e200]:
            - textbox "指示を入力..." [disabled] [ref=e201]
            - button "停止" [ref=e202] [cursor=pointer]:
              - img [ref=e203]
              - text: 停止
          - generic [ref=e205]:
            - generic [ref=e207]:
              - paragraph [ref=e208]: "Plane API連携テスト2: 自動Issue登録確認"
              - generic [ref=e209]: pending
            - generic [ref=e211]:
              - paragraph [ref=e212]: Plane連携テスト：このジョブはPlane Issueとして自動登録される
              - generic [ref=e213]: pending
            - generic [ref=e215]:
              - paragraph [ref=e216]: Planeとの連携テスト：この指示がplane_issue_idフィールドを持つか確認
              - generic [ref=e217]: pending
        - generic [ref=e218]:
          - generic [ref=e220]:
            - generic [ref=e221]:
              - heading "過去24時間 スキル使用 Top10" [level=3] [ref=e222]
              - generic [ref=e223]: 10分更新
            - generic [ref=e224]:
              - generic [ref=e225]:
                - generic [ref=e226]: "1"
                - generic [ref=e228]:
                  - generic "VoltAgent_awesome-design-md" [ref=e229]
                  - generic [ref=e230]: "2"
              - generic [ref=e233]:
                - generic [ref=e234]: "2"
                - generic [ref=e236]:
                  - generic "ab-test-setup" [ref=e237]
                  - generic [ref=e238]: "1"
              - generic [ref=e241]:
                - generic [ref=e242]: "3"
                - generic [ref=e244]:
                  - generic "agent-eval" [ref=e245]
                  - generic [ref=e246]: "1"
          - generic [ref=e250]:
            - generic [ref=e251]:
              - heading "過去1週間 スキル使用 Top10" [level=3] [ref=e252]
              - generic [ref=e253]: 3時間更新
            - generic [ref=e254]:
              - generic [ref=e255]:
                - generic [ref=e256]: "1"
                - generic [ref=e258]:
                  - generic "VoltAgent_awesome-design-md" [ref=e259]
                  - generic [ref=e260]: "2"
              - generic [ref=e263]:
                - generic [ref=e264]: "2"
                - generic [ref=e266]:
                  - generic "ab-test-setup" [ref=e267]
                  - generic [ref=e268]: "1"
              - generic [ref=e271]:
                - generic [ref=e272]: "3"
                - generic [ref=e274]:
                  - generic "agent-eval" [ref=e275]
                  - generic [ref=e276]: "1"
        - generic [ref=e279]:
          - heading "最近のアクティビティ" [level=2] [ref=e281]
          - generic [ref=e283]:
            - generic [ref=e284]:
              - generic [ref=e285]: 更新
              - generic [ref=e286]: session「866d57d1-3df8-496e-81ed-a410eb231af7」を更新
              - generic [ref=e287]: 2026/04/07 09:15
            - generic [ref=e288]:
              - generic [ref=e289]: 削除
              - generic [ref=e290]: スキル「c969cc2f-febb-4fab-baed-1a784bc3946b」を削除
              - generic [ref=e291]: 2026/04/07 09:15
            - generic [ref=e292]:
              - generic [ref=e293]: 作成
              - generic [ref=e294]: スキル「test-auto-embed」を作成
              - generic [ref=e295]: 2026/04/07 09:15
            - generic [ref=e296]:
              - generic [ref=e297]: 更新
              - generic [ref=e298]: session「866d57d1-3df8-496e-81ed-a410eb231af7」を更新
              - generic [ref=e299]: 2026/04/07 09:14
            - generic [ref=e300]:
              - generic [ref=e301]: 更新
              - generic [ref=e302]: session「866d57d1-3df8-496e-81ed-a410eb231af7」を更新
              - generic [ref=e303]: 2026/04/07 09:14
```

# Test source

```ts
  189 | 
  190 |     // Clear using the X button
  191 |     const clearButton = page.locator('button').filter({ has: page.locator('svg') }).filter({ hasText: '' }).last();
  192 |     // Use keyboard shortcut instead as it's more reliable
  193 |     await searchInput.triple_click();
  194 |     await searchInput.press('Backspace');
  195 | 
  196 |     // Or click the X button (it's rendered as a button with X icon when query is non-empty)
  197 |     // The clear button appears when query is non-empty
  198 |     await page.screenshot({
  199 |       path: path.join(SCREENSHOTS_DIR, '05-ai-recommender-cleared.png'),
  200 |       fullPage: false,
  201 |     });
  202 |   });
  203 | 
  204 |   // -------------------------------------------------------------------------
  205 |   // 4. Category filter
  206 |   // -------------------------------------------------------------------------
  207 |   test('category filter tab narrows displayed skills', async ({ page }) => {
  208 |     const pluginsResponsePromise = page.waitForResponse(
  209 |       (res) => res.url().includes('/api/plugins') && res.status() === 200,
  210 |     );
  211 | 
  212 |     await page.goto('/plugins');
  213 |     await pluginsResponsePromise;
  214 |     await page.waitForLoadState('networkidle');
  215 | 
  216 |     // Category tabs are rendered as buttons with rounded-full style
  217 |     // Look for "AI・エージェント" tab — it may or may not exist depending on data
  218 |     const allTab = page.locator('button').filter({ hasText: /^すべて/ });
  219 |     await expect(allTab).toBeVisible();
  220 | 
  221 |     // Count cards in "すべて" view
  222 |     const allCardsInitial = await page.locator('.grid > *').count();
  223 |     expect(allCardsInitial).toBeGreaterThan(0);
  224 | 
  225 |     // Try to find and click "AI・エージェント" tab
  226 |     const aiTab = page.locator('button').filter({ hasText: 'AI・エージェント' });
  227 |     const aiTabCount = await aiTab.count();
  228 | 
  229 |     if (aiTabCount > 0) {
  230 |       await aiTab.first().click();
  231 |       await page.waitForTimeout(300);
  232 | 
  233 |       await page.screenshot({
  234 |         path: path.join(SCREENSHOTS_DIR, '06-category-filter-ai.png'),
  235 |         fullPage: false,
  236 |       });
  237 | 
  238 |       // After filtering, the grid should only show AI category cards
  239 |       const filteredCards = page.locator('.grid > *');
  240 |       const filteredCount = await filteredCards.count();
  241 |       expect(filteredCount).toBeGreaterThanOrEqual(0);
  242 | 
  243 |       // Switch back to すべて and count should match initial
  244 |       await allTab.first().click();
  245 |       await page.waitForTimeout(300);
  246 |     } else {
  247 |       // If the specific category doesn't exist, try any available category tab
  248 |       const categoryButtons = page.locator('button.rounded-full').filter({ hasNot: page.locator('svg') });
  249 |       const tabCount = await categoryButtons.count();
  250 | 
  251 |       if (tabCount > 1) {
  252 |         // Click the second tab (first non-"すべて" category)
  253 |         await categoryButtons.nth(1).click();
  254 |         await page.waitForTimeout(300);
  255 | 
  256 |         await page.screenshot({
  257 |           path: path.join(SCREENSHOTS_DIR, '06-category-filter-other.png'),
  258 |           fullPage: false,
  259 |         });
  260 | 
  261 |         const filteredCount = await page.locator('.grid > *').count();
  262 |         expect(filteredCount).toBeGreaterThanOrEqual(0);
  263 |       }
  264 |     }
  265 |   });
  266 | });
  267 | 
  268 | // ---------------------------------------------------------------------------
  269 | // 5. Navigation — no "スキル" menu item
  270 | // ---------------------------------------------------------------------------
  271 | test.describe('Navigation', () => {
  272 |   test('sidebar does not contain a standalone "スキル" nav link', async ({ page }) => {
  273 |     await page.goto('/');
  274 |     await page.evaluate((key) => localStorage.setItem('apiKey', key), API_KEY);
  275 |     await page.goto('/');
  276 |     await page.waitForLoadState('networkidle');
  277 | 
  278 |     await page.screenshot({
  279 |       path: path.join(SCREENSHOTS_DIR, '07-navigation.png'),
  280 |     });
  281 | 
  282 |     // The nav should NOT have a link specifically labeled "スキル" pointing to /skills
  283 |     // (Skills was merged into /plugins)
  284 |     const skillsNavLink = page.locator('nav a[href="/skills"]');
  285 |     await expect(skillsNavLink).toHaveCount(0);
  286 | 
  287 |     // The plugins nav link (labeled "プラグイン" or similar) should be present
  288 |     const pluginsNavLink = page.locator('nav a[href="/plugins"]');
> 289 |     await expect(pluginsNavLink).toBeVisible();
      |                                  ^ Error: expect(locator).toBeVisible() failed
  290 |   });
  291 | 
  292 |   test('plugins nav link navigates to plugins page with スキル title', async ({ page }) => {
  293 |     await page.goto('/');
  294 |     await page.evaluate((key) => localStorage.setItem('apiKey', key), API_KEY);
  295 |     await page.goto('/');
  296 |     await page.waitForLoadState('networkidle');
  297 | 
  298 |     // Click plugins nav link
  299 |     const pluginsNavLink = page.locator('nav a[href="/plugins"]');
  300 |     await expect(pluginsNavLink).toBeVisible();
  301 | 
  302 |     const pluginsResponsePromise = page.waitForResponse(
  303 |       (res) => res.url().includes('/api/plugins') && res.status() === 200,
  304 |     );
  305 | 
  306 |     await pluginsNavLink.click();
  307 |     await pluginsResponsePromise;
  308 |     await page.waitForLoadState('networkidle');
  309 | 
  310 |     // Page title should be "スキル" (not "プラグイン")
  311 |     await expect(page.locator('h1')).toContainText('スキル');
  312 | 
  313 |     await page.screenshot({
  314 |       path: path.join(SCREENSHOTS_DIR, '08-plugins-nav-title.png'),
  315 |     });
  316 |   });
  317 | });
  318 | 
  319 | // ---------------------------------------------------------------------------
  320 | // 6. Issues page
  321 | // ---------------------------------------------------------------------------
  322 | test.describe('Issues page', () => {
  323 |   test('loads issue list', async ({ page }) => {
  324 |     await page.goto('/');
  325 |     await page.evaluate((key) => localStorage.setItem('apiKey', key), API_KEY);
  326 | 
  327 |     const issuesResponsePromise = page.waitForResponse(
  328 |       (res) => res.url().includes('/api/issues') && res.status() === 200,
  329 |       { timeout: 15_000 },
  330 |     );
  331 | 
  332 |     await page.goto('/issues');
  333 |     await issuesResponsePromise;
  334 |     await page.waitForLoadState('networkidle');
  335 | 
  336 |     await page.screenshot({
  337 |       path: path.join(SCREENSHOTS_DIR, '09-issues.png'),
  338 |       fullPage: true,
  339 |     });
  340 | 
  341 |     await expect(page.locator('body')).not.toContainText('Something went wrong');
  342 |     await expect(page.locator('body')).not.toContainText('500');
  343 |   });
  344 | });
  345 | 
  346 | // ---------------------------------------------------------------------------
  347 | // 7. Projects page
  348 | // ---------------------------------------------------------------------------
  349 | test.describe('Projects page', () => {
  350 |   test('loads project list', async ({ page }) => {
  351 |     await page.goto('/');
  352 |     await page.evaluate((key) => localStorage.setItem('apiKey', key), API_KEY);
  353 | 
  354 |     const projectsResponsePromise = page.waitForResponse(
  355 |       (res) => res.url().includes('/api/projects') && res.status() === 200,
  356 |       { timeout: 15_000 },
  357 |     );
  358 | 
  359 |     await page.goto('/projects');
  360 |     await projectsResponsePromise;
  361 |     await page.waitForLoadState('networkidle');
  362 | 
  363 |     await page.screenshot({
  364 |       path: path.join(SCREENSHOTS_DIR, '10-projects.png'),
  365 |       fullPage: true,
  366 |     });
  367 | 
  368 |     await expect(page.locator('body')).not.toContainText('Something went wrong');
  369 |   });
  370 | });
  371 | 
  372 | // ---------------------------------------------------------------------------
  373 | // 8. Activity page
  374 | // ---------------------------------------------------------------------------
  375 | test.describe('Activity page', () => {
  376 |   test('loads activity log', async ({ page }) => {
  377 |     await page.goto('/');
  378 |     await page.evaluate((key) => localStorage.setItem('apiKey', key), API_KEY);
  379 | 
  380 |     await page.goto('/activity');
  381 |     await page.waitForLoadState('networkidle');
  382 | 
  383 |     await page.screenshot({
  384 |       path: path.join(SCREENSHOTS_DIR, '11-activity.png'),
  385 |       fullPage: true,
  386 |     });
  387 | 
  388 |     await expect(page.locator('body')).not.toContainText('Something went wrong');
  389 |   });
```