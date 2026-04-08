/**
 * 埋め込み管理 API
 * GET  /api/embed/status   — インデックス状況確認
 * POST /api/embed/reindex  — 全レコードのembeddingを再生成（非同期）
 */
import { Router, type Router as RouterType } from 'express';
import { sql } from 'drizzle-orm';
import { getDb, plugins, memories, session_summaries, artifacts } from '@maestro/db';
import { embedPassage, buildPluginEmbedText } from '../services/embedding.js';

export const embedRouter: RouterType = Router();

/** インデックス状況 */
embedRouter.get('/status', async (req, res, next) => {
  try {
    const db = getDb();
    const cid = req.companyId!;
    const [p, m, s, a] = await Promise.all([
      db.execute(sql`SELECT COUNT(*) as total, COUNT(embedding) as indexed FROM plugins WHERE company_id = ${cid}`),
      db.execute(sql`SELECT COUNT(*) as total, COUNT(embedding) as indexed FROM memories WHERE company_id = ${cid}`),
      db.execute(sql`SELECT COUNT(*) as total, COUNT(embedding) as indexed FROM session_summaries WHERE company_id = ${cid}`),
      db.execute(sql`SELECT COUNT(*) as total, COUNT(embedding) as indexed FROM artifacts WHERE company_id = ${cid}`),
    ]);
    res.json({
      data: {
        plugins:          { total: Number(p.rows[0].total), indexed: Number(p.rows[0].indexed) },
        memories:         { total: Number(m.rows[0].total), indexed: Number(m.rows[0].indexed) },
        session_summaries:{ total: Number(s.rows[0].total), indexed: Number(s.rows[0].indexed) },
        artifacts:        { total: Number(a.rows[0].total), indexed: Number(a.rows[0].indexed) },
      },
    });
  } catch (err) {
    next(err);
  }
});

/** 全レコード再インデックス（非同期 — 即レスポンス後にバックグラウンド実行） */
embedRouter.post('/reindex', async (req, res, next) => {
  try {
    const db = getDb();
    const cid = req.companyId!;

    res.json({ data: { message: '再インデックスを開始しました（バックグラウンドで実行中）' } });

    // plugins
    const allPlugins = await db.select().from(plugins).where(sql`company_id = ${cid}`);
    for (const plugin of allPlugins) {
      try {
        const vec = await embedPassage(buildPluginEmbedText(plugin));
        await db.execute(sql`UPDATE plugins SET embedding = ${`[${vec.join(',')}]`}::vector WHERE id = ${plugin.id}`);
      } catch { /* skip */ }
    }
    console.log(`[embed] plugins: ${allPlugins.length}件完了`);

    // memories
    const allMemories = await db.select().from(memories).where(sql`company_id = ${cid}`);
    for (const mem of allMemories) {
      try {
        const vec = await embedPassage(`${mem.title} ${mem.content}`.slice(0, 400));
        await db.execute(sql`UPDATE memories SET embedding = ${`[${vec.join(',')}]`}::vector WHERE id = ${mem.id}`);
      } catch { /* skip */ }
    }
    console.log(`[embed] memories: ${allMemories.length}件完了`);

    // session_summaries
    const allSessions = await db.select().from(session_summaries).where(sql`company_id = ${cid}`);
    for (const sess of allSessions) {
      try {
        const vec = await embedPassage(`${sess.headline ?? ''} ${sess.summary}`.slice(0, 400));
        await db.execute(sql`UPDATE session_summaries SET embedding = ${`[${vec.join(',')}]`}::vector WHERE id = ${sess.id}`);
      } catch { /* skip */ }
    }
    console.log(`[embed] sessions: ${allSessions.length}件完了`);

    // artifacts
    const allArtifacts = await db.select().from(artifacts).where(sql`company_id = ${cid}`);
    for (const art of allArtifacts) {
      try {
        const vec = await embedPassage(`${art.title} ${art.description ?? ''} ${art.content ?? ''}`.slice(0, 400));
        await db.execute(sql`UPDATE artifacts SET embedding = ${`[${vec.join(',')}]`}::vector WHERE id = ${art.id}`);
      } catch { /* skip */ }
    }
    console.log(`[embed] artifacts: ${allArtifacts.length}件完了`);

  } catch (err) {
    next(err);
  }
});
