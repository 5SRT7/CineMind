CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS movie_search_cache (
  id BIGSERIAL PRIMARY KEY,
  tmdb_id BIGINT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  original_title TEXT NOT NULL,
  overview TEXT NOT NULL DEFAULT '',
  release_date TEXT,
  runtime INT,
  genres JSONB NOT NULL DEFAULT '[]',
  keywords JSONB NOT NULL DEFAULT '[]',
  director JSONB NOT NULL DEFAULT '[]',
  cast_names JSONB NOT NULL DEFAULT '[]',
  poster_path TEXT,
  backdrop_path TEXT,
  vote_average DOUBLE PRECISION NOT NULL DEFAULT 0,
  vote_count BIGINT NOT NULL DEFAULT 0,
  original_language TEXT,
  ai_tags JSONB NOT NULL DEFAULT '[]',
  embedding vector(1536),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS movie_search_cache_embedding_idx
  ON movie_search_cache
  USING hnsw (embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS movie_search_cache_expires_idx
  ON movie_search_cache (expires_at);

CREATE TABLE IF NOT EXISTS user_watchlist (
  id BIGSERIAL PRIMARY KEY,
  user_key TEXT NOT NULL DEFAULT 'default',
  tmdb_id BIGINT NOT NULL,
  title TEXT NOT NULL,
  original_title TEXT NOT NULL,
  poster_path TEXT,
  backdrop_path TEXT,
  release_date TEXT,
  vote_average DOUBLE PRECISION NOT NULL DEFAULT 0,
  genres JSONB NOT NULL DEFAULT '[]',
  watched BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_key, tmdb_id)
);

CREATE INDEX IF NOT EXISTS user_watchlist_user_key_idx
  ON user_watchlist (user_key, created_at DESC);
