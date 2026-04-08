-- B3: IVFFlat インデックスを削除して HNSW インデックスに置き換える
-- HNSW は IVFFlat より初期構築は遅いが、事前クラスタリング不要でクエリが高速
-- パラメータ: m=16 (グラフ接続数), ef_construction=64 (構築時探索幅)

DROP INDEX IF EXISTS idx_plugins_embedding;
DROP INDEX IF EXISTS idx_session_summaries_embedding;
DROP INDEX IF EXISTS idx_artifacts_embedding;
DROP INDEX IF EXISTS idx_memories_embedding;

CREATE INDEX idx_plugins_embedding_hnsw
  ON plugins USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

CREATE INDEX idx_session_summaries_embedding_hnsw
  ON session_summaries USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

CREATE INDEX idx_artifacts_embedding_hnsw
  ON artifacts USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

CREATE INDEX idx_memories_embedding_hnsw
  ON memories USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
