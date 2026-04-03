# コミュニティ版リリース品質レポート

**作成日**: 2026-04-04  
**調査範囲**: 全ソースファイル（API / DB / UI / CLI / Adapters）  
**調査方法**: 全ファイルの直接読み込みによる静的レビュー  
**判定**: **リリース不可**

---

## 判定サマリー

| カテゴリ | Critical | High | Medium | Low |
|---------|---------|------|--------|-----|
| API ルート | 6 | 4 | 3 | 1 |
| API エンジン / ミドルウェア | 2 | 3 | 2 | 1 |
| DB スキーマ | 3 | 16 | 6 | 1 |
| UI ページ | 6 | 4 | 8 | 2 |
| CLI コマンド | 3 | 2 | 2 | 1 |
| アダプター | 3 | 4 | 4 | 2 |
| **合計** | **23** | **33** | **25** | **8** |

---

## Critical（リリース不可ブロッカー）

### C-01: テナント間データ漏洩 — approvals.ts
```
GET /api/approvals  company_id フィルタなし
POST /api/approvals/:id/approve  company_id チェックなし
POST /api/approvals/:id/reject   company_id チェックなし
```
- 認証済みユーザーが全テナントの承認データを閲覧・操作可能

### C-02: エージェント実行履歴の漏洩 — agents.ts
```
GET /api/agents/:id/runs  company_id チェックなし
```
- 任意のエージェントの実行ログを取得可能

### C-03: SSRF 脆弱性 — plugins.ts
```
webhook URL に localhost / 127.0.0.1 が許可されている
プロトコルチェックのみでプライベート IP を拒否していない
```

### C-04: コマンドインジェクション脆弱性 — heartbeat-engine.ts
```typescript
// L101: agentId / runId をテンプレートリテラルで spawn に渡している
`console.log(JSON.stringify({ agent_id: '${agentId}', run_id: '${runId}', status: 'ok' }))`
```
- 悪意ある agentId で任意 Node.js コード実行が可能

### C-05: シェルインジェクション脆弱性 — アダプター
```
claude-local.ts: tmpFile パスに未サニタイズのタスク ID を使用
opencode-local.ts: echo ${JSON.stringify(prompt)} | opencode run -
```

### C-06: エージェント実行がスタブ — heartbeat-engine.ts
```typescript
// executeAgentProcess() は console.log をspawnするだけ
// 実際のアダプターを呼び出していない（将来実装と明記）
```
- 「エージェントが動く」という中核機能が未実装

### C-07: メンバー取得 URL に :id が未展開 — cli/org.ts
```typescript
'/api/companies/:id/members'  // リテラル文字列として送信される
```

### C-08: Docker コンテナ名の不一致 — cli/backup.ts
```
backup.ts:  company-db       （実際には存在しない）
init.ts:    company-postgres  （正しい名前）
→ バックアップが常に失敗する
```

### C-09: Approvals ルートロール昇格 — org.ts
```
POST /api/org/join-requests/:id/approve  で role の値にバリデーションなし
role='admin' を指定すると管理者昇格が可能
```

### C-10: Projects workspaces のテナント分離欠落 — projects.ts
```
GET /api/projects/:projectId/workspaces  で company_id チェックなし
```

### C-11: 主キー欠落テーブル — DB スキーマ
```
issue_label_assignments（複合 PK なし）
issue_read_states（PK 完全欠落）
project_goals（複合 PK なし）
```

### C-12: Routine 実行のテナント分離欠落 — routines.ts
```
POST /api/routines/:routineId/run  で company_id チェックなし
任意の routine_id を指定して実行可能
```

### C-13: Gemini Adapter の API キーを URL に埋め込み — adapters
```
https://generativelanguage.googleapis.com/.../key=${apiKey}
```
- ログ・ネットワークトレースに平文で記録される

---

## High（リリース前に修正を強く推奨）

### H-01: Cursor アダプターがスタブ実装
```typescript
// runTask() は常にキュー追加メッセージを返すのみ
// 実際の実行処理なし（コメントで明記）
```

### H-02: identifier 採番の race condition — issues.ts
```typescript
// SELECT count(*) → count+1 方式
// 同時リクエストで COMP-001 が重複生成される
// ※identifier カラムに UNIQUE 制約があれば DB で弾かれるが、スキーマ確認要
```

### H-03: DB 外部キー制約欠落（16 テーブル）
```
issue_comments.author_id, approvals.approver_id, issue_goals.goal_id,
agent_api_keys.agent_id, join_requests.reviewed_by ほか 11 テーブル
→ 参照整合性が保証されない
```

### H-04: UNIQUE 制約不足
```
issues.identifier に (company_id, identifier) 複合 UNIQUE なし
company_secrets, issue_labels, goals, projects にも (company_id, name) UNIQUE なし
```

### H-05: Anthropic API キーを平文 DB 保存 — settings.ts
```
暗号化なし。DB 漏洩時に外部サービスのキーが流出
```

### H-06: Goals / Projects の「新規作成」ボタンが未実装 — UI
```
GoalsPage.tsx   L32: onClick なし
ProjectsPage.tsx L31: onClick なし
```

### H-07: crash-recovery.ts のロジック矛盾
```
L66-70: status を 'recovering' に設定
L85-89: その直後に 'idle' で上書き → recovering 状態が意味をなさない
```

### H-08: budget-monitor.ts の SQL 論理エラー
```
cost_events に company_id フィールドがなく、agents との join に依存
agents 削除済みの場合コスト計算が不正確になる
月次集計の月初計算がタイムゾーン非考慮（UTC 固定）
```

### H-09: パスワード強度チェックが長さのみ — validate.ts
```typescript
return password.length >= 8 && password.length <= 128;
// '12345678' が通過する
```

### H-10: routines.ts PATCH エンドポイント欠落
```
cron_expression / name / description の更新が不可能
```

### H-11: agents.ts の type 初期化 — CLI
```typescript
let type: AgentType | undefined;
// options.type が undefined でも条件を抜けて type=undefined のまま送信される
```

---

## Medium（コミュニティ版として許容範囲外）

### M-01: PluginsPage のエラーハンドリング欠落
```
handleCreate / handleToggleEnabled に try-catch なし
API エラー時にユーザーへの通知なし
```

### M-02: ActivityPage の entity_type / action をハードコード表示
```
activity.entity_type, activity.action を翻訳せずそのまま表示
```

### M-03: 言語設定をサーバーに同期しない — SettingsPage
```
localStorage のみ。別デバイス・セッション復帰時に設定が引き継がれない
```

### M-04: InboxPage が未実装スタブ
```
ナビゲーションにリンクがあるが EmptyState のみを表示
```

### M-05: GoalsPage でステータスを未翻訳表示
```
goal.status をそのまま表示（'in_progress' 等が露出）
```

### M-06: ActivityPage で actor_id をそのまま表示
```
UUID がそのまま画面に出る（ユーザー名取得なし）
```

### M-07: AgentsPage でエージェント種別をハードコード
```
agentTypeLabels が i18n 未対応のハードコード文字列
```

### M-08: cron 式のバリデーションなし — routines.ts
```
不正な cron 式でも登録可能
```

### M-09: tokensUsed 未返却のアダプター
```
claude_local, codex_local, cursor が tokensUsed を返していない
コスト記録が不正確になる
```

### M-10: タイムアウト値の不統一 — アダプター
```
60s / 120s / 180s とアダプターごとにバラバラ
```

---

## 正常に実装されている点

### API
- 認証・テナント分離: settings / agents / issues / costs / goals / projects は company_id フィルタ徹底
- バリデーション: sanitizeString によるXSS対策、isValidEmail / isStrongPassword 関数
- パストラバーサル対策: backup.localPath の `..` 検出
- better-auth を用いた API キーハッシュ検証
- graceful shutdown 実装

### DB
- 41 テーブルが全て存在（Group A-E 全確認）
- companies / users / agents / issues 等の主要テーブルは PK・インデックス適切
- decimal の precision/scale は budget_policies を除き妥当

### UI
- 受け入れテスト PASS 済みの主要 CRUD フロー
- i18n ja/en 両言語（436 キー）が正常動作
- Alert / LoadingSpinner / EmptyState コンポーネントの統一的な使用
- React Query による適切な状態管理とキャッシュ無効化

### CLI
- init（Docker/Native）、agents list/detail/delete、issues list/update の基本フロー
- DB 接続 URL マスキング（セキュリティ考慮済み）

### アダプター
- claude_api: 完全実装（タイムアウト・エラーハンドリング・heartbeat 含む）
- openclaw_gateway: OpenAI 互換 API を正しく呼び出し
- pi_local: Raspberry Pi 向けローカル Ollama を正しく呼び出し
- heartbeat() の実装は全アダプターで完備

---

## 結論

**コミュニティ版リリース不可**

Critical 13件のうち、特に以下3件は即時データ漏洩・セキュリティ侵害に繋がる。

| 優先 | 問題 | 理由 |
|------|------|------|
| 最優先 | C-01: approvals テナント漏洩 | 他社の承認データが誰でも見える |
| 最優先 | C-04/C-05: コマンド・シェルインジェクション | サーバー上で任意コード実行可能 |
| 最優先 | C-06: heartbeat エンジンがスタブ | 製品の中核機能が実際には動作しない |

C-01 / C-04 / C-05 を修正し、C-06 の「動作しない」旨をドキュメント（README / CHANGELOG）に明記した上で v0.1.0-alpha として限定公開するのが現実的な最短ルートと判断する。

