# Embedding改善計画書

**作成日**: 2026-04-09  
**対象**: `packages/api/src/services/embedding.ts` / `routes/embed.ts` / `routes/plugins.ts`  
**目標**: ベクトルDB（pgvector）の検索精度・速度・運用品質を全面的に改善する

---

## 実装タスク一覧

### A. 検索品質

#### A1. ハイブリッド検索（ベクトル + 全文検索）
**対象ファイル**: `routes/embed.ts`, `routes/plugins.ts`, DBマイグレーション  
**内容**:
- `plugins` / `memories` / `session_summaries` / `artifacts` テーブルに `search_vector tsvector` カラムを追加
- 挿入・更新時にトリガーで `search_vector` を自動更新
- `/embed/search` と `/plugins/recommend` で BM25（`ts_rank`）× コサイン類似度の加重合算スコアを返す
- クエリパラメータ `hybrid=true` で有効化（デフォルト: true）
- 重み: `vector_weight=0.7`, `text_weight=0.3`（クエリパラメータで上書き可）

**完了条件**: ハイブリッドスコアで返ってくる件数が純粋ベクトルより多い（recall向上を確認）

---

#### A2. 長文ドキュメントのチャンキング
**対象ファイル**: `services/embedding.ts`, `routes/embed.ts`, DBマイグレーション  
**内容**:
- `plugin_chunks` テーブルを追加（`plugin_id`, `chunk_index`, `chunk_text`, `embedding vector(384)`）
- `buildChunks(text, chunkSize=400, overlap=50)` ユーティリティを実装
- プラグイン同期時に `usage_content` を自動チャンキング → `plugin_chunks` へ保存・embed
- `/plugins/recommend` 検索時は `plugin_chunks` を検索し、最高スコアのチャンクを親プラグインのスコアとして集約（MAX aggregation）

**完了条件**: 長文SKILL.mdのプラグインが後半のキーワードでも検索でヒットすること

---

#### A3. 類似度 × 使用実績の複合スコアリング
**対象ファイル**: `routes/plugins.ts`  
**内容**:
- `recommend` エンドポイントのスコア計算を変更
- `score = similarity * usage_weight_ratio + log(usage_count+1)/log(max_usage+1) * (1 - usage_weight_ratio)`
- クエリパラメータ `usage_weight=0.3`（0〜1、デフォルト0.3）で調整可能
- 使用回数が0件のスキルも similarity だけで返せるようにする

**完了条件**: よく使うスキルが同じsimilarityなら上位に来ること

---

#### A4. MMR（最大周辺関連性）による結果多様化
**対象ファイル**: `routes/plugins.ts`, `routes/embed.ts`  
**内容**:
- `computeMMR(candidates, queryVec, lambda=0.5, k=limit)` 関数を実装
  - `lambda=1.0`: 純粋な類似度順（多様性なし）
  - `lambda=0.0`: 最大多様性
  - `lambda=0.5`: バランス（デフォルト）
- 内部で上位20件を取得してMMRで再ランク → 上位N件を返す
- クエリパラメータ `mmr=true&lambda=0.5` で有効化

**完了条件**: 同一カテゴリのスキルが上位を独占しなくなること

---

### B. パフォーマンス

#### B1. サーバー起動時のモデルウォームアップ
**対象ファイル**: `services/embedding.ts`, `server.ts`  
**内容**:
- `warmupEmbedding()` 関数をエクスポート（ダミーテキストで1回embed実行）
- `server.ts` の `app.listen()` 前に `await warmupEmbedding()` を呼ぶ
- ロード時間をコンソールに出力（`[embedding] ウォームアップ完了: Xms`）
- 環境変数 `EMBEDDING_WARMUP=false` で無効化可能

**完了条件**: サーバー起動後の初回 `/plugins/recommend` が即座に返ること（< 200ms）

---

#### B2. バッチembedding処理
**対象ファイル**: `services/embedding.ts`, `routes/embed.ts`  
**内容**:
- `embedPassageBatch(texts: string[]): Promise<number[][]>` を実装
  - `pipe(texts, { batch_size: 16, pooling: 'mean', normalize: true })` でバッチ推論
- `reindex` のrunConcurrentをバッチ対応に変更（16件ずつまとめてembedding生成）
- 単件 `embedPassage` はそのまま残す（リアルタイム用）

**完了条件**: 300件のreindexが現状（~9秒）の1/3以下（~3秒）で完了すること

---

#### B3. pgvector HNSWインデックスの追加
**対象ファイル**: DBマイグレーション（`packages/db/src/migrations/`）  
**内容**:
- 以下4テーブルの `embedding` カラムにHNSWインデックスを追加:
  - `plugins`, `memories`, `session_summaries`, `artifacts`
- パラメータ: `m=16, ef_construction=64`（精度/速度バランス）
- A2で追加する `plugin_chunks` にも同様のインデックスを追加
- マイグレーションファイルを `CONCURRENTLY` なしで作成（ロック許容）

**完了条件**: 1万件規模でのクエリが < 50ms で返ること（EXPLAINで確認）

---

#### B4. 頻出クエリのベクトルLRUキャッシュ
**対象ファイル**: `services/embedding.ts`  
**内容**:
- `Map<string, number[]>` ベースのLRUキャッシュ（上限100件）を実装
- `embedQuery` 呼び出し時にキャッシュをチェック、ヒットすれば即返却
- キャッシュキー: クエリテキスト（正規化: trim + toLowerCase）
- 統計情報（hit/miss数）を `/embed/status` に追加

**完了条件**: 同一クエリの2回目が < 1ms で返ること

---

### C. 運用品質

#### C1. インクリメンタルreindex
**対象ファイル**: `routes/embed.ts`  
**内容**:
- `POST /api/embed/reindex?mode=incremental` を追加
  - `mode=incremental`: `embedding IS NULL` のレコードのみ処理
  - `mode=full`: 全件処理（現状と同じ、デフォルト）
- `/embed/status` レスポンスに未インデックス件数（`unindexed`）を追加
- 差分件数をログに出力

**完了条件**: 差分のみ実行時に全件より大幅に速く完了すること

---

#### C2. embedding失敗ログと統計
**対象ファイル**: `routes/embed.ts`  
**内容**:
- `catch { /* skip */ }` を `catch (err) { failed++; console.warn(...) }` に変更
- reindex完了時に成功/失敗件数をログとレスポンスに含める
- `/embed/status` に最終reindex結果（日時、成功/失敗件数）を保存・返却

**完了条件**: 失敗したレコードのIDとエラー理由がログに残ること

---

#### C3. 書き込み時の自動embedding更新
**対象ファイル**: `routes/plugins.ts`, `routes/memories.ts`, `routes/artifacts.ts`  
**内容**:
- 各テーブルのPUT/PATCH処理で、embedding関連フィールドが変更された場合にバックグラウンドでembeddingを再生成
- `scheduleEmbedding(table, id, text)` ヘルパーを実装（非同期、エラーは無視）
- 対象フィールド:
  - plugins: `description`, `usage_content`, `name`, `category`
  - memories: `title`, `content`, `type`
  - artifacts: `title`, `description`, `content`

**完了条件**: プラグイン説明更新後、検索結果が新しい内容で返ること

---

### D. 機能拡張

#### D1. クエリ拡張（Ollamaによる検索語の多様化）
**対象ファイル**: `routes/embed.ts`, `routes/plugins.ts`, `services/ollama.ts`  
**内容**:
- `expandQuery(q: string): Promise<string>` を `ollama.ts` に追加
  - Ollamaで「{q}の同義語・関連語を5つ返してください」を生成
  - 元クエリ + 拡張語を結合したテキストをembedding
- クエリパラメータ `expand=true` で有効化（デフォルト: false）
- Ollamaが使えない場合はフォールバックして元クエリのみ使用
- タイムアウト: 5秒（超過したらフォールバック）

**完了条件**: 「テストを書きたい」で `python-testing`, `tdd-guide` などがヒットすること

---

#### D2. 使用履歴によるパーソナライズ
**対象ファイル**: `routes/plugins.ts`  
**内容**:
- `/plugins/recommend` に `personalize=true` オプションを追加
- 認証済みユーザーの直近30日間の使用スキルカテゴリを集計
- 上位カテゴリに属するスキルのスコアを `+0.1` ブースト
- カテゴリ集計は `/api/plugins/usage-stats` の既存ロジックを流用

**完了条件**: よく使うカテゴリのスキルが同一類似度で上位に来ること

---

#### D3. モデルアップグレード評価と切り替え
**対象ファイル**: `services/embedding.ts`, `routes/embed.ts`  
**内容**:
- 環境変数 `EMBEDDING_MODEL` でモデルを切り替え可能にする
  - `multilingual-e5-small`（現状、デフォルト）: 384次元
  - `multilingual-e5-large`: 1024次元
  - `Xenova/nomic-embed-text`: 768次元
- モデルに応じてベクトル次元数を動的に返す `getEmbeddingDims()` を追加
- DBスキーマの `vector(384)` を `vector(1024)` に変更するマイグレーションを準備（モデル変更時のみ適用）
- `/embed/status` にモデル名・次元数を表示

**完了条件**: 環境変数を変えるだけでモデルが切り替わること

---

## 実装順序

```
Phase 1（基盤）: B3 → B1 → C2 → C1
Phase 2（性能）: B2 → B4 → C3
Phase 3（品質）: A3 → A4 → A1
Phase 4（拡張）: A2 → D1 → D2 → D3
```

## 影響ファイル一覧

```
packages/
├── api/src/
│   ├── services/
│   │   ├── embedding.ts        ← B1, B2, B4, D3
│   │   └── ollama.ts           ← D1
│   └── routes/
│       ├── embed.ts            ← A1, A2, B2, C1, C2, D3
│       ├── plugins.ts          ← A1, A3, A4, C3, D1, D2
│       ├── memories.ts         ← C3
│       └── artifacts.ts        ← C3
└── db/src/
    ├── schema/                 ← A2（plugin_chunks）
    └── migrations/             ← A1, A2, B3
```

## 完了定義

- 全14タスクの実装完了
- TypeScript型エラーなし（`pnpm typecheck`）
- 既存テスト通過（`pnpm test`）
- GitHubへのpush完了
