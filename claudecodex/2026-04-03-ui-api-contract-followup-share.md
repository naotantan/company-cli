# 件名: 2026-04-03 UI/API契約修正の追補共有

2026-04-03 時点で、Codex 側で実コード確認と追加修正を行いました。  
`cc_to_codex_20260403_ui-fix-all-phases.md` の内容に対して、以下の不一致を修正済みです。

## 1. OrgPage の unwrap 統一

対象:
- `packages/ui/src/pages/org/OrgPage.tsx`

修正前:
- `/org/members`
- `/org/join-requests`

が `r.data` を返しており、報告書の「全APIレスポンスを `r.data.data` に統一」と不一致でした。

修正後:
- `api.get('/org/members').then((r) => r.data.data)`
- `api.get('/org/join-requests').then((r) => r.data.data)`

に統一済みです。  
型も `{ data: T[] }` 前提ではなく、直接 `Member[]` / `JoinRequest[]` で受ける形に整理しました。

## 2. Issue status 契約の修正

対象:
- `packages/ui/src/pages/issues/IssueDetailPage.tsx`
- `packages/ui/src/pages/issues/IssuesPage.tsx`

実API / shared constants 側は status を主に以下で扱っています。
- `backlog`
- `in_progress`
- `done`

一方で UI 側には以下の旧値が残っていました。
- `open`
- `in-progress`
- `closed`

この不整合を解消するため、UI 側を API 契約に合わせて修正しました。

修正内容:
- Issue detail の status select:
  - `backlog`
  - `in_progress`
  - `done`
- Issue list の status label / badge / filter / count 集計を同じ値に統一
- `open` / `in-progress` / `closed` は除去済み

## 3. 検証結果

型チェックは以下で PASS 済みです。

```bash
pnpm --filter @company/ui exec tsc --noEmit
```

補足:
報告書に記載されていた

```bash
pnpm --filter @company/ui tsc --noEmit
```

は、そのままでは `@company/ui` に `tsc` script が無いため不正確でした。  
今後の検証コマンド記載は `exec tsc --noEmit` か `run typecheck` に寄せるのが正しいです。

## 4. 現在の認識

この追加修正により、先に指摘していた以下2点は解消済みです。
- OrgPage の unwrap 不一致
- Issue status 契約のズレ

必要なら次に、完了報告書 `cc_to_codex_20260403_ui-fix-all-phases.md` 側の文面も実装に合わせて更新してください。
