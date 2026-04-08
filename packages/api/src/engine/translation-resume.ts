/**
 * 起動時に未完了の翻訳を自動再開するエンジン
 * - API起動から10秒後に実行（他の初期化処理が完了するのを待つ）
 * - description_translated / usage_examples_translated / usage_content_translated が
 *   NULL のスキルを対象に refineSyncInBackground を呼び出す
 */
import { getDb } from '@maestro/db';
import { sql } from 'drizzle-orm';

let timer: ReturnType<typeof setTimeout> | null = null;

export function startTranslationResume(): void {
  // 10秒後に実行（起動直後のDB接続待ちを考慮）
  timer = setTimeout(async () => {
    try {
      const db = getDb();

      // 全社分の未完了翻訳をチェック
      // json型はDISTINCT/GROUP BYが使えないため、company_idだけ先に取得
      const rows = await db.execute(sql`
        SELECT DISTINCT p.company_id
        FROM plugins p
        WHERE p.description_translated IS NULL
          OR p.usage_examples_translated IS NULL
          OR p.usage_content_translated IS NULL
      `);

      if (rows.rows.length === 0) {
        console.log('[translation-resume] 未翻訳スキルなし、スキップ');
        return;
      }

      for (const row of rows.rows as { company_id: string }[]) {
        const companyId = row.company_id;
        // 言語設定を別途取得
        const companyRow = await db.execute(sql`SELECT settings FROM companies WHERE id = ${companyId} LIMIT 1`);
        const settings = (companyRow.rows[0] as { settings: Record<string, unknown> | null } | undefined)?.settings ?? {};
        const lang = (settings.language as string) ?? 'ja';
        if (lang === 'en') continue;

        const pending = await db.execute(sql`
          SELECT id, name, description, usage_content
          FROM plugins
          WHERE company_id = ${companyId}
            AND (description_translated IS NULL OR usage_examples_translated IS NULL OR usage_content_translated IS NULL)
          LIMIT 500
        `);

        const skills = (pending.rows as { id: string; name: string; description: string; usage_content: string | null }[])
          .map(r => ({ id: r.id, name: r.name, description: r.description, usageContent: r.usage_content }));

        if (skills.length === 0) continue;

        console.log(`[translation-resume] ${skills.length}件の未翻訳スキルを再開 (company: ${companyId}, lang: ${lang})`);

        // 動的インポートで循環参照を回避
        const { refineSyncInBackground } = await import('../routes/plugins.js');
        refineSyncInBackground(companyId, lang, skills).catch(() => {});
      }
    } catch (err) {
      console.error('[translation-resume] 再開処理失敗:', err);
    }
  }, 10_000);
}

export function stopTranslationResume(): void {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
}
