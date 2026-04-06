# maestro

**Claude Code のスキル・エージェントを組織で安全に運用するためのオープンソースプラットフォーム**

**日本語** | [English](./README.en.md)

---

## maestro とは

Claude Code（および Claude API）を使って AI エージェントを日々の業務に導入していくと、「誰がどのスキルを使っているか分からない」「API コストが把握できない」「重要な操作を AI に任せきりにできない」といった運用上の課題が出てきます。

maestro は、そうした課題を解決するための **AI エージェント運用管理プラットフォーム** です。

- Claude Code スキルの **インストール・有効化・バージョン管理** を Web UI から操作
- エージェントの **ヘルスチェック・クラッシュ復旧・予算監視** を自動化
- Plane などのプロジェクト管理ツールと **双方向同期**
- 全操作に **監査ログ** を記録し、重要な操作には **人間の承認ゲート** を設定
- REST API・Web ダッシュボード・CLI の **3 インターフェース** に対応

---

## 主な機能

### スキル管理
- GitHub リポジトリからの **ワンクリックインストール**
- everything-claude-code など主要スキルセットとの **自動同期**
- スキルごとの使い方サンプル（`使い方の例`）を自動抽出してダッシュボードに表示
- カテゴリ分類・お気に入り・使用回数トラッキング
- 有効化 / 無効化・アンインストール

### エージェント運用
- **30秒間隔のヘルスチェック**（異常検知 → 自動アラート）
- **クラッシュ時の自動復旧**（最大 3 回リトライ）
- **月額予算上限**の設定 → 超過時にエージェントを自動停止
- エージェント間の **handoff チェーン**（A → B → C と連鎖させる）

### Issue・プロジェクト管理
- 組み込みの **Issue トラッカー**（Backlog / Todo / In Progress / Done / Cancelled）
- **Plane 連携**：Issue ステータスを双方向にリアルタイム同期
- プロジェクト・マイルストーン管理
- 完了時にコメントで対応内容を自動記録（CLAUDE.md ワークフロー）

### セッション・メモリ
- Claude Code セッションの **作業記録を自動保存**（Stop フック連携）
- セッション横断の **長期記憶ストア**（MCP memory パッケージ）
- セッションサマリーの構造化保存（headline / tasks / decisions / 変更ファイル）

### セキュリティ・マルチテナント
- **company_id** によるデータ完全分離
- Bearer トークン認証（user キー / board キー / company キーの 3 種類）
- Webhook URL の SSRF 対策（DNS 解決 + プライベート IP ブロック）
- AES-256-GCM による認証情報の暗号化保存
- 全リクエストへの `X-Request-ID` 付与・レート制限・Helmet.js CSP

### その他
- **成果物（Artifacts）管理** - report / image / document / code 等
- **プレイブック・レシピ** - 繰り返しタスクの定型化
- **通知システム** - アクティビティに基づくアラート
- **全文検索** API
- **Webhook** - 外部サービスへのイベント送信
- **i18n** - 日本語・英語・中国語対応

---

## 技術スタック

| 分類 | 技術 |
|---|---|
| 言語 | TypeScript（strict モード） |
| API サーバー | Express.js |
| データベース | PostgreSQL 17 |
| ORM | Drizzle ORM |
| フロントエンド | React 18 + Vite + Tailwind CSS |
| パッケージ管理 | pnpm（モノレポ） |
| テスト | Vitest |
| コンテナ | Docker / Docker Compose |
| ライセンス | MIT |

### パッケージ構成

```
packages/
├── shared/          # 共通定数・型定義
├── db/              # Drizzle スキーマ・クライアント
├── i18n/            # 多言語リソース（ja / en / zh）
├── adapters/        # AI アダプター（Claude / Gemini / Codex）
├── api/             # Express REST API サーバー
├── cli/             # CLI（17 コマンド）
├── ui/              # React ダッシュボード
└── mcp-memory/      # MCP メモリサーバー
```

依存順: `shared → db → i18n → adapters → api → cli → ui`

---

## インストール

### 方法 1：インストールスクリプト（推奨）

**前提条件：Docker のみ**

```bash
curl -fsSL https://raw.githubusercontent.com/naotantan/maestro/main/install.sh | bash
```

自動で以下を実行します。

1. maestro をクローン（`~/maestro` に配置）
2. `.env` ファイルを自動生成
3. `docker compose up --build` で全コンテナを起動

完了後、ブラウザで `http://localhost:5173` を開くだけです。

---

### 方法 2：Docker Compose（手動）

**前提条件：Docker のみ**

```bash
git clone https://github.com/naotantan/maestro.git
cd maestro
cp .env.example .env          # 必要に応じて編集
docker compose up -d --build
```

| サービス | URL |
|---|---|
| ダッシュボード（UI） | http://localhost:5173 |
| API | http://localhost:3000 |

---

### よく使うコマンド

```bash
# 停止
docker compose down

# 再起動
docker compose up -d

# ログ確認
docker compose logs -f

# 更新（最新コードを pull して再ビルド）
git pull && docker compose up -d --build
```

---

### ローカル開発環境（Node.js）

Node.js での開発時は以下の手順で起動します。

**前提条件：Node.js 20+・pnpm 9+・Docker**

```bash
git clone https://github.com/naotantan/maestro.git
cd maestro
pnpm install
cp .env.example .env
docker compose up -d postgres   # DB のみ起動
pnpm db:migrate
pnpm dev                        # API + UI を同時起動
```

---

## API の使い方

### 認証

全リクエストに `Authorization: Bearer <api_key>` ヘッダーが必要です。

```bash
# ログイン
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password"}'
```

### 主要エンドポイント

| エンドポイント | 説明 |
|---|---|
| `GET /api/plugins` | スキル一覧 |
| `POST /api/plugins/update-all` | 全スキルを GitHub から更新 |
| `GET /api/issues` | Issue 一覧 |
| `PATCH /api/issues/:id` | Issue 更新（ステータス変更など） |
| `POST /api/issues/:id/comments` | コメント追加 |
| `GET /api/agents` | エージェント一覧 |
| `GET /api/session-summaries` | セッション記録一覧 |
| `GET /api/memories` | 長期メモリ一覧 |
| `GET /api/artifacts` | 成果物一覧 |
| `GET /api/costs` | コスト集計 |

OpenAPI 仕様書: `docs/openapi.yaml`

---

## Claude Code との連携

### CLAUDE.md の配置

このリポジトリの `CLAUDE.md` を参考に、プロジェクトの作業記録ルールを設定できます。

**「完了」ワークフロー:**

ユーザーが「完了」と入力すると、Claude Code が以下を自動実行します。

1. Issue 一覧から該当チケットを特定
2. タイトルをユーザーに確認
3. ステータスを `done` に更新
4. 対応内容（原因・修正内容・確認方法）をコメントとして記録

### Stop フック（セッション記録）

```json
{
  "hooks": {
    "Stop": [{
      "command": "node ~/.maestro/hooks/session-end.js"
    }]
  }
}
```

セッション終了時に作業内容を `POST /api/session-summaries` へ自動送信します。

### MCP メモリサーバー

```bash
claude mcp add maestro-memory --transport http http://localhost:3001/mcp
```

Claude Code からセッション横断の長期記憶を読み書きできます。

---

## Plane 連携

設定画面で Plane の接続情報を入力するだけで、Issue ステータスを自動同期します。

| maestro ステータス | Plane state group |
|---|---|
| Backlog | backlog |
| Todo | unstarted |
| In Progress | started |
| Done | completed |
| Cancelled | cancelled |

---

## スキルのアップデート

Web ダッシュボードの **「スキルアップデート」** ボタンを押すと：

1. everything-claude-code リポジトリを `git pull`
2. `~/.claude/skills/` 配下の全スキルを DB へ同期
3. 各スキルの `SKILL.md` から使い方の例を自動抽出して保存

---

## セキュリティ

| 対策 | 実装 |
|---|---|
| ヘッダー保護 | Helmet.js（CSP 含む） |
| レート制限 | 全体: 15分/100req、認証: 15分/10req |
| 暗号化 | AES-256-GCM（認証情報の保存） |
| SSRF 対策 | Webhook URL の DNS 解決 + プライベート IP ブロック |
| テナント分離 | 全クエリに company_id フィルタ |
| SQL インジェクション対策 | Drizzle ORM パラメータバインド |
| リクエスト追跡 | 全リクエストに X-Request-ID |

---

## 開発への参加

1. `main` ブランチから feature ブランチを作成
2. 変更を実装
3. `pnpm test` でテスト通過を確認
4. `pnpm typecheck` で型チェック通過を確認
5. Conventional Commits 形式でコミット（`feat:` / `fix:` / `docs:` など）
6. プルリクエストを作成

---

## ライセンス

MIT License — 詳細は [LICENSE](./LICENSE) を参照してください。
