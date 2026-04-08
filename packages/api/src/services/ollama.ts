/**
 * Ollamaサービス — ローカルLLM (Qwen3:14b) を使った生成AI機能
 * Ollamaが localhost:11434 で動作している必要があります。
 *
 * 排他制御ポリシー:
 *  - 同時実行は1リクエストのみ（キューで順番待ち）
 *  - バッチ処理中はモデルをメモリに保持（keep_alive: BATCH_KEEP_ALIVE_SEC）
 */

const OLLAMA_BASE_URL = process.env.OLLAMA_URL ?? 'http://localhost:11434';
const GENERATION_MODEL = process.env.OLLAMA_MODEL ?? 'qwen3:14b';
/** 1リクエストあたりのタイムアウト: モデルロード(~60s) + 推論(~120s) を考慮して5分 */
const TIMEOUT_MS = 300_000;
/** バッチ処理中はモデルをこの秒数メモリに保持（30分）。バッチ間の再ロードを防ぐ */
const BATCH_KEEP_ALIVE_SEC = 1800;

/** 排他ロック: 同時に1リクエストのみ実行 */
let ollamaLockPromise: Promise<void> = Promise.resolve();

/** モデルをメモリからアンロードする（全バッチ完了後に呼ぶ想定） */
export async function unloadModel(): Promise<void> {
  try {
    await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: GENERATION_MODEL, prompt: '', keep_alive: 0 }),
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    // アンロード失敗は無視（次回ロード時に上書きされる）
  }
}

/** Ollama /api/generate を呼び出してテキストを生成する（排他制御付き） */
async function generate(prompt: string, timeoutMs = TIMEOUT_MS): Promise<string> {
  // キューに追加して順番を待つ
  const result = await new Promise<string>((resolve, reject) => {
    ollamaLockPromise = ollamaLockPromise.then(async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: GENERATION_MODEL,
            prompt,
            stream: false,
            think: false,  // Qwen3の思考モードを無効化（高速化）
            keep_alive: BATCH_KEEP_ALIVE_SEC,  // バッチ処理中はモデルをメモリに保持
            options: { temperature: 0.1 },
          }),
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`Ollama error: ${res.status}`);
        const json = await res.json() as { response?: string };
        resolve((json.response ?? '').trim());
      } catch (err) {
        reject(err);
      } finally {
        clearTimeout(timer);
      }
    });
  });
  return result;
}

/** JSON配列を抽出するヘルパー */
function extractJsonArray(text: string): unknown[] | null {
  // <think>...</think> ブロックを除去（Qwen3の思考モード）
  const cleaned = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  const match = cleaned.match(/\[[\s\S]*\]/);
  if (!match) return null;
  try {
    const parsed: unknown = JSON.parse(match[0]);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * 機能1 & 機能3: 説明文・ドキュメントを対象言語に翻訳する
 * 50件ずつバッチ処理。英語の場合はスキップ。
 */
export async function translateTexts(
  texts: string[],
  targetLang: string,
): Promise<string[]> {
  if (targetLang === 'en' || texts.length === 0) return texts;

  const langName = targetLang === 'zh' ? '中国語（簡体字）' : '日本語';
  const CHUNK = 20; // Qwen3は1バッチ20件が安定
  const result: string[] = [];

  for (let i = 0; i < texts.length; i += CHUNK) {
    const chunk = texts.slice(i, i + CHUNK);
    const prompt =
      `以下のJSON配列に含まれる英語テキストを${langName}に翻訳してください。\n` +
      `- 同じ件数・同じ順番のJSON配列だけを返してください\n` +
      `- 他のテキスト・説明・<think>ブロックは不要です\n\n` +
      `${JSON.stringify(chunk)}`;

    try {
      const response = await generate(prompt);
      const parsed = extractJsonArray(response);
      if (parsed && parsed.length === chunk.length) {
        result.push(...parsed.map((v, idx) => (typeof v === 'string' && v.length > 0 ? v : chunk[idx])));
      } else {
        result.push(...chunk);
      }
    } catch {
      result.push(...chunk);
    }
  }

  return result;
}

/**
 * 機能1.5: スキルの「使い方の例」をユーザー向け指示文として生成する
 * ユーザーがClaudeへ実際に入力する日本語の短い命令文を3件生成する
 */
export async function generateUsageExamples(
  skills: { name: string; description: string; usageContent?: string | null }[],
): Promise<string[][]> {
  if (skills.length === 0) return [];

  const CHUNK = 10;
  const results: string[][] = [];

  for (let i = 0; i < skills.length; i += CHUNK) {
    const chunk = skills.slice(i, i + CHUNK);
    const input = JSON.stringify(
      chunk.map((s) => ({
        name: s.name,
        description: (s.description ?? '').slice(0, 150),
        hint: s.usageContent ? s.usageContent.slice(0, 300) : '',
      }))
    );
    const prompt =
      `以下のAIスキル一覧について、各スキルをユーザーがClaudeへ実際に入力する日本語の短い指示文を3件ずつ生成してください。\n` +
      `- 1件あたり10〜40文字の自然な日本語命令形\n` +
      `- このスキルを呼び出したくなるような具体的な指示\n` +
      `- スキル名・説明・hintを参考にしてください\n` +
      `- 出力は入力と同じ順番で [[例1,例2,例3],[例1,例2,例3],...] の形式のJSON配列のみ\n\n` +
      `${input}`;

    try {
      const response = await generate(prompt, 120_000);
      const parsed = extractJsonArray(response);
      if (parsed && parsed.length === chunk.length) {
        for (const v of parsed) {
          const arr = Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
          results.push(arr.slice(0, 3));
        }
      } else {
        for (let j = 0; j < chunk.length; j++) results.push([]);
      }
    } catch {
      for (let j = 0; j < chunk.length; j++) results.push([]);
    }
  }

  return results;
}

/**
 * 機能2: スキルをカテゴリに分類する
 */
export async function categorizeSkillsWithOllama(
  skills: { name: string; description: string }[],
  categories: readonly string[],
  fallback: string,
): Promise<string[]> {
  if (skills.length === 0) return [];

  const CHUNK = 30;
  const results: string[] = [];

  for (let i = 0; i < skills.length; i += CHUNK) {
    const chunk = skills.slice(i, i + CHUNK);
    const input = JSON.stringify(
      chunk.map((s) => ({ name: s.name, description: s.description.slice(0, 200) }))
    );
    const prompt =
      `以下のスキル一覧を、次のカテゴリのいずれかに分類してください: ${categories.join(', ')}\n` +
      `入力と同じ順番で、カテゴリ名だけのJSON配列を返してください。他のテキストは不要です。\n\n` +
      `${input}`;

    try {
      const response = await generate(prompt, 120_000);
      const parsed = extractJsonArray(response);
      if (parsed && parsed.length === chunk.length) {
        for (const v of parsed) {
          results.push(typeof v === 'string' && (categories as readonly string[]).includes(v) ? v : fallback);
        }
      } else {
        for (let j = 0; j < chunk.length; j++) results.push(fallback);
      }
    } catch {
      for (let j = 0; j < chunk.length; j++) results.push(fallback);
    }
  }

  return results;
}

/**
 * 機能3: usage_content（長文ドキュメント）を翻訳する
 */
export async function translateUsageContent(
  content: string,
  targetLang: string,
): Promise<string | null> {
  if (targetLang === 'en') return null;

  const langName = targetLang === 'zh' ? '中国語（簡体字）' : '日本語';
  const truncated = content.slice(0, 6000);
  const prompt =
    `以下の技術ドキュメントを${langName}に翻訳してください。\n` +
    `- Markdown書式を維持してください\n` +
    `- コード例・コマンド・ファイルパスはそのまま英語で残してください\n` +
    `- 翻訳結果だけを出力してください。説明や前置きは不要です。\n\n` +
    `${truncated}`;

  try {
    const response = await generate(prompt, 180_000);
    // <think>ブロックを除去
    const cleaned = response.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
    return cleaned.length > 50 ? cleaned : null;
  } catch {
    return null;
  }
}

/**
 * 機能4: セッションサマリーを生成する
 */
export async function generateSessionSummary(params: {
  summary: string;
  tasks: string[];
  changedFiles: string[];
  decisions: string[];
}): Promise<{ headline: string; briefSummary: string; keyPoints: string[] }> {
  const { summary, tasks, changedFiles, decisions } = params;

  const prompt =
    `以下のAIエージェントセッションの記録を読んで、日本語で簡潔なサマリーを生成してください。\n\n` +
    `## セッション記録\n${summary.slice(0, 3000)}\n\n` +
    `## 完了タスク\n${tasks.slice(0, 10).join('\n')}\n\n` +
    `## 変更ファイル\n${changedFiles.slice(0, 20).join('\n')}\n\n` +
    `## 意思決定\n${decisions.slice(0, 5).join('\n')}\n\n` +
    `以下のJSON形式で返してください:\n` +
    `{"headline": "1行の見出し（30文字以内）", "briefSummary": "3文以内の要約", "keyPoints": ["ポイント1", "ポイント2", "ポイント3"]}`;

  try {
    const response = await generate(prompt);
    const cleaned = response.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]) as { headline?: string; briefSummary?: string; keyPoints?: string[] };
      return {
        headline: parsed.headline ?? 'セッション完了',
        briefSummary: parsed.briefSummary ?? cleaned.slice(0, 200),
        keyPoints: Array.isArray(parsed.keyPoints) ? parsed.keyPoints : [],
      };
    }
  } catch { /* fall through */ }

  return {
    headline: 'セッション完了',
    briefSummary: summary.slice(0, 200),
    keyPoints: tasks.slice(0, 3),
  };
}

/**
 * 機能5: スキルの推薦文（ピッチ）を生成する
 */
export async function generateSkillPitch(plugin: {
  name: string;
  description?: string | null;
  usage_content?: string | null;
  category?: string | null;
}): Promise<{ pitch: string; useCases: string[]; tags: string[] }> {
  const context = [
    `スキル名: ${plugin.name}`,
    plugin.category ? `カテゴリ: ${plugin.category}` : '',
    plugin.description ? `説明: ${plugin.description.slice(0, 300)}` : '',
    plugin.usage_content ? `使い方:\n${plugin.usage_content.slice(0, 1000)}` : '',
  ].filter(Boolean).join('\n');

  const prompt =
    `以下のAIスキルについて、ユーザーに使ってもらうための推薦文を日本語で生成してください。\n\n` +
    `${context}\n\n` +
    `以下のJSON形式で返してください:\n` +
    `{"pitch": "このスキルの魅力を伝える2〜3文の推薦文", "useCases": ["使用例1", "使用例2", "使用例3"], "tags": ["タグ1", "タグ2", "タグ3"]}`;

  try {
    const response = await generate(prompt);
    const cleaned = response.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]) as { pitch?: string; useCases?: string[]; tags?: string[] };
      return {
        pitch: parsed.pitch ?? '',
        useCases: Array.isArray(parsed.useCases) ? parsed.useCases : [],
        tags: Array.isArray(parsed.tags) ? parsed.tags : [],
      };
    }
  } catch { /* fall through */ }

  return {
    pitch: plugin.description ?? '',
    useCases: [],
    tags: plugin.category ? [plugin.category] : [],
  };
}

/** Ollamaが動作しているか確認する */
export async function isOllamaAvailable(): Promise<boolean> {
  try {
    const res = await fetch(`${OLLAMA_BASE_URL}/api/tags`, { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * D1: クエリ拡張 — 元のクエリに同義語・関連語を付加してembeddingの再現率を高める
 * Ollamaが使えない場合・タイムアウトの場合は元のクエリをそのまま返す
 * @param q - 元の検索クエリ
 * @param timeoutMs - タイムアウト（ミリ秒、デフォルト5秒）
 */
export async function expandQuery(q: string, timeoutMs = 5000): Promise<string> {
  try {
    const prompt = `次の検索クエリの同義語や関連語を5つ以内で列挙してください。
クエリ: "${q}"
出力形式: カンマ区切りのキーワードのみ（説明不要）
例: テスト, テストコード, ユニットテスト, QA, 品質保証`;

    const expanded = await Promise.race([
      generate(prompt, timeoutMs),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), timeoutMs)
      ),
    ]);

    if (!expanded || expanded.length === 0) return q;
    // 元クエリ + 拡張語を結合（最大200文字）
    return `${q} ${expanded}`.slice(0, 200);
  } catch {
    return q; // フォールバック: 元クエリのみ
  }
}
