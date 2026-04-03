# 基本設計書 — ハンドオフチェーン機能

**バージョン**: 1.0.0 / **作成日**: 2026-04-04

---

## 1. DBスキーマ変更（agent_handoffs へのカラム追加）

| カラム | 型 | 説明 |
|--------|-----|------|
| chain_id | uuid nullable | 連鎖グループID（先頭 handoff の id を使用） |
| next_agent_id | uuid nullable FK→agents.id | 次の引き継ぎ先 |
| next_prompt | text nullable | 次ステップのプロンプト（省略時は同じ prompt） |

---

## 2. チェーン実行フロー

```
POST /api/handoffs { from:A, to:B, prompt:"...", next_agent_id:C, next_prompt:"..." }
  → chain_id = 自身の id
  → status=pending で登録

Engine.processHandoffs()
  → B が実行 → completed (result="Bの回答")
  → next_agent_id=C が存在
  → 新 handoff INSERT:
      { from:B, to:C, prompt:next_prompt, context:"Bの回答", chain_id=親のchain_id }
  → 新 handoff は pending → 次のサイクルで実行
```

---

## 3. API変更

| エンドポイント | 変更内容 |
|---------------|---------|
| POST /api/handoffs | next_agent_id, next_prompt を受け付ける（任意） |
| GET /api/handoffs | chain_id クエリで連鎖を絞り込める |

---

## 4. 実装対象ファイル

| ファイル | 変更種別 |
|----------|---------|
| packages/db/src/schema/group-h.ts | agent_handoffs に3カラム追加 |
| packages/api/src/routes/handoffs.ts | POST にchain対応・GET にchain_idフィルタ追加 |
| packages/api/src/engine/heartbeat-engine.ts | processHandoffs に次 handoff 生成ロジック追加 |
| packages/api/src/__tests__/handoffs.test.ts | チェーン関連テスト追加 |
