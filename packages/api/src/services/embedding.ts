/**
 * 埋め込みサービス — Transformers.js (ローカル実行、APIキー不要)
 * デフォルトモデル: multilingual-e5-small (Xenova/multilingual-e5-small)
 *   - 384次元、多言語対応（日本語◎）
 *   - M1 Mac: 推論 ~30ms, モデルサイズ ~120MB
 *   - E5モデル規約: 保存テキストは "passage: " prefix、検索クエリは "query: " prefix
 *
 * 環境変数:
 *   EMBEDDING_MODEL   — モデル名（デフォルト: Xenova/multilingual-e5-small）
 *   EMBEDDING_WARMUP  — "false" でウォームアップ無効化
 *   HF_CACHE_DIR      — Hugging Faceキャッシュディレクトリ
 */

/** prefixを除いたコンテンツの最大文字数 */
const MAX_CONTENT_CHARS = 503;

/** D3: サポートするモデルとそのベクトル次元数 */
const SUPPORTED_MODELS: Record<string, number> = {
  'Xenova/multilingual-e5-small': 384,
  'Xenova/multilingual-e5-large': 1024,
  'Xenova/nomic-embed-text-v1': 768,
};

function getModelName(): string {
  return process.env.EMBEDDING_MODEL ?? 'Xenova/multilingual-e5-small';
}

/** D3: 現在のモデルのベクトル次元数を返す */
export function getEmbeddingDims(): number {
  return SUPPORTED_MODELS[getModelName()] ?? 384;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let pipelineInstance: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let initPromise: Promise<any> | null = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getPipeline(): Promise<any> {
  if (pipelineInstance) return pipelineInstance;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    // @ts-ignore — @xenova/transformers は ESM のため動的インポートが必要
    const mod = await import('@xenova/transformers');
    const { pipeline, env } = mod;
    env.cacheDir = process.env.HF_CACHE_DIR ?? '/tmp/hf-cache';
    env.allowLocalModels = false;

    const modelName = getModelName();
    console.log(`[embedding] モデルをロード中: ${modelName}`);
    const p = await pipeline('feature-extraction', modelName);
    console.log('[embedding] モデルロード完了');
    pipelineInstance = p;
    return p;
  })();

  return initPromise;
}

/** B1: サーバー起動時のモデルウォームアップ */
export async function warmupEmbedding(): Promise<void> {
  if (process.env.EMBEDDING_WARMUP === 'false') return;
  const start = Date.now();
  await runEmbed('query: warmup');
  console.log(`[embedding] ウォームアップ完了: ${Date.now() - start}ms`);
}

/** テキストをベクトルに変換（prefixを含む完成形テキストを渡す） */
async function runEmbed(textWithPrefix: string): Promise<number[]> {
  if (!textWithPrefix || textWithPrefix.trim().length === 0) return new Array(getEmbeddingDims()).fill(0);
  const pipe = await getPipeline();
  const output = await pipe(textWithPrefix.slice(0, 512), { pooling: 'mean', normalize: true });
  return Array.from(output.data as Float32Array);
}

// ---- B4: LRU クエリキャッシュ ----

const CACHE_MAX = 100;
const queryCache = new Map<string, number[]>();
let cacheHits = 0;
let cacheMisses = 0;

function normalizeQuery(q: string): string {
  return q.trim().toLowerCase();
}

function cacheGet(key: string): number[] | undefined {
  const val = queryCache.get(key);
  if (val !== undefined) {
    // LRU: 最近使ったものを末尾へ移動
    queryCache.delete(key);
    queryCache.set(key, val);
  }
  return val;
}

function cacheSet(key: string, val: number[]): void {
  if (queryCache.has(key)) {
    queryCache.delete(key);
  } else if (queryCache.size >= CACHE_MAX) {
    // 最も古いエントリを削除（Map は挿入順を保持）
    const oldest = queryCache.keys().next().value;
    if (oldest !== undefined) queryCache.delete(oldest);
  }
  queryCache.set(key, val);
}

/** B4: クエリキャッシュの統計情報を返す（/embed/status で使用） */
export function getCacheStats(): { hits: number; misses: number; size: number } {
  return { hits: cacheHits, misses: cacheMisses, size: queryCache.size };
}

// ---- end LRU ----

/**
 * ドキュメント（保存側）の埋め込みを生成する
 * E5規約: "passage: " プレフィックスが必要
 */
export async function embedPassage(text: string): Promise<number[]> {
  return runEmbed(`passage: ${text.slice(0, MAX_CONTENT_CHARS)}`);
}

/**
 * B2: バッチでドキュメントの埋め込みを生成する（最大16件ずつ処理）
 * reindex の高速化に使用する。単件リアルタイム処理は embedPassage を使うこと。
 */
export async function embedPassageBatch(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const BATCH_SIZE = 16;
  const results: number[][] = [];
  const pipe = await getPipeline();
  const dims = getEmbeddingDims();

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts
      .slice(i, i + BATCH_SIZE)
      .map(t => `passage: ${t.slice(0, MAX_CONTENT_CHARS)}`);
    try {
      const output = await pipe(batch, { pooling: 'mean', normalize: true });
      // output.data は [N * dims] の Float32Array（バッチ出力）
      const flat = Array.from(output.data as Float32Array);
      for (let j = 0; j < batch.length; j++) {
        results.push(flat.slice(j * dims, (j + 1) * dims));
      }
    } catch {
      // バッチ失敗時は個別処理にフォールバック
      for (const t of batch) {
        try {
          const out = await pipe(t.slice(0, 512), { pooling: 'mean', normalize: true });
          results.push(Array.from(out.data as Float32Array));
        } catch {
          results.push(new Array(dims).fill(0));
        }
      }
    }
  }
  return results;
}

/**
 * クエリ（検索側）の埋め込みを生成する — LRUキャッシュ付き (B4)
 * E5規約: "query: " プレフィックスが必要
 */
export async function embedQuery(text: string): Promise<number[]> {
  const key = normalizeQuery(text);
  const cached = cacheGet(key);
  if (cached) {
    cacheHits++;
    return cached;
  }
  cacheMisses++;
  const vec = await runEmbed(`query: ${text.slice(0, MAX_CONTENT_CHARS)}`);
  cacheSet(key, vec);
  return vec;
}

/**
 * スキルのembedding用テキストを構築する
 * name + category + description + usage_content（先頭部分）を結合
 */
export function buildPluginEmbedText(plugin: {
  name: string;
  description?: string | null;
  usage_content?: string | null;
  category?: string | null;
}): string {
  const parts: string[] = [plugin.name];
  if (plugin.category) parts.push(plugin.category);
  if (plugin.description) parts.push(plugin.description.slice(0, 150));
  if (plugin.usage_content) parts.push(plugin.usage_content.slice(0, 250));
  return parts.join(' ').slice(0, MAX_CONTENT_CHARS);
}

/** メモリのembedding用テキストを構築する */
export function buildMemoryEmbedText(mem: {
  title: string;
  content: string;
  type?: string | null;
}): string {
  const parts: string[] = [mem.title];
  if (mem.type) parts.push(mem.type);
  parts.push(mem.content.slice(0, 400));
  return parts.join(' ').slice(0, MAX_CONTENT_CHARS);
}

/** セッションサマリーのembedding用テキストを構築する */
export function buildSessionEmbedText(sess: {
  headline?: string | null;
  summary: string;
  decisions?: string[] | null;
}): string {
  const parts: string[] = [];
  if (sess.headline) parts.push(sess.headline);
  parts.push(sess.summary.slice(0, 350));
  if (Array.isArray(sess.decisions) && sess.decisions.length > 0) {
    parts.push(sess.decisions.slice(0, 3).join(' '));
  }
  return parts.join(' ').slice(0, MAX_CONTENT_CHARS);
}

/** 成果物のembedding用テキストを構築する */
export function buildArtifactEmbedText(art: {
  title: string;
  description?: string | null;
  content?: string | null;
  artifact_type?: string | null;
}): string {
  const parts: string[] = [art.title];
  if (art.artifact_type) parts.push(art.artifact_type);
  if (art.description) parts.push(art.description.slice(0, 150));
  if (art.content) parts.push(art.content.slice(0, 200));
  return parts.join(' ').slice(0, MAX_CONTENT_CHARS);
}

/**
 * A2: テキストをチャンク配列に分割する
 * @param text - 分割するテキスト
 * @param chunkSize - 1チャンクの最大文字数（デフォルト: 400）
 * @param overlap - チャンク間のオーバーラップ文字数（デフォルト: 50）
 */
export function buildChunks(text: string, chunkSize = 400, overlap = 50): string[] {
  if (!text) return [];
  if (text.length <= chunkSize) return [text];
  const chunks: string[] = [];
  const step = chunkSize - overlap;
  for (let start = 0; start < text.length; start += step) {
    chunks.push(text.slice(start, start + chunkSize));
    if (start + chunkSize >= text.length) break;
  }
  return chunks;
}
