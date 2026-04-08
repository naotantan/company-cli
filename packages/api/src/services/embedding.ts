/**
 * 埋め込みサービス — Transformers.js (ローカル実行、APIキー不要)
 * モデル: multilingual-e5-small (Xenova/multilingual-e5-small)
 *   - 384次元、多言語対応（日本語◎）
 *   - M1 Mac: 推論 ~30ms, モデルサイズ ~120MB
 *   - E5モデル規約: 保存テキストは "passage: " prefix、検索クエリは "query: " prefix
 */

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

    console.log('[embedding] モデルをロード中: Xenova/multilingual-e5-small');
    const p = await pipeline('feature-extraction', 'Xenova/multilingual-e5-small');
    console.log('[embedding] モデルロード完了');
    pipelineInstance = p;
    return p;
  })();

  return initPromise;
}

/** テキストを384次元ベクトルに変換 */
async function runEmbed(text: string): Promise<number[]> {
  if (!text || text.trim().length === 0) return new Array(384).fill(0);
  const pipe = await getPipeline();
  const output = await pipe(text.slice(0, 512), { pooling: 'mean', normalize: true });
  return Array.from(output.data as Float32Array);
}

/**
 * ドキュメント（保存側）の埋め込みを生成する
 * E5規約: "passage: " プレフィックスが必要
 */
export async function embedPassage(text: string): Promise<number[]> {
  return runEmbed(`passage: ${text}`);
}

/**
 * クエリ（検索側）の埋め込みを生成する
 * E5規約: "query: " プレフィックスが必要
 */
export async function embedQuery(text: string): Promise<number[]> {
  return runEmbed(`query: ${text}`);
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
  if (plugin.description) parts.push(plugin.description.slice(0, 200));
  if (plugin.usage_content) parts.push(plugin.usage_content.slice(0, 300));
  return parts.join(' ');
}
