import { Router, type Router as RouterType } from 'express';
import { getDb, companies, goals, session_summaries } from '@maestro/db';
import { eq, and, desc, inArray } from 'drizzle-orm';

export const sessionContextRouter: RouterType = Router();

/**
 * GET /api/session-context
 * SessionStart フックが叩く。maestro の現状を一括で返す。
 *
 * レスポンス:
 * - org_rules: 組織ルール（settings.org_rules に保存済みの場合）
 * - latest_session: 直近のセッションサマリー
 * - pending_goals: 期限が近いゴール
 */
sessionContextRouter.get('/', async (req, res, next) => {
  try {
    const db = getDb();

    // 並列で全データを取得
    const [companyRows, sessionRows, goalRows] = await Promise.all([
      // 組織設定（org_rules を含む）
      db.select({ settings: companies.settings })
        .from(companies)
        .where(eq(companies.id, req.companyId!))
        .limit(1),

      // 直近のセッションサマリー
      db.select({
        id: session_summaries.id,
        summary: session_summaries.summary,
        session_ended_at: session_summaries.session_ended_at,
        changed_files: session_summaries.changed_files,
      })
        .from(session_summaries)
        .where(eq(session_summaries.company_id, req.companyId!))
        .orderBy(desc(session_summaries.session_ended_at))
        .limit(1),

      // 進行中のゴール
      db.select({ id: goals.id, name: goals.name, progress: goals.progress, deadline: goals.deadline, status: goals.status })
        .from(goals)
        .where(and(
          eq(goals.company_id, req.companyId!),
          inArray(goals.status, ['in_progress', 'todo']),
        ))
        .orderBy(desc(goals.updated_at))
        .limit(5),
    ]);

    const settings = (companyRows[0]?.settings ?? {}) as Record<string, unknown>;

    res.json({
      data: {
        org_rules: (settings.org_rules as string | null) ?? null,
        latest_session: sessionRows[0] ?? null,
        pending_goals: goalRows,
      },
    });
  } catch (err) {
    next(err);
  }
});
