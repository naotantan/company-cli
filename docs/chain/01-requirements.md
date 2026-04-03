# 要件定義書 — ハンドオフチェーン機能

**バージョン**: 1.0.0 / **作成日**: 2026-04-04

---

## 1. 背景・目的

現状 handoff は A→B の1ステップのみ。
本機能は A→B→C→… の多段連鎖を実現する。
各ステップの出力が次ステップの context になる。

---

## 2. 機能要件

| ID | 要件 | 優先度 |
|----|------|--------|
| FR-01 | handoff 登録時に next_agent_id を任意で指定できる | Must |
| FR-02 | 完了した handoff に next_agent_id があれば自動で次の handoff を生成する | Must |
| FR-03 | 次の handoff の context = 前の handoff の result | Must |
| FR-04 | 次の handoff の prompt は next_prompt で上書き可能（省略時は同じ prompt） | Should |
| FR-05 | chain_id で一連の連鎖を追跡できる | Should |
| FR-06 | 循環チェーン（A→B→A）は禁止しない（無限ループはタイムアウトで制御） | Won't |

---

## 3. 非機能要件

| ID | 要件 |
|----|------|
| NFR-01 | 既存 handoff の挙動を変更しない（next_agent_id なしは従来通り） |
| NFR-02 | テナント分離を維持 |

---

## 4. 用語定義

| 用語 | 定義 |
|------|------|
| chain_id | 一連の handoff 連鎖を識別するUUID |
| next_agent_id | 次に引き継ぐエージェントID |
| next_prompt | 次ステップへのタスク指示（省略時は同一 prompt を継続） |
