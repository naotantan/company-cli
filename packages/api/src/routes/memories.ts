import { Router, type Router as RouterType } from 'express';
import { getDb, memories } from '@maestro/db';
import { eq, and, desc, sql, ilike, or, inArray } from 'drizzle-orm';
import { sanitizeString, sanitizePagination } from '../middleware/validate';

/** C3: PATCH後にバックグラウンドでembeddingを再生成する */
async function scheduleMemoryEmbedding(id: string, mem: { title: string; content: string; type?: string | null }): Promise<void> {
  try {
    const { embedPassage, buildMemoryEmbedText } = await import('../services/embedding.js');
    const vec = await embedPassage(buildMemoryEmbedText(mem));
    const db = getDb();
    await db.execute(sql`UPDATE memories SET embedding = ${`[${vec.join(',')}]`}::vector WHERE id = ${id}`);
  } catch { /* embedding失敗は無視 */ }
}

export const memoriesRouter: RouterType = Router();

// GET /api/memories — 記憶一覧（新しい順、ページネーション付き）
// クエリパラメータ: type, project_path, q (全文検索), tag
memoriesRouter.get('/', async (req, res, next) => {
  try {
    const db = getDb();
    const { limit, offset } = sanitizePagination(req.query);
    const { type, project_path, q, tag } = req.query as Record<string, string | undefined>;

    const conditions = [eq(memories.company_id, req.companyId!)];

    if (type) conditions.push(eq(memories.type, type));
    if (project_path) conditions.push(eq(memories.project_path, project_path));

    // 全文検索 (title + content)
    if (q) {
      const searchTerm = `%${q}%`;
      conditions.push(
        or(
          ilike(memories.title, searchTerm),
          ilike(memories.content, searchTerm),
        )!
      );
    }

    // タグ検索 (JSONB contains)
    if (tag) {
      conditions.push(sql`${memories.tags} @> ${JSON.stringify([tag])}::jsonb`);
    }

    const whereClause = and(...conditions);

    const [countResult, rows] = await Promise.all([
      db.select({ cnt: sql<number>`count(*)::int` }).from(memories).where(whereClause),
      db.select().from(memories).where(whereClause)
        .orderBy(desc(memories.created_at))
        .limit(limit)
        .offset(offset),
    ]);

    res.json({
      data: rows,
      meta: { total: countResult[0]?.cnt ?? 0, limit, offset },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/memories/recall — キーワードで記憶を想起（検索 + recall_count 更新）
memoriesRouter.get('/recall', async (req, res, next) => {
  try {
    const db = getDb();
    const { q, project_path, limit: limitStr } = req.query as Record<string, string | undefined>;

    if (!q) {
      res.status(400).json({ error: 'validation_failed', message: 'q (検索キーワード) は必須です' });
      return;
    }

    const maxResults = Math.min(parseInt(limitStr || '10', 10) || 10, 50);
    const searchTerm = `%${q}%`;

    const conditions = [
      eq(memories.company_id, req.companyId!),
      or(
        ilike(memories.title, searchTerm),
        ilike(memories.content, searchTerm),
      )!,
    ];
    if (project_path) conditions.push(eq(memories.project_path, project_path));

    const rows = await db
      .select()
      .from(memories)
      .where(and(...conditions))
      .orderBy(desc(memories.importance), desc(memories.created_at))
      .limit(maxResults);

    // recall_count と last_recalled_at を更新
    if (rows.length > 0) {
      const ids = rows.map((r) => r.id);
      await db
        .update(memories)
        .set({
          recall_count: sql`${memories.recall_count} + 1`,
          last_recalled_at: sql`now()`,
        })
        .where(and(
          eq(memories.company_id, req.companyId!),
          inArray(memories.id, ids),
        ));
    }

    res.json({ data: rows, meta: { query: q, count: rows.length } });
  } catch (err) {
    next(err);
  }
});

// POST /api/memories — 記憶を保存
memoriesRouter.post('/', async (req, res, next) => {
  try {
    const { title, content, type, tags, session_id, project_path, importance } = req.body as {
      title?: string;
      content?: string;
      type?: string;
      tags?: string[];
      session_id?: string;
      project_path?: string;
      importance?: number;
    };

    if (!title || !content) {
      res.status(400).json({ error: 'validation_failed', message: 'title と content は必須です' });
      return;
    }

    const validTypes = ['user', 'feedback', 'project', 'reference', 'session', 'design', 'report'];
    const memType = type && validTypes.includes(type) ? type : 'session';

    const imp = importance !== undefined ? Math.max(1, Math.min(5, importance)) : 3;

    const db = getDb();
    const [created] = await db.insert(memories).values({
      company_id: req.companyId!,
      title: sanitizeString(title),
      content: content.replace(/\r\n/g, '\n').replace(/\r/g, '\n'),
      type: memType,
      tags: Array.isArray(tags) ? tags.map((t) => sanitizeString(t)) : [],
      session_id: session_id || null,
      project_path: project_path || null,
      importance: imp,
    }).returning();

    res.status(201).json({ data: created });
  } catch (err) {
    next(err);
  }
});

// GET /api/memories/:id — 記憶を個別取得
memoriesRouter.get('/:id', async (req, res, next) => {
  try {
    const db = getDb();
    const [row] = await db
      .select()
      .from(memories)
      .where(and(eq(memories.id, req.params.id), eq(memories.company_id, req.companyId!)));

    if (!row) {
      res.status(404).json({ error: 'not_found', message: '記憶が見つかりません' });
      return;
    }
    res.json({ data: row });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/memories/:id — 記憶を更新
memoriesRouter.patch('/:id', async (req, res, next) => {
  try {
    const db = getDb();
    const { title, content, type, tags, importance } = req.body as {
      title?: string;
      content?: string;
      type?: string;
      tags?: string[];
      importance?: number;
    };

    const updateFields: Record<string, unknown> = { updated_at: new Date() };
    if (title !== undefined) updateFields.title = sanitizeString(title);
    if (content !== undefined) updateFields.content = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    if (type !== undefined) updateFields.type = type;
    if (tags !== undefined) updateFields.tags = tags.map((t) => sanitizeString(t));
    if (importance !== undefined) updateFields.importance = Math.max(1, Math.min(5, importance));

    const [updated] = await db
      .update(memories)
      .set(updateFields)
      .where(and(eq(memories.id, req.params.id), eq(memories.company_id, req.companyId!)))
      .returning();

    if (!updated) {
      res.status(404).json({ error: 'not_found', message: '記憶が見つかりません' });
      return;
    }
    res.json({ data: updated });

    // C3: embedding関連フィールドが変わった場合はバックグラウンドで再生成
    if (title !== undefined || content !== undefined || type !== undefined) {
      scheduleMemoryEmbedding(updated.id, updated).catch(() => {});
    }
  } catch (err) {
    next(err);
  }
});

// DELETE /api/memories/:id — 記憶を削除
memoriesRouter.delete('/:id', async (req, res, next) => {
  try {
    const db = getDb();
    const [deleted] = await db
      .delete(memories)
      .where(and(eq(memories.id, req.params.id), eq(memories.company_id, req.companyId!)))
      .returning();

    if (!deleted) {
      res.status(404).json({ error: 'not_found', message: '記憶が見つかりません' });
      return;
    }
    res.json({ data: deleted });
  } catch (err) {
    next(err);
  }
});


// GET /api/memories/search?q=text&limit=10 — セマンティック検索
memoriesRouter.get('/search', async (req, res, next) => {
  try {
    const q = String(req.query.q ?? '').trim();
    if (!q) { res.status(400).json({ error: 'クエリが必要です' }); return; }
    const limit = Math.min(Number(req.query.limit ?? 10), 50);
    const { embedQuery } = await import('../services/embedding.js');
    const vec = await embedQuery(q);
    const db = getDb();
    const rows = await db.execute(sql`
      SELECT id, type, title, content, tags, importance, session_id, project_path,
             last_recalled_at, recall_count, created_at,
             1 - (embedding <=> ${`[${vec.join(',')}]`}::vector) AS similarity
      FROM memories
      WHERE company_id = ${req.companyId!}
        AND embedding IS NOT NULL
      ORDER BY embedding <=> ${`[${vec.join(',')}]`}::vector
      LIMIT ${limit}
    `);
    res.json({ data: rows.rows });
  } catch (err) { next(err); }
});
