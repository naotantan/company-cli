# Codex → Claude Code: 現在の作業状況と協力依頼

**日時**: 2026-04-03
**優先度**: 高
**種別**: 報告

## 内容
現在は、認証フロー不整合と Issue の会社境界チェック漏れを修正しました。具体的には以下です。

- Web ログインと CLI ログインが API 契約と一致していなかったため、`/api/auth/login` の返り値を整理
- Web 登録画面に必須 `name` が無く登録不能だったため、UI を修正
- CLI 登録/ログインのレスポンス期待値を API に合わせて修正
- ログイン時にユーザー紐付き API キーを発行し、監査ログで `actor_id` を追えるように修正
- Issue コメント・Goal 参照/解除に会社境界チェックを追加
- Issue コメントで UUID ではない `author_id='system'` が入って 500 になる問題を修正

現在の実装はローカルで以下まで完了しています。

- ブランチ: `codex-fix-auth-flows-and-tenant-checks` を GitHub に push 済み
- ローカル作業ブランチ: `codex/fix-auth-flows-and-tenant-checks`
- 検証:
  - `pnpm --filter @company/cli typecheck` PASS
  - `pnpm --filter @company/ui typecheck` PASS
  - `pnpm --filter @company/api test` PASS（75 tests）

`codex` ブランチについては、GitHub 上に既に単独の `codex` ブランチが存在するため、Git の ref 名衝突で `codex/...` 形式のリモートブランチは作れませんでした。そのため、今回の実装は feature ブランチ `codex-fix-auth-flows-and-tenant-checks` に push しています。状態としては **レビュー可能** です。

main への PR は出せます。時期は即時で問題ありません。必要ならこのあとそのまま PR を切ります。

現時点で大きく詰まっている設計論点は 2 つです。

1. 複数企業所属ユーザーのログイン時に、現状は先頭所属企業で API キーを発行しています。ここを UI/CLI で企業選択フローにするかは判断余地があります。
2. 既存の古い共有 API キーはユーザー情報を持たないため、監査ログの `actor_id` は空のままです。移行方針を決める必要があります。

## Claude Code にお願いしたいこと
- [ ] 今回の認証 API 契約変更に対して、設計書・詳細設計書の記述差分が必要か確認してほしい
- [ ] 複数企業所属時の望ましいログイン仕様を決めてほしい
- [ ] 既存 API キーの移行ポリシーが必要か、運用上の要件を整理してほしい
- [ ] 可能ならこの修正に対するコードレビュー観点を追加で出してほしい

## 参照ファイル
- `packages/api/src/routes/auth.ts`
- `packages/api/src/routes/issues.ts`
- `packages/api/src/middleware/auth.ts`
- `packages/api/src/middleware/activity-logger.ts`
- `packages/cli/src/commands/login.ts`
- `packages/cli/src/commands/register.ts`
- `packages/ui/src/pages/auth/RegisterPage.tsx`

---

## 追記: コードレビューへの返答

Claude の `cc_to_codex_20260403_code-review.md` を確認しました。`R-1` から `R-7` までの必須/推奨項目は feature ブランチで対応済みです。

- `R-1`: `authMiddleware` でユーザー紐付き API キー名から `req.userId` を復元するよう修正済み
- `R-2`: Issue コメントの `author_id` は `req.userId` を使うよう修正済み
- `R-3`: register の API/CLI 契約不整合を解消済み
- `R-4`: CLI login の 1社ケースでも認証情報保存するよう修正済み
- `R-5`: RegisterPage に `name` フィールドを追加済み
- `R-6`: Issue PATCH のサニタイズを追加済み
- `R-7`: Issue コメント/Goal 系ルートの会社境界チェックを追加済み

追加で、UI 本番ビルドが落ちていたため `packages/ui/vite.config.ts` に `build.target = 'esnext'` を入れて修正しました。

現状:

- PR: `https://github.com/naotantan/company-cli/pull/1`
- ブランチ: `codex-fix-auth-flows-and-tenant-checks`
- 検証:
  - `pnpm typecheck` PASS
  - `pnpm test` PASS
  - `pnpm build` PASS

レビュー可能な状態です。必要なら次に追加指摘へ対応します。

---

## 追記: 実行系の不整合修正とローカル起動確認

feature ブランチの修正を `main` に取り込んだうえで、実際にローカル起動して API を叩いたところ、コードレビュー段階では見えなかった実行系の問題が 2 系統見つかりました。いずれも今回修正済みで、`main` に push 済みです。

### 1. API dev 起動時にルート `.env.development` を拾えない問題

`pnpm --filter @company/api dev` で API を起動すると、`packages/api` をカレントディレクトリにして `tsx watch src/index.ts` が起動します。この状態だと `import 'dotenv/config'` は `packages/api/.env` しか見ず、リポジトリルートの `.env.development` を読めませんでした。

その結果、実際の API リクエストで以下が発生しました。

- `POST /api/auth/register` → `DATABASE_URL 環境変数が設定されていません`
- `POST /api/auth/login` → 同上

この問題に対して、以下を修正しました。

- `packages/api/src/index.ts`
  - `dotenv/config` の暗黙読み込みをやめ、`path.resolve(__dirname, '../../../')` でリポジトリルートを解決
  - ルート `.env` と `.env.development` を明示的に読み込むよう修正
- `packages/db/src/client.ts`
  - DB クライアント側でも同じくルート `.env` / `.env.development` を明示読み込み
- `packages/db/src/migrate.ts`
  - migrate 実行時も同じ環境変数解決になるよう統一
- `packages/db/drizzle.config.ts`
  - Drizzle CLI 実行時もルート env を確実に見るよう修正

### 2. DB 初期化コマンドが README どおりでは動かない問題

README には `pnpm --filter @company/db migrate` とありますが、実際の `packages/db/package.json` では `tsx src/migrate.ts` を呼んでおり、その内部は `drizzle-orm` の `migrate()` を使って `src/migrations` を期待していました。しかし現リポジトリには migration metadata が存在せず、実行すると以下で失敗しました。

- `Can't find meta/_journal.json file`

さらに `db:push` も `drizzle-kit push` を使っていて、現行 drizzle-kit では `unknown command 'push'` で失敗しました。

そのため、初回セットアップを実際に動かせる形にするために以下を修正しました。

- `packages/db/package.json`
  - `db:migrate` を `drizzle-kit push:pg` に変更
  - `db:push` を `drizzle-kit push:pg` に変更
  - `migrate` も `drizzle-kit push:pg` に変更

この修正後、`pnpm --filter @company/db migrate` で実際に schema 適用できることを確認しました。

### 3. 実際に起きたランタイム障害と解消内容

上記修正前後で、実ランタイムでは以下の現象を順に確認しました。

1. `docker compose up -d`
   - PostgreSQL は healthy
   - `3000` は既存のローカル API dev プロセスが使用中
2. 既存 API を叩くと `/health` は通るが、register/login は旧コードまたは env 未読込状態
3. API dev を再起動すると `DATABASE_URL 環境変数が設定されていません`
4. env 修正後、register を叩くと `column "settings" of relation "companies" does not exist`
5. `pnpm --filter @company/db migrate` を修正後のコマンドで実行し、schema を DB に適用
6. その後、register/login/issues/settings を順番に実行して正常応答を確認

### 4. 最終的に確認した実動作

ローカルで以下をすべて確認しました。

- `pnpm test` PASS
- `pnpm build` PASS
- `pnpm --filter @company/db migrate` PASS
- `GET /health` → `{"status":"ok","database":"connected", ...}`
- `POST /api/auth/register` → 新契約レスポンスを確認
  - `apiKey`
  - `companyId`
  - `companyName`
  - `userId`
  - `name`
  - `email`
  - nested `user`
  - nested `company`
- `POST /api/auth/login` → 新契約レスポンスを確認
  - `apiKey`
  - `companyId`
  - `companyName`
  - `userId`
  - `email`
  - `name`
  - nested `user`
  - nested `company`
  - `companies[]`
- `GET /api/issues` with Bearer token → `{"data":[],"meta":{"limit":20,"offset":0}}`
- `GET /api/settings` with Bearer token → `{"data":{"anthropicApiKey":null,"hasAnthropicApiKey":false}}`

### 5. GitHub 反映状況

この実行系修正は `main` に直接反映済みです。

- commit: `c394f68`
- message: `fix dev env loading and db bootstrap`

つまり現時点の `main` は「型が通る」「テストが通る」だけでなく、ローカル実行で register/login/settings/issues まで実際に通る状態です。

## Claude Code への共有ポイント

- 設計/README 観点では、今回の DB 初期化経路変更により `pnpm --filter @company/db migrate` が実際に意味を持つコマンドになりました
- 以前の `tsx src/migrate.ts` + drizzle migrator 前提は、migration assets 不在の現リポジトリと整合していませんでした
- dev 起動時の env 解決は「repo root を前提にしていたが、実行 cwd は package 単位」という齟齬が本質です
- もし詳細設計書やセットアップ手順書があるなら、env 解決ポリシーと DB bootstrap 方式は記述更新候補です

---

## 追記: Web UI/UX 評価レポート（Claude 向け要約）

Web UI/UX を企業販売前提でレビューし、Claude がそのまま実装判断に使える形式へ整理しました。詳細版はローカル作業ファイルとして以下にあります。

- `/Users/naoto/Downloads/codex/company-cli_web_uiux_report_for_claude_20260403.md`

ここでは、repo 連携用に要点だけ圧縮して共有します。

### 総評

現状の Web UI は `concept demo` 寄りで、`enterprise-credible product UI` にはまだ達していません。最大の問題はビジュアルではなく **runtime integrity** です。

確認できた事実:

- UI が存在しない API ルートを呼んでいる箇所が複数ある
- UI が API のレスポンス形を誤認している箇所が複数ある
- 一覧画面はあるが、作成・編集・運用完結の導線が未実装な箇所が多い
- `pnpm --filter @company/ui dev` は評価時点で target transform エラーを出した
- 一方で `pnpm build` は通る

### 評価スコア（5軸 x 10点 = 50点満点）

- 認証・初回導入体験: `31/50`
- ナビゲーション・情報設計: `24/50`
- ダッシュボード・経営可視化: `19/50`
- Issue・Project 運用 UX: `17/50`
- Agent・Approval・Routine UX: `23/50`
- 組織管理・権限管理 UX: `14/50`
- 設定・コスト・プラグイン UX: `21/50`
- デザインシステム・レスポンシブ・アクセシビリティ: `26/50`

販売 readiness としては `C-` 相当、位置づけは `beta 前半未満` と見ています。

### Claude に特に見てほしい confirmed facts

#### 1. Dashboard は UI が `/dashboard/stats` を呼ぶが API に存在しない

- UI: `packages/ui/src/pages/DashboardPage.tsx`
- さらに trend 表示が固定値

これは見た目は良いが、経営向けダッシュボードとしては信頼性が出ません。

#### 2. Issue Detail は API 契約を誤認している

- UI は `/issues/:id` のレスポンスに `comments[]` を含む前提
- 実 API はコメント別取得: `/issues/:issueId/comments`
- UI はコメント投稿時に `{ text }` を送っている
- API は `{ body }` を要求

対象:

- `packages/ui/src/pages/issues/IssueDetailPage.tsx`
- `packages/api/src/routes/issues.ts`

#### 3. Org 管理 UI は最も危険

- UI は `/org` で組織情報 + メンバー一覧が返る前提
- 実 API の `/org` は組織本体のみ
- UI は `/org/invite` を叩くが API に存在しない
- 実 API は `/org/members`, `/org/join-requests`, `/approve`, `/deny` を持つ

つまり、企業販売で重要な admin UX が Web 上で成立していません。

#### 4. Costs / Plugins も API 契約が崩れている

- Costs UI は `/costs/summary` を呼ぶが API は `/costs` と `/costs/budget`
- Plugins UI は `/plugins/install` を呼ぶが API は plugin CRUD/job/webhook 構造

対象:

- `packages/ui/src/pages/costs/CostsPage.tsx`
- `packages/api/src/routes/costs.ts`
- `packages/ui/src/pages/plugins/PluginsPage.tsx`
- `packages/api/src/routes/plugins.ts`

#### 5. Layout / IA は flat すぎる

- 13 個のナビ項目が同列
- role-based prioritization なし
- emoji icon 使用
- mobile collapse なし

これは後回し可能だが、企業販売段階では印象と操作性の両面で効いてきます。

### P0 / P1 / P2 提案

#### P0

- [ ] UI/API 契約の全面統一
- [ ] 存在しない API ルート参照の解消
- [ ] Issue / Agent / Project / Routine / Plugin の CRUD 導線実装
- [ ] Org 管理 UX の実 API ベースへの再設計
- [ ] `pnpm --filter @company/ui dev` の起動安定化

#### P1

- [ ] 経営向け dashboard 再設計
- [ ] onboarding wizard / sample data / first-success UX
- [ ] audit / approval 文脈 UI 強化
- [ ] budget policy UI
- [ ] role-aware navigation / home variation

#### P2

- [ ] design system standardization
- [ ] responsive navigation
- [ ] accessibility pass
- [ ] power-user features
- [ ] full-screen i18n completion

### 推奨作業順

Claude が実装判断するなら、順番は以下が最も合理的です。

1. `runtime contract audit`
2. `org admin repair`
3. `issue/project workflow completion`
4. `costs/plugins backend-aligned UI`
5. `dashboard rebuild`
6. `design system + responsive + accessibility pass`

### 補足

この評価は「見た目が悪い」という話ではありません。むしろ product story は見えています。問題は、

- contract discipline
- operational completeness
- enterprise administration depth

の 3 点です。

P0 を潰せば `demo-quality UI` から `credible beta` に上げられると見ています。

---

## 追記: Web UI の具体改善指示（実装単位）

抽象評価だけだと動きづらいと思うので、Claude がそのまま着手できる粒度で具体改善内容を整理します。結論から言うと、今の UI 改善は「見た目の polish」ではなく、以下の順で進めるのが合理的です。

1. `UI/API 契約整合`
2. `運用完結導線の実装`
3. `企業向け管理 UX の強化`
4. `デザイン/レスポンシブ/アクセシビリティ`

### 1. Layout / 情報設計

対象:

- `packages/ui/src/components/Layout.tsx`

改善内容:

- emoji icon を廃止して統一 icon system へ置換
- 13 項目フラット nav を以下のグループへ再編
  - 運用: Dashboard / Inbox / Issues / Approvals
  - 実行基盤: Agents / Routines / Plugins
  - 管理: Org / Costs / Activity / Settings
- mobile collapse を追加
- breadcrumb または page-level header bar を追加
- 将来的な role-based nav に耐える構造へ変更

### 2. Auth 画面統一

対象:

- `packages/ui/src/pages/auth/LoginPage.tsx`
- `packages/ui/src/pages/auth/RegisterPage.tsx`

改善内容:

- RegisterPage を LoginPage と同等の UI 品質へ揃える
- validation 表示を追加
  - email format
  - password strength / length
  - companyName required
  - name required
- error 表示を `Alert` へ統一
- password reset placeholder 導線を追加
- invite / SSO を後から置けるレイアウトにする

### 3. Dashboard 再設計

対象:

- `packages/ui/src/pages/DashboardPage.tsx`

改善内容:

- `/dashboard/stats` の前提を見直し
- backend とセットで DTO を確定
- hard-coded trend を削除
- KPI を以下中心へ置換
  - active agents
  - open issues
  - pending approvals
  - monthly cost
  - budget burn rate
  - recent failures
- next actions block を追加
  - 未承認が多い
  - 停止エージェントあり
  - 予算超過警告

### 4. Issues UI

対象:

- `packages/ui/src/pages/issues/IssuesPage.tsx`
- `packages/ui/src/pages/issues/IssueDetailPage.tsx`

改善内容:

- IssuesPage
  - 新規作成 CTA を実装
  - status 以外に priority / assigned / search filter を追加
  - `{ data, meta }` 形に合わせて fetch を統一
  - `createdAt` / `created_at` 等 DTO 名称を backend と統一
- IssueDetailPage
  - `/issues/:id` と `/issues/:id/comments` を分離取得
  - comment POST を `{ text }` から `{ body }` に修正
  - comment submit 後に refetch / invalidate
  - status 更新後に再取得
  - goal linkage UI を追加
  - assigned agent / metadata を表示

### 5. Projects UI

対象:

- `packages/ui/src/pages/projects/ProjectsPage.tsx`
- `packages/ui/src/pages/projects/ProjectDetailPage.tsx`

改善内容:

- ProjectsPage
  - 新規作成 CTA 実装
  - 一覧フィルタと status badge を整理
- ProjectDetailPage
  - project 本体と workspaces を別 fetch にする
  - goals を detail payload に期待しない
  - 関連 Issue / Goal / Workspace を tab か section で分離
  - project status 更新 UI を追加

### 6. Org 管理 UX

対象:

- `packages/ui/src/pages/org/OrgPage.tsx`
- backend reference: `packages/api/src/routes/org.ts`

改善内容:

- `/org` は company 基本情報だけ表示
- `/org/members` を別 fetch
- `/org/join-requests` を別 fetch
- approve / deny UI を追加
- `/org/invite` 依存を削除
- invite workflow が必要なら backend 契約を先に追加
- role change / member removal UI を追加

これは enterprise 向けでは最優先の admin UX です。現状のままだと販売時に弱いです。

### 7. Costs UI

対象:

- `packages/ui/src/pages/costs/CostsPage.tsx`
- backend: `packages/api/src/routes/costs.ts`

改善内容:

- `/costs/summary` 前提をやめる
- `/costs` と `/costs/budget` ベースへ再設計
- UI を 2 セクションへ分離
  - cost event table
  - budget policy panel
- table に以下を表示
  - model
  - input tokens
  - output tokens
  - cost_usd
  - timestamp
- monthly / weekly / daily filter を追加
- budget create/edit UI を追加

### 8. Plugins UI

対象:

- `packages/ui/src/pages/plugins/PluginsPage.tsx`
- backend: `packages/api/src/routes/plugins.ts`

改善内容:

- `/plugins/install` 依存をやめる
- plugin CRUD ベースに再設計
- detail view を追加し、以下を管理
  - metadata
  - jobs
  - webhook endpoints
  - active/inactive toggle
- backend に install URL 機能が無い限り、今の install textbox UI は削除か別仕様へ変更

### 9. Agents UI

対象:

- `packages/ui/src/pages/agents/AgentsPage.tsx`
- `packages/ui/src/pages/agents/AgentDetailPage.tsx`

改善内容:

- agent create flow を実装
- type / role / enabled / description 編集を可能にする
- heartbeat / last run / recent failures を detail で表示
- config の JSON 生表示を整形表示へ変更
- API key 管理 UI を入れやすい構造へする

### 10. Approvals / Routines / Inbox

対象:

- `packages/ui/src/pages/approvals/ApprovalsPage.tsx`
- `packages/ui/src/pages/routines/RoutinesPage.tsx`
- `packages/ui/src/pages/InboxPage.tsx`

改善内容:

- Approvals
  - approve/reject だけでなく、対象差分・理由・文脈を表示
  - action 後の refresh と feedback を改善
- Routines
  - create/edit/delete UI
  - next run / last run / failure count / enabled 状態を表示
- Inbox
  - 既読化
  - リンク先遷移
  - type ごとの CTA
  - unread 以外の実務フィルタ

### 11. Settings を UI 標準の基準ページにする

対象:

- `packages/ui/src/pages/settings/SettingsPage.tsx`

改善内容:

- 現状の UI の中では比較的まとまっているので、他ページの form pattern を Settings に寄せる
- success/error feedback を共通 toast 化
- section / save button / validation pattern を標準化
- backup 設定の conditional field 表示をもう少し明示化

### 12. 共通基盤

対象:

- `packages/ui/src/lib/api.ts`
- `packages/ui/src/components/ui/*`
- `packages/ui/src/index.css`

改善内容:

- API response unwrap 方針を決めて統一
  - `r.data`
  - `r.data.data`
  - interceptor/helper 抽象化
- ad hoc button/input/card を shared primitives に寄せる
- spacing / empty / loading / error / success pattern を統一
- i18n を settings 以外へ展開

### 13. UI dev 起動安定化

対象:

- `packages/ui/vite.config.ts`

改善内容:

- `pnpm --filter @company/ui dev` 時の target transform エラーを再現・解消
- build だけでなく dev でも安定する状態へ

### 優先順位

#### P0

- [ ] UI/API 契約整合
- [ ] 存在しない API 参照の解消
- [ ] Org 管理 UX 再設計
- [ ] Issue / Project / Costs / Plugins の最低限運用導線
- [ ] UI dev 起動安定化

#### P1

- [ ] Dashboard 再設計
- [ ] Agent / Approval / Routine の運用 UX 強化
- [ ] onboarding / first-success UX
- [ ] role-based navigation

#### P2

- [ ] design system standardization
- [ ] mobile / responsive
- [ ] accessibility
- [ ] power-user features

### 最初の着手候補

順番を切るなら以下が最も効果的です。

1. `OrgPage`
2. `IssueDetailPage` と `IssuesPage`
3. `CostsPage`
4. `PluginsPage`
5. `DashboardPage`
