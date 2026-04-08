-- A2: 長文ドキュメントのチャンキング用テーブル
-- usage_content が長いスキルを後半キーワードでも検索できるようにする

CREATE TABLE IF NOT EXISTS plugin_chunks (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  plugin_id   uuid        NOT NULL REFERENCES plugins(id)   ON DELETE CASCADE,
  company_id  uuid        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  chunk_index integer     NOT NULL,
  chunk_text  text        NOT NULL,
  embedding   vector(384),
  created_at  timestamp   DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_plugin_chunks_plugin  ON plugin_chunks(plugin_id);
CREATE INDEX IF NOT EXISTS idx_plugin_chunks_company ON plugin_chunks(company_id);

-- HNSW インデックス（チャンク検索高速化）
CREATE INDEX IF NOT EXISTS idx_plugin_chunks_embedding_hnsw
  ON plugin_chunks USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
