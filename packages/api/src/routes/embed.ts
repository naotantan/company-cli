/**
 * 埋め込み管理 API
 * GET  /api/embed/status   — インデックス状況確認（未インデックス件数・最終reindex結果含む）
 * POST /api/embed/reindex  — embeddingを再生成（バックグラウンド・並列処理）
 *                            ?mode=full（全件）| incremental（embedding IS NULL のみ）
 * GET  /api/embed/search   — セマンティック検索（memories / sessions / artifacts）
 *                            ?hybrid=true でベクトル+全文ハイブリッド検索
 */
import { Router, type Router as RouterType } from 'express';
import { sql } from 'drizzle-orm';
import { getDb, plugins, memories, session_summaries, artifacts } from '@maestro/db';
import {
  embedPassage,
  embedPassageBatch,
  embedQuery,
  buildPluginEmbedText,
  buildMemoryEmbedText,
  buildSessionEmbedText,
  buildArtifactEmbedText,
  getCacheStats,
  getEmbeddingDims,
} from '../services/embedding.js';

export const embedRouter: RouterType = Router();

/** 再インデックス中フラグ（company単位） */
const reindexRunning = new Set<string>();

/** C2: 最終reindex結果（company単位）*/
interface ReindexStats {
  completedAt: string;
  mode: string;
  success: number;
  failed: number;
  failedIds: string[];
}
const lastReindexStats = new Map<string, ReindexStats>();

/** B2: バッチサイズ */
const BATCH_SIZE = 16;

/** B2: バッチでreindexを実行するユーティリティ */
async function reindexBatch<T extends { id: string }>(
  items: T[],
  buildText: (item: T) => string,
  tableName: string,
  db: ReturnType<typeof getDb>,
): Promise<{ success: number; failed: number; failedIds: string[] }> {
  let success = 0;
  let failed = 0;
  const failedIds: string[] = [];

  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);
    const texts = batch.map(item => buildText(item));

    let vecs: number[][];
    try {
      vecs = await embedPassageBatch(texts);
    } catch (batchErr) {
      // バッチ失敗時は個別処理にフォールバック
      vecs = [];
      for (const item of batch) {
        try {
          vecs.push(await embedPassage(buildText(item)));
        } catch {
          vecs.push(new Array(getEmbeddingDims()).fill(0));
        }
      }
    }

    for (let j = 0; j < batch.length; j++) {
      const item = batch[j];
      const vec = vecs[j];
      try {
        await db.execute(
          sql`UPDATE ${sql.raw(tableName)} SET embedding = ${`[${vec.join(',')}]`}::vector WHERE id = ${item.id}`
        );
        success++;
      } catch (err) {
        failed++;
        failedIds.push(item.id);
        console.warn(`[embed] ${tableName} id=${item.id} 更新失敗:`, err instanceof Error ? err.message : err);
      }
    }
  }

  return { success, failed, failedIds };
}

/** インデックス状況 */
embedRouter.get('/status', async (req, res, next) => {
  try {
    const db = getDb();
    const cid = req.companyId!;
    const [p, m, s, a] = await Promise.all([
      db.execute(sql`
        SELECT COUNT(*) as total, COUNT(embedding) as indexed,
               COUNT(*) - COUNT(embedding) as unindexed
        FROM plugins WHERE company_id = ${cid}`),
      db.execute(sql`
        SELECT COUNT(*) as total, COUNT(embedding) as indexed,
               COUNT(*) - COUNT(embedding) as unindexed
        FROM memories WHERE company_id = ${cid}`),
      db.execute(sql`
        SELECT COUNT(*) as total, COUNT(embedding) as indexed,
               COUNT(*) - COUNT(embedding) as unindexed
        FROM session_summaries WHERE company_id = ${cid}`),
      db.execute(sql`
        SELECT COUNT(*) as total, COUNT(embedding) as indexed,
               COUNT(*) - COUNT(embedding) as unindexed
        FROM artifacts WHERE company_id = ${cid}`),
    ]);

    const stats = lastReindexStats.get(cid);
    const cacheStats = getCacheStats();
    const modelName = process.env.EMBEDDING_MODEL ?? 'Xenova/multilingual-e5-small';

    res.json({
      data: {
        running: reindexRunning.has(cid),
        model: modelName,
        dims: getEmbeddingDims(),
        cache: cacheStats,
        plugins:           { total: Number(p.rows[0].total), indexed: Number(p.rows[0].indexed), unindexed: Number(p.rows[0].unindexed) },
        memories:          { total: Number(m.rows[0].total), indexed: Number(m.rows[0].indexed), unindexed: Number(m.rows[0].unindexed) },
        session_summaries: { total: Number(s.rows[0].total), indexed: Number(s.rows[0].indexed), unindexed: Number(s.rows[0].unindexed) },
        artifacts:         { total: Number(a.rows[0].total), indexed: Number(a.rows[0].indexed), unindexed: Number(a.rows[0].unindexed) },
        lastReindex: stats ?? null,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/embed/reindex?mode=full|incremental
 * 全レコード再インデックス（非同期・バッチ処理・多重起動防止）
 * C1: mode=incremental は embedding IS NULL のレコードのみ処理
 * C2: 失敗レコードIDとエラーを記録し統計をレスポンス/statusに反映
 */
embedRouter.post('/reindex', async (req, res, next) => {
  try {
    const db = getDb();
    const cid = req.companyId!;
    const mode = req.query.mode === 'incremental' ? 'incremental' : 'full';

    if (reindexRunning.has(cid)) {
      res.status(409).json({ error: '再インデックスは既に実行中です' });
      return;
    }

    reindexRunning.add(cid);
    res.json({ data: { message: `再インデックスを開始しました（mode=${mode}）` } });

    (async () => {
      const where = mode === 'incremental'
        ? sql`company_id = ${cid} AND embedding IS NULL`
        : sql`company_id = ${cid}`;

      let totalSuccess = 0;
      let totalFailed = 0;
      const allFailedIds: string[] = [];

      try {
        // plugins
        const allPlugins = await db.select().from(plugins).where(where);
        const pr = await reindexBatch(allPlugins, buildPluginEmbedText, 'plugins', db);
        totalSuccess += pr.success;
        totalFailed += pr.failed;
        allFailedIds.push(...pr.failedIds);
        console.log(`[embed] plugins: 成功=${pr.success} 失敗=${pr.failed}`);

        // memories
        const allMemories = await db.select().from(memories).where(where);
        const mr = await reindexBatch(allMemories, buildMemoryEmbedText, 'memories', db);
        totalSuccess += mr.success;
        totalFailed += mr.failed;
        allFailedIds.push(...mr.failedIds);
        console.log(`[embed] memories: 成功=${mr.success} 失敗=${mr.failed}`);

        // session_summaries
        const allSessions = await db.select().from(session_summaries).where(where);
        const sr = await reindexBatch(allSessions, buildSessionEmbedText, 'session_summaries', db);
        totalSuccess += sr.success;
        totalFailed += sr.failed;
        allFailedIds.push(...sr.failedIds);
        console.log(`[embed] sessions: 成功=${sr.success} 失敗=${sr.failed}`);

        // artifacts
        const allArtifacts = await db.select().from(artifacts).where(where);
        const ar = await reindexBatch(allArtifacts, buildArtifactEmbedText, 'artifacts', db);
        totalSuccess += ar.success;
        totalFailed += ar.failed;
        allFailedIds.push(...ar.failedIds);
        console.log(`[embed] artifacts: 成功=${ar.success} 失敗=${ar.failed}`);

        console.log(`[embed] 再インデックス完了 company=${cid} mode=${mode} 成功=${totalSuccess} 失敗=${totalFailed}`);
      } finally {
        // C2: 統計を保存
        lastReindexStats.set(cid, {
          completedAt: new Date().toISOString(),
          mode,
          success: totalSuccess,
          failed: totalFailed,
          failedIds: allFailedIds.slice(0, 50), // 最大50件まで保持
        });
        reindexRunning.delete(cid);
      }
    })().catch((err) => {
      console.error('[embed] 再インデックスエラー:', err);
      reindexRunning.delete(cid);
    });

  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/embed/search?q=text&type=memories|sessions|artifacts&limit=10&min_similarity=0.5
 *   &hybrid=true&vector_weight=0.7&text_weight=0.3
 * memories / session_summaries / artifacts のセマンティック検索
 * A1: hybrid=true（デフォルト）でベクトル+全文のハイブリッドスコアを使用
 */
embedRouter.get('/search', async (req, res, next) => {
  try {
    const q = String(req.query.q ?? '').trim();
    if (!q) {
      res.status(400).json({ error: 'クエリが必要です' });
      return;
    }

    const type = String(req.query.type ?? 'memories');
    const limit = Math.min(Number(req.query.limit ?? 10), 50);
    const minSimilarity = Math.max(0, Math.min(1, Number(req.query.min_similarity ?? 0.5)));
    const hybrid = req.query.hybrid !== 'false'; // デフォルトtrue
    const vectorWeight = Math.max(0, Math.min(1, Number(req.query.vector_weight ?? 0.7)));
    const textWeight = 1 - vectorWeight;
    const cid = req.companyId!;
    const db = getDb();

    const vec = await embedQuery(q);
    const vecStr = `[${vec.join(',')}]`;

    let rows: unknown[];

    if (type === 'sessions') {
      if (hybrid) {
        const result = await db.execute(sql`
          SELECT id, headline, summary, created_at,
                 1 - (embedding <=> ${vecStr}::vector) AS similarity,
                 (${vectorWeight} * (1 - (embedding <=> ${vecStr}::vector)) +
                  ${textWeight} * COALESCE(ts_rank(search_vector, plainto_tsquery('simple', ${q})), 0)
                 ) AS score
          FROM session_summaries
          WHERE company_id = ${cid}
            AND embedding IS NOT NULL
            AND 1 - (embedding <=> ${vecStr}::vector) >= ${minSimilarity}
          ORDER BY score DESC
          LIMIT ${limit}
        `);
        rows = result.rows;
      } else {
        const result = await db.execute(sql`
          SELECT id, headline, summary, created_at,
                 1 - (embedding <=> ${vecStr}::vector) AS similarity
          FROM session_summaries
          WHERE company_id = ${cid}
            AND embedding IS NOT NULL
            AND 1 - (embedding <=> ${vecStr}::vector) >= ${minSimilarity}
          ORDER BY embedding <=> ${vecStr}::vector
          LIMIT ${limit}
        `);
        rows = result.rows;
      }
    } else if (type === 'artifacts') {
      if (hybrid) {
        const result = await db.execute(sql`
          SELECT id, title, description, type, created_at,
                 1 - (embedding <=> ${vecStr}::vector) AS similarity,
                 (${vectorWeight} * (1 - (embedding <=> ${vecStr}::vector)) +
                  ${textWeight} * COALESCE(ts_rank(search_vector, plainto_tsquery('simple', ${q})), 0)
                 ) AS score
          FROM artifacts
          WHERE company_id = ${cid}
            AND embedding IS NOT NULL
            AND 1 - (embedding <=> ${vecStr}::vector) >= ${minSimilarity}
          ORDER BY score DESC
          LIMIT ${limit}
        `);
        rows = result.rows;
      } else {
        const result = await db.execute(sql`
          SELECT id, title, description, type, created_at,
                 1 - (embedding <=> ${vecStr}::vector) AS similarity
          FROM artifacts
          WHERE company_id = ${cid}
            AND embedding IS NOT NULL
            AND 1 - (embedding <=> ${vecStr}::vector) >= ${minSimilarity}
          ORDER BY embedding <=> ${vecStr}::vector
          LIMIT ${limit}
        `);
        rows = result.rows;
      }
    } else {
      // memories (default)
      if (hybrid) {
        const result = await db.execute(sql`
          SELECT id, title, content, type, created_at,
                 1 - (embedding <=> ${vecStr}::vector) AS similarity,
                 (${vectorWeight} * (1 - (embedding <=> ${vecStr}::vector)) +
                  ${textWeight} * COALESCE(ts_rank(search_vector, plainto_tsquery('simple', ${q})), 0)
                 ) AS score
          FROM memories
          WHERE company_id = ${cid}
            AND embedding IS NOT NULL
            AND 1 - (embedding <=> ${vecStr}::vector) >= ${minSimilarity}
          ORDER BY score DESC
          LIMIT ${limit}
        `);
        rows = result.rows;
      } else {
        const result = await db.execute(sql`
          SELECT id, title, content, type, created_at,
                 1 - (embedding <=> ${vecStr}::vector) AS similarity
          FROM memories
          WHERE company_id = ${cid}
            AND embedding IS NOT NULL
            AND 1 - (embedding <=> ${vecStr}::vector) >= ${minSimilarity}
          ORDER BY embedding <=> ${vecStr}::vector
          LIMIT ${limit}
        `);
        rows = result.rows;
      }
    }

    res.json({
      data: rows,
      meta: { type, min_similarity: minSimilarity, hybrid, vector_weight: vectorWeight, text_weight: textWeight },
    });
  } catch (err) {
    next(err);
  }
});
