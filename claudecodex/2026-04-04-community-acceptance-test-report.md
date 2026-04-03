# company-cli コミュニティ版 最終受け入れ試験報告書

**試験日**: 2026-04-04  
**試験環境**: naotolab（Ubuntu 24.04 / Node.js 20.20.2 / PostgreSQL 16）  
**試験実施**: 戦略顧問室 × 開発部  
**判定**: ✅ **PASS（10/10）**

---

## 試験結果サマリー

| No. | テスト項目 | 結果 | レスポンス概要 |
|-----|-----------|------|--------------|
| T-01 | ヘルスチェック | ✅ PASS | `status: "ok"`、DB接続確認済み |
| T-02 | 組織登録・APIキー取得 | ✅ PASS | `comp_live_` プレフィックスのAPIキー発行 |
| T-03 | ログイン | ✅ PASS | APIキー再取得・会社情報返却 |
| T-04 | エージェント登録 | ✅ PASS | agentオブジェクト（id付き）・APIキー暗号化保存 |
| T-05 | Issue作成・自動アサイン | ✅ PASS | 登録済みエージェントへの自動アサイン確認 |
| T-06 | テナント分離 | ✅ PASS | 別会社APIキーでアクセス時に空配列返却 |
| T-07 | 予算ポリシー作成 | ✅ PASS | `alert_threshold: 80` → `0.80` に正規化 |
| T-08 | コスト記録 | ✅ PASS | コストレコード生成・`cost_usd`精度正常 |
| T-09 | アクティビティログ | ✅ PASS | 全操作（agent/issue/cost/budget）が記録済み |
| T-10 | 認証エラー | ✅ PASS | 無効キーに対し 401 返却 |

---

## インストール手順で判明した問題点（修正提案）

実際に naotolab へゼロからインストールした過程で、以下の**ユーザー体験上の問題**が確認された。  
**本レポートでは記録のみ行い、コードの修正は行っていない。**

---

### I-01: Node.js バージョン不一致（重要度: 高）

**状況**  
naotolab の OS デフォルト Node.js は v18.19.1 だったが、company-cli は v20 以上を要求する。  
システムの `node` コマンドが v18 のまま残るため、`pnpm install` は通るが `pnpm typecheck` や `pnpm build` が失敗する。

**ユーザー体験**  
README の手順通りに進めても、バージョン不足で何も動かない。エラーメッセージが TypeScript コンパイルエラーとして出るため、原因が分かりにくい。

**改善提案**  
- `README.md` のセットアップ手順に「nvmを使ったNode.js 20インストール」ステップを明示追加  
- または `.nvmrc` ファイルをリポジトリに追加（`echo "20" > .nvmrc`）  
- `package.json` の `engines` 警告を `preinstall` スクリプトでチェック追加も有効

---

### I-02: .env の配置場所が直感と異なる（重要度: 高）

**状況**  
`.env.example` はリポジトリルートにあるが、実際に必要な `.env` の配置場所が2箇所ある：
- **マイグレーション（drizzle）**: リポジトリルート（`/company-cli/.env`）を読む
- **APIサーバー**: `packages/api/.env` を読む

README には `cp .env.example packages/api/.env` とのみ記載されているため、マイグレーション実行時に「password authentication failed」エラーが発生した。

**ユーザー体験**  
マイグレーションが失敗し、エラーがDB接続エラーとして出るため原因が分かりにくい。

**改善提案**  
README のセットアップ手順を以下に変更：
```bash
cp .env.example .env                      # drizzle（マイグレーション）用
cp .env.example packages/api/.env        # APIサーバー用
```
または `prepare` スクリプトで両方に自動コピーする仕組みを追加。

---

### I-03: PostgreSQL ユーザー作成に特権操作が必要（重要度: 中）

**状況**  
PostgreSQL がシステムにインストール済みの環境では、`company` ユーザーと `company_dev` データベースの作成に `sudo -u postgres psql` が必要。  
一般ユーザーからは TCP 接続のパスワードが不明なため直接実行できず、README の手順だけでは完了できない。

**ユーザー体験**  
「`docker compose up -d` 1コマンドで起動」という導線と、「PostgreSQL 既存環境では手動セットアップが必要」という現実のギャップ。  
Docker を使わない場合のセットアップ手順が README に存在しない。

**改善提案**  
- Docker（推奨）と直インストール（代替）の2パターンを README に分けて記載  
- 直インストール向けに `scripts/setup-db.sh`（`createuser`/`createdb` を使う）を提供  
- または `.env.example` の `DATABASE_URL` に `127.0.0.1` を使うよう変更（`localhost` はIPv6解決でトラブルが起きる場合がある）

---

### I-04: pnpm がシステムにない場合のインストール方法が不明確（重要度: 低）

**状況**  
naotolab には pnpm が未インストールだった。README には `npm install -g pnpm` と記載されているが、`/usr/local/bin` への書き込みに root 権限が必要な環境では失敗する。

**改善提案**  
README に以下を併記：
```bash
# sudo 不要のインストール方法
curl -fsSL https://get.pnpm.io/install.sh | sh -
source ~/.bashrc
```

---

### I-05: ビルド順序が README に記載されていない（重要度: 低）

**状況**  
`pnpm --filter @company/api build` を単独で実行すると、`@company/db` や `@company/shared` のビルドが先に必要なため TSC エラーが発生する。  
`pnpm build`（全体ビルド）はこの問題が発生しないが、開発者が個別パッケージをビルドしようとすると詰まる。

**改善提案**  
`CONTRIBUTING.md` に「パッケージのビルド順序」セクションを追加、または `pnpm build` コマンドの内部でトポロジカル順にビルドされることを説明する。

---

## 総合所見

**技術品質**: リリース可能な水準（評価ループ 25/25 × 2回）  
**インストール体験**: I-01・I-02 の2点を修正すれば、README 通りの5分インストールが実現できる  
**推奨優先度**: I-01 ≥ I-02 > I-03 > I-04 = I-05

---

*作成: 戦略顧問室（Kenji Watanabe 主査 / Aisha Mensah 副査）*  
*試験環境提供: naotolab（小型PC）*
