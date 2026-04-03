# Claude Code → Codex: 受け入れテスト報告書

**日時**: 2026-04-04
**対象要件**: `/Users/naoto/Downloads/.company/consulting/reviews/2026-04-03-company-cli-requirements.md`
**種別**: 受け入れテスト報告
**判定**: 条件付き不合格

## 先に結論

今回の受け入れテストでは、API の主要フローは広く通過しましたが、以下 2 点がリリース阻害です。

1. **予算ポリシー作成が 500 で失敗**
   - `POST /api/costs/budget`
   - 実レスポンス: `500 internal_server_error`
   - 実エラー: `numeric field overflow`
   - 要件影響: Phase 5「月次予算ポリシーが設定できる」を満たしていません

2. **UI の i18n が全画面で成立していない**
   - Playwright で実画面確認時、翻訳キーそのものが表示される箇所を複数確認
   - 例:
     - `auth.platformTagline`
     - `auth.loginSubtitle`
     - `layout.console`
     - `layout.sectionOverview`
     - `dashboard.subtitle`
     - `approvals.summary`
     - `approvals.pendingCardDescription`
     - `issues.noDescription`
     - `issues.comments`
   - 要件影響:
     - 4章「UIラベル・ボタン・ナビゲーションを全て翻訳キー化」
     - Phase 9「日本語/英語の切替が全画面で動作する」
   - 言語切替自体は Settings 画面で成功したが、未解決キーが多数残っています

上記 2 件により、受け入れ判定は **条件付き不合格** です。

## 実施環境

- リポジトリ: `/Users/naoto/Downloads/company-cli`
- DB: `docker compose` の `company-postgres`
- API: `pnpm --filter @company/api dev`
- UI:
  - `pnpm --filter @company/ui exec vite --host 0.0.0.0 --port 4173`
  - Playwright から `http://192.168.50.14:4173` で確認
- 事前検証:
  - `pnpm --filter @company/db migrate` PASS
  - `pnpm --filter @company/api exec tsc --noEmit` PASS
  - `pnpm --filter @company/ui exec tsc --noEmit` PASS
  - `GET /health` PASS

## 実施結果

### PASS

- 認証
  - `POST /api/auth/register` 201
  - `POST /api/auth/login` 200
- 組織
  - `GET /api/org` 200
  - `GET /api/org/members` 200
  - seed 後 `GET /api/org/join-requests` 200
  - seed 後 `POST /api/org/join-requests/:id/approve` 200
- Settings
  - `GET /api/settings` 200
  - `PATCH /api/settings` 正常更新 200
  - `claude_api + anthropicApiKey 空` のバリデーション 400
  - `backup.localPath=../escape` のパストラバーサル拒否 400
- Agents
  - `POST /api/agents` 201
  - `claude_api で config.apiKey 無し` のバリデーション 400
  - `POST /api/agents/:id/heartbeat` 200
  - `GET /api/agents` / `GET /api/agents/:id` 200
- Issues
  - `POST /api/issues` 201
  - identifier 自動採番 `COMP-001`
  - 有効エージェントへの自動アサイン確認
  - `PATCH backlog -> in_progress -> done` 成功
  - `POST /api/issues/:id/comments` 201
  - `GET /api/issues/:id/comments` 200
- Goals
  - `POST /api/goals` 201
  - `POST /api/issues/:id/goals` 201
  - `POST /api/goals/:id/recalculate` 200
  - 達成率 `progress: 100` を確認
- Projects
  - `POST /api/projects` 201
  - `GET /api/projects` / `GET /api/projects/:id` 200
- Routines
  - `POST /api/routines` 201
  - `GET /api/routines` 200
  - `POST /api/routines/:id/run` 201
- Plugins
  - `POST /api/plugins` 201
  - `PATCH /api/plugins/:id` 200
  - `POST /api/plugins/:pluginId/jobs` 201
  - `POST /api/plugins/:pluginId/jobs/:jobId/run` 201
- Costs
  - `POST /api/costs` 201
  - `GET /api/costs` 200
- Approvals
  - DB seed 後 `GET /api/approvals` 200
  - `POST /api/approvals/:id/approve` 200
  - `POST /api/approvals/:id/reject` 200
- Activity
  - `GET /api/activity?limit=20` 200
  - plugin / routine / issue / approval / cost 操作が記録されていることを確認
- UI
  - ログイン成功
  - Settings 画面表示成功
  - 言語切替ボタン動作確認
  - Approvals / IssueDetail 画面表示成功

### FAIL

- Phase 5
  - `POST /api/costs/budget` が 500
  - エラー: `numeric field overflow`
  - `GET /api/costs/budget` は 200 だが結果は空
- Phase 9 / i18n 要件
  - 英語切替後も raw key が実画面に残る
  - Login, Layout, Dashboard, Approvals, IssueDetail で再現確認

### 未実施 / 未判定

- `npm install -g @company/cli`
- `company init --docker`
- `company init --native --db-url ...`
- `.company/CLAUDE.md` からの組織設定取り込み
- CLI コマンド群全般
- 8 アダプター全種の実行確認
- Claude サブスク / Anthropic API 実通信
- 予算超過時の自動停止
- 40 画面すべての表示操作
- モバイル表示の詳細確認
- Webhook の HTTP POST 発火
- シークレット暗号化の保存取得
- バックアップ実ジョブの生成とスケジュール実行

## 画面確認メモ

Playwright で以下を確認しました。

- `/login`
  - 表示自体は正常
  - ただし `auth.platformTagline` と `auth.loginSubtitle` がそのまま表示
- `/settings`
  - 言語切替は成功
  - 保存後、英語化された項目と raw key のままの項目が混在
- `/approvals`
  - All フィルタで承認済み / 却下済みデータを表示
  - enriched UI の構造自体は表示成功
  - ただし `approvals.summary`, `approvals.viewIssue`, `approvals.issueContext` など複数キーが未解決
- `/issues/:id`
  - Issue 詳細・コメント表示成功
  - ただし `issues.noDescription`, `issues.comments`, `issues.commentPlaceholder`, `issues.addComment` が未解決

## テストデータ

- テストユーザー: `acceptance-1775231548@example.com`
- テスト企業: `Acceptance Co 1775231548`
- 発番された Issue: `COMP-001`

## 改善提案

### 優先度 P0

- `POST /api/costs/budget` の numeric overflow を修正
  - DB カラム定義と insert 値の桁・scale を確認
  - `limit_amount_usd` / `alert_threshold` の型変換ロジックを見直す
- UI で未解決の翻訳キーを潰す
  - `@company/i18n` 側の locale merge 反映漏れ
  - 各ページのキー名不一致
  - feature locale 読み込み漏れ

### 優先度 P1

- 受け入れテストをスクリプト化して `engineering/test-results/` 配下に保存
- Playwright で言語切替と主要画面の E2E を固定化
- CLI 初期化フローも受け入れ対象に含める

## 判定

**条件付き不合格**

理由:

- 予算設定が API 500 で失敗している
- 多言語切替要件が UI 全体で未達

それ以外の主要 CRUD と承認・目標再計算・アクティビティ記録は概ね通っています。次の再受け入れでは、`costs/budget` と i18n を最優先で潰すのが妥当です。

---

## 修正対応（2026-04-04）

### P0-1: `POST /api/costs/budget` numeric overflow 修正

**対象**: `packages/api/src/routes/costs.ts`
**原因**: `String(limit_amount_usd)` でJavaScript浮動小数点誤差が小数点桁数制限（scale:2）を超過
**修正**: `parseFloat(String(value)).toFixed(2)` に変更し小数点2桁に丸め

```ts
// before
limit_amount_usd: String(limit_amount_usd),
...(alert_threshold && { alert_threshold: String(alert_threshold) }),

// after
limit_amount_usd: parseFloat(String(limit_amount_usd)).toFixed(2),
...(alert_threshold && { alert_threshold: parseFloat(String(alert_threshold)).toFixed(2) }),
```

**コミット**: `a5ecbe7`

### P0-2: i18n dist 再ビルド（raw key 表示問題）

**対象**: `packages/i18n/`
**原因**: `dist/` が古いビルドのまま放置されており、src に追加した翻訳キー・`mergeTranslations`・feature locales（approvals-ja/en.json）が反映されていなかった
**修正**: `pnpm --filter @company/i18n build` でビルドを更新
**確認**: dist/locales/en.json が 251 keys → 436 keys（src と一致）

---

## Codex 再試験スコープ

### コスト・予算系（P0-1 修正対象）

- `POST /api/costs/budget` — numeric overflow が解消されていること（201 返却を確認）
- `GET /api/costs/budget` — 作成後にポリシーが返ること
- `GET /api/costs` — コストイベント取得が正常であること
- Costs UI 表示 — 予算設定フォームの送信成功・一覧反映を確認
- 予算設定後の Settings/Costs 画面への反映

### i18n 未解決キー対応（P0-2 修正対象）

再試験前に `pnpm --filter @company/i18n build` の実行が必要。

- `/login` — `auth.platformTagline` / `auth.loginSubtitle` が英語表示されること
- Layout / ナビゲーション — `layout.console` / `layout.sectionOverview` が英語表示されること
- `/dashboard` — `dashboard.subtitle` が英語表示されること
- `/approvals` — `approvals.summary` / `approvals.issueContext` が英語表示されること
- `/issues/:id` — `issues.noDescription` / `issues.comments` / `issues.commentPlaceholder` / `issues.addComment` が英語表示されること
- `/settings` — 言語切替後の再描画で raw key が残らないこと
- 言語切替後の再描画 — 全画面で en/ja が正しく切り替わること
