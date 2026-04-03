# テスト仕様書: バックアップ設定 API + UI

**作成日**: 2026-04-03
**対象機能**: `GET/PATCH /api/settings` のバックアップ設定フィールド
**テスト種別**: ブラックボックステスト（API）+ UIコンポーネントテスト

---

## 1. テスト対象

### バックアップ設定フィールド一覧

| フィールド | 型 | 必須条件 |
|---|---|---|
| `backup.enabled` | boolean | 任意（デフォルト: false） |
| `backup.scheduleType` | `'daily' \| 'weekly' \| 'monthly'` | enabled=true のとき必須 |
| `backup.scheduleTime` | string `HH:mm` | enabled=true のとき必須 |
| `backup.timezone` | string（IANA） | 任意（デフォルト: `Asia/Tokyo`） |
| `backup.retentionDays` | number | 有効値: 7, 14, 30, 60, 90, 180, 365 |
| `backup.destinationType` | `'local' \| 's3' \| 'gcs'` | enabled=true のとき必須 |
| `backup.s3Bucket` | string | destinationType='s3' のとき必須 |
| `backup.s3Region` | string | destinationType='s3' のとき必須 |
| `backup.localPath` | string | destinationType='local' のとき必須 |
| `backup.includeActivityLog` | boolean | 任意（デフォルト: false） |
| `backup.compression` | `'none' \| 'gzip'` | 任意（デフォルト: `'gzip'`） |
| `backup.encryption` | boolean | 任意（デフォルト: true） |
| `backup.notifyEmail` | string（email形式） | 任意 |
| `backup.notifyOnFailure` | boolean | 任意（デフォルト: true） |
| `backup.notifyOnSuccess` | boolean | 任意（デフォルト: false） |

---

## 2. テストケース一覧

### T01: GET /api/settings — バックアップ設定取得

| ID | テスト名 | 入力 | 期待結果 |
|---|---|---|---|
| T01-01 | バックアップ設定が未設定の場合にデフォルト値を返す | 設定なし | `backup` フィールドが `null` または空オブジェクト、status 200 |
| T01-02 | 保存済みバックアップ設定を正しく返す | `backup.enabled=true, scheduleType='daily'` を保存済み | 同値が返る、status 200 |
| T01-03 | 認証なしで 401 を返す | Authorization ヘッダーなし | status 401 |

### T02: PATCH /api/settings — バックアップ設定更新（正常系）

| ID | テスト名 | 入力 | 期待結果 |
|---|---|---|---|
| T02-01 | enabled=false で最小設定を保存できる | `{ backup: { enabled: false } }` | status 200, `res.body.data.backup.enabled === false`, `mockDb.update` 呼び出し確認 |
| T02-02 | local バックアップのフル設定を保存できる | enabled=true, scheduleType='daily', scheduleTime='02:00', retentionDays=30, destinationType='local', localPath='/backup', compression='gzip', encryption=true | status 200, `backup.scheduleType='daily'`, `backup.localPath='/backup'` |
| T02-03 | S3 バックアップのフル設定を保存できる | enabled=true, scheduleType='daily', scheduleTime='02:00', destinationType='s3', s3Bucket='my-bucket', s3Region='ap-northeast-1' | status 200, `backup.destinationType='s3'`, `backup.s3Bucket='my-bucket'` |
| T02-04 | 既存設定にバックアップ設定をマージできる | 既存: `defaultAgentType='claude_local'`, 追加: `{ backup: { enabled: false } }` | status 200, `defaultAgentType='claude_local'` が維持され `backup.enabled=false` が追加 |
| T02-05 | retentionDays の全許容値が受け入れられる（代表値: 365） | retentionDays=365 と有効な設定一式 | status 200, `backup.retentionDays=365` |
| T02-06 | 通知設定を含む設定が保存できる | notifyEmail='admin@example.com', notifyOnFailure=true, notifyOnSuccess=false | status 200, `backup.notifyEmail='admin@example.com'` |

### T03: PATCH /api/settings — バックアップ設定バリデーション（異常系）

| ID | テスト名 | 入力 | 期待結果 |
|---|---|---|---|
| T03-01 | enabled=true で scheduleType なしは 400 | `{ backup: { enabled: true, scheduleTime: '02:00', destinationType: 'local', localPath: '/backup' } }` | status 400, `error='validation_failed'`, `message` に `'scheduleType'` を含む, `mockDb.update` 未呼び出し |
| T03-02 | enabled=true で scheduleTime なしは 400 | `{ backup: { enabled: true, scheduleType: 'daily', destinationType: 'local', localPath: '/backup' } }` | status 400, `error='validation_failed'`, `message` に `'scheduleTime'` を含む |
| T03-03 | enabled=true で destinationType なしは 400 | `{ backup: { enabled: true, scheduleType: 'daily', scheduleTime: '02:00' } }` | status 400, `error='validation_failed'`, `message` に `'destinationType'` を含む |
| T03-04 | 無効な scheduleType は 400 | `scheduleType: 'hourly'` | status 400, `error='validation_failed'` |
| T03-05 | 無効な retentionDays は 400（境界値: 10） | `retentionDays: 10`（許容値: 7,14,30,60,90,180,365 以外） | status 400, `error='validation_failed'`, `message` に `'retentionDays'` を含む |
| T03-06 | 無効な retentionDays は 400（境界値: 0） | `retentionDays: 0` | status 400 |
| T03-07 | destinationType='s3' で s3Bucket なしは 400 | `destinationType: 's3'`, s3Bucket 未指定 | status 400, `error='validation_failed'`, `message` に `'s3Bucket'` を含む |
| T03-08 | destinationType='s3' で s3Region なしは 400 | `destinationType: 's3'`, s3Bucket あり, s3Region 未指定 | status 400, `message` に `'s3Region'` を含む |
| T03-09 | destinationType='local' で localPath なしは 400 | `destinationType: 'local'`, localPath 未指定 | status 400, `message` に `'localPath'` を含む |
| T03-10 | localPath にパストラバーサル文字列は 400 | `localPath: '../../../etc/passwd'` | status 400, `message` に `'localPath'` を含む |
| T03-11 | 無効なメールアドレス形式は 400 | `notifyEmail: 'not-an-email'` | status 400, `message` に `'notifyEmail'` を含む |
| T03-12 | scheduleTime が範囲外（25:00）は 400 | `scheduleTime: '25:00'` | status 400, `message` に `'scheduleTime'` を含む |
| T03-13 | scheduleTime が文字列（morning）は 400 | `scheduleTime: 'morning'` | status 400 |
| T03-14 | scheduleTime の境界値（00:00）は正常 | `scheduleTime: '00:00'` と有効な設定一式 | status 200 |
| T03-15 | scheduleTime の境界値（23:59）は正常 | `scheduleTime: '23:59'` と有効な設定一式 | status 200 |

### T04: GCS バックアップ設定

| ID | テスト名 | 入力 | 期待結果 |
|---|---|---|---|
| T04-01 | destinationType='gcs' の設定を保存できる | enabled=true, scheduleType='weekly', scheduleTime='03:00', destinationType='gcs', gcsBucket='my-gcs-bucket' | status 200, `backup.destinationType='gcs'` |
| T04-02 | destinationType='gcs' で gcsBucket なしは 400 | `destinationType: 'gcs'`, gcsBucket 未指定 | status 400, `message` に `'gcsBucket'` を含む |

### T05: 整合性チェック（マージ後検証）

| ID | テスト名 | 入力 | 期待結果 |
|---|---|---|---|
| T05-01 | 既存 enabled=true で scheduleType を空文字に更新しようとすると 400 | 既存: full valid config, 更新: `{ backup: { scheduleType: '' } }` | status 400 |
| T05-02 | バックアップ設定の更新が他の設定（defaultAgentType 等）に影響しない | 既存: `defaultAgentType='claude_local'`, 更新: `backup.enabled=false` | status 200, `defaultAgentType='claude_local'` が残る |

---

## 3. テスト実装方針

- テストフレームワーク: **vitest + supertest**
- モック方法: `setup.ts` の `@company/db` モック + `vi.mocked(getDb)` でテストごとに上書き
- `beforeEach` で共通 `buildMockDb` を使いテスト間を独立させる
- 認証テスト（T01-03）は `vi.mock('../middleware/auth.js')` を**使わない**別 describe で実施
- バリデーションエラー時は `mockDb.update` が呼ばれないことも検証する

---

## 4. カバレッジ目標

- バリデーション分岐: 全条件網羅（100%）
- 正常系: 主要パターン網羅（local/s3/enabled/disabled）
- 認証: 401確認を明示

---

## 5. 合否判定基準

- 全テストケース PASS
- バリデーションエラー時に `mockDb.update` が呼ばれていないこと
- 不正入力でも 500 が返らないこと（全て 400 ハンドリング）
