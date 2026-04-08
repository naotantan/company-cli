-- A1: ハイブリッド検索（ベクトル + 全文検索）
-- 各テーブルに search_vector tsvector カラムを追加し、
-- 挿入・更新時にトリガーで自動更新する。
-- 'simple' 辞書を使用（日英混在テキスト対応）

ALTER TABLE plugins           ADD COLUMN IF NOT EXISTS search_vector tsvector;
ALTER TABLE memories          ADD COLUMN IF NOT EXISTS search_vector tsvector;
ALTER TABLE session_summaries ADD COLUMN IF NOT EXISTS search_vector tsvector;
ALTER TABLE artifacts         ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- GIN インデックス（全文検索高速化）
CREATE INDEX IF NOT EXISTS idx_plugins_search_vector           ON plugins           USING gin(search_vector);
CREATE INDEX IF NOT EXISTS idx_memories_search_vector          ON memories          USING gin(search_vector);
CREATE INDEX IF NOT EXISTS idx_session_summaries_search_vector ON session_summaries USING gin(search_vector);
CREATE INDEX IF NOT EXISTS idx_artifacts_search_vector         ON artifacts         USING gin(search_vector);

-- plugins: name(A) > category(B) > description(C) > usage_content(D)
CREATE OR REPLACE FUNCTION update_plugins_search_vector() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('simple', coalesce(NEW.name, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(NEW.category, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(NEW.description, '')), 'C') ||
    setweight(to_tsvector('simple', coalesce(substring(NEW.usage_content, 1, 1000), '')), 'D');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_plugins_search_vector ON plugins;
CREATE TRIGGER trg_plugins_search_vector
  BEFORE INSERT OR UPDATE OF name, category, description, usage_content
  ON plugins FOR EACH ROW
  EXECUTE FUNCTION update_plugins_search_vector();

-- memories: title(A) > type(B) > content(C)
CREATE OR REPLACE FUNCTION update_memories_search_vector() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('simple', coalesce(NEW.title, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(NEW.type, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(NEW.content, '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_memories_search_vector ON memories;
CREATE TRIGGER trg_memories_search_vector
  BEFORE INSERT OR UPDATE OF title, type, content
  ON memories FOR EACH ROW
  EXECUTE FUNCTION update_memories_search_vector();

-- session_summaries: headline(A) > summary(B)
CREATE OR REPLACE FUNCTION update_sessions_search_vector() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('simple', coalesce(NEW.headline, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(NEW.summary, '')), 'B');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_session_summaries_search_vector ON session_summaries;
CREATE TRIGGER trg_session_summaries_search_vector
  BEFORE INSERT OR UPDATE OF headline, summary
  ON session_summaries FOR EACH ROW
  EXECUTE FUNCTION update_sessions_search_vector();

-- artifacts: title(A) > type(B) > description(C) > content(D)
CREATE OR REPLACE FUNCTION update_artifacts_search_vector() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('simple', coalesce(NEW.title, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(NEW.type, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(NEW.description, '')), 'C') ||
    setweight(to_tsvector('simple', coalesce(substring(NEW.content, 1, 2000), '')), 'D');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_artifacts_search_vector ON artifacts;
CREATE TRIGGER trg_artifacts_search_vector
  BEFORE INSERT OR UPDATE OF title, type, description, content
  ON artifacts FOR EACH ROW
  EXECUTE FUNCTION update_artifacts_search_vector();

-- 既存データの search_vector を一括更新
UPDATE plugins SET
  search_vector =
    setweight(to_tsvector('simple', coalesce(name, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(category, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(description, '')), 'C') ||
    setweight(to_tsvector('simple', coalesce(substring(usage_content, 1, 1000), '')), 'D');

UPDATE memories SET
  search_vector =
    setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(type, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(content, '')), 'C');

UPDATE session_summaries SET
  search_vector =
    setweight(to_tsvector('simple', coalesce(headline, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(summary, '')), 'B');

UPDATE artifacts SET
  search_vector =
    setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(type, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(description, '')), 'C') ||
    setweight(to_tsvector('simple', coalesce(substring(content, 1, 2000), '')), 'D');
