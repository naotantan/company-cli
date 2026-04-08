import { getDb, goals, agents } from '@maestro/db';
import { eq, and } from 'drizzle-orm';

type Db = ReturnType<typeof getDb>;

/**
 * 指定 Goal が自社所有かを確認する
 * @returns `{ id }` or `null`
 */
export async function findOwnedGoal(
  db: Db,
  companyId: string,
  goalId: string,
) {
  const rows = await db
    .select({ id: goals.id })
    .from(goals)
    .where(and(eq(goals.id, goalId), eq(goals.company_id, companyId)))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * 指定 Agent が自社所有かを確認する（ID のみ返す軽量版）
 * @returns `{ id }` or `null`
 */
export async function findOwnedAgent(
  db: Db,
  companyId: string,
  agentId: string,
) {
  const rows = await db
    .select({ id: agents.id })
    .from(agents)
    .where(and(eq(agents.id, agentId), eq(agents.company_id, companyId)))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * 指定 Agent が自社所有かを確認する（詳細情報付き）
 * handoffs ルートなど、type/config/enabled も必要なケースで使用
 * @returns `{ id, type, config, enabled }` or `null`
 */
export async function findOwnedAgentWithDetails(
  db: Db,
  companyId: string,
  agentId: string,
) {
  const rows = await db
    .select({ id: agents.id, type: agents.type, config: agents.config, enabled: agents.enabled })
    .from(agents)
    .where(and(eq(agents.id, agentId), eq(agents.company_id, companyId)))
    .limit(1);
  return rows[0] ?? null;
}

