import { Pool } from "pg";
import type { MovieDetails } from "./types";
import { cosineSimilarity } from "./ai/embedding";
import { embeddingDimensions } from "./ai/provider";

const TTL_HOURS = Number(process.env.AI_SEARCH_TTL_HOURS || 24);
const EMBEDDING_DIMENSIONS = embeddingDimensions();

export type CacheRecord = {
  tmdb_id: number;
  title: string;
  original_title: string;
  overview: string;
  release_date: string | null;
  runtime: number | null;
  genres: string[];
  keywords: string[];
  director: string[];
  cast: string[];
  poster_path: string | null;
  backdrop_path: string | null;
  vote_average: number;
  vote_count: number;
  original_language: string | null;
  ai_tags: string[];
};

type MemoryEntry = {
  record: CacheRecord;
  embedding: number[];
  expiresAt: number;
};

const memoryStore = new Map<number, MemoryEntry>();
let pool: Pool | null = null;
let schemaReady: Promise<void> | null = null;
let pgAvailable =
  Boolean(process.env.DATABASE_URL) && process.env.PGVECTOR_ENABLED !== "false";

function pgEnabled() {
  return pgAvailable;
}

function disablePg() {
  pgAvailable = false;
  schemaReady = null;
  const currentPool = pool;
  pool = null;
  void currentPool?.end().catch(() => {});
}

function getPool() {
  if (!pool && pgEnabled()) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 3,
      connectionTimeoutMillis: 5000,
    });
  }
  return pool;
}

async function ensureSchema() {
  if (!schemaReady && pgEnabled()) {
    schemaReady = (async () => {
      const client = getPool();
      if (!client) return;
      await client.query("CREATE EXTENSION IF NOT EXISTS vector");
      await client.query(`
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
          embedding vector(${EMBEDDING_DIMENSIONS}),
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          expires_at TIMESTAMPTZ NOT NULL
        )
      `);
      await client.query(
        "CREATE INDEX IF NOT EXISTS movie_search_cache_embedding_idx ON movie_search_cache USING hnsw (embedding vector_cosine_ops)",
      );
      await client.query(
        "CREATE INDEX IF NOT EXISTS movie_search_cache_expires_idx ON movie_search_cache (expires_at)",
      );
    })().catch((error) => {
      console.error("pgvector schema setup failed, falling back to memory", error);
      disablePg();
    });
    let settled = false;
    void schemaReady.then(() => {
      settled = true;
    });
    await Promise.race([
      schemaReady,
      new Promise((resolve) => setTimeout(resolve, 5000)),
    ]);
    if (!settled) {
      console.error("pgvector schema setup timed out, falling back to memory");
      disablePg();
    }
  }
  return schemaReady;
}

function cleanMemory() {
  const now = Date.now();
  for (const [key, entry] of memoryStore) {
    if (entry.expiresAt <= now) memoryStore.delete(key);
  }
}

export async function cleanupExpired() {
  if (pgEnabled()) {
    try {
      await ensureSchema();
      if (!pgEnabled()) throw new Error("pgvector disabled after timeout");
      await getPool()?.query("DELETE FROM movie_search_cache WHERE expires_at < NOW()");
      return;
    } catch (error) {
      console.error("pgvector cleanup failed", error);
      disablePg();
    }
  }
  cleanMemory();
}

export async function upsertMovieEmbedding(
  record: CacheRecord,
  embedding: number[],
) {
  const expiresAt = new Date(Date.now() + TTL_HOURS * 60 * 60 * 1000);
  if (pgEnabled()) {
    try {
      await ensureSchema();
      if (!pgEnabled()) throw new Error("pgvector disabled after timeout");
      await getPool()?.query(
        `
        INSERT INTO movie_search_cache (
          tmdb_id, title, original_title, overview, release_date, runtime,
          genres, keywords, director, cast_names, poster_path, backdrop_path,
          vote_average, vote_count, original_language, ai_tags, embedding, expires_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9::jsonb, $10::jsonb,
          $11, $12, $13, $14, $15, $16::jsonb, $17::vector, $18
        )
        ON CONFLICT (tmdb_id) DO UPDATE SET
          title = EXCLUDED.title,
          original_title = EXCLUDED.original_title,
          overview = EXCLUDED.overview,
          release_date = EXCLUDED.release_date,
          runtime = EXCLUDED.runtime,
          genres = EXCLUDED.genres,
          keywords = EXCLUDED.keywords,
          director = EXCLUDED.director,
          cast_names = EXCLUDED.cast_names,
          poster_path = EXCLUDED.poster_path,
          backdrop_path = EXCLUDED.backdrop_path,
          vote_average = EXCLUDED.vote_average,
          vote_count = EXCLUDED.vote_count,
          original_language = EXCLUDED.original_language,
          ai_tags = EXCLUDED.ai_tags,
          embedding = EXCLUDED.embedding,
          expires_at = EXCLUDED.expires_at
        `,
        [
          record.tmdb_id,
          record.title,
          record.original_title,
          record.overview,
          record.release_date,
          record.runtime,
          JSON.stringify(record.genres),
          JSON.stringify(record.keywords),
          JSON.stringify(record.director),
          JSON.stringify(record.cast),
          record.poster_path,
          record.backdrop_path,
          record.vote_average,
          record.vote_count,
          record.original_language,
          JSON.stringify(record.ai_tags),
          `[${embedding.join(",")}]`,
          expiresAt.toISOString(),
        ],
      );
      return;
    } catch (error) {
      console.error("pgvector upsert failed, falling back to memory", error);
      disablePg();
    }
  }
  memoryStore.set(record.tmdb_id, {
    record,
    embedding,
    expiresAt: expiresAt.getTime(),
  });
}

export async function searchVectorStore(
  queryEmbedding: number[],
  limit = 12,
): Promise<Map<number, number>> {
  if (pgEnabled()) {
    try {
      await ensureSchema();
      if (!pgEnabled()) throw new Error("pgvector disabled after timeout");
      const result = await getPool()?.query(
        `
        SELECT tmdb_id, 1 - (embedding <=> $1::vector) AS similarity
        FROM movie_search_cache
        WHERE expires_at > NOW() AND embedding IS NOT NULL
        ORDER BY embedding <=> $1::vector
        LIMIT $2
        `,
        [`[${queryEmbedding.join(",")}]`, limit],
      );
      const similarities = new Map<number, number>();
      for (const row of result?.rows ?? []) {
        similarities.set(Number(row.tmdb_id), Number(row.similarity));
      }
      return similarities;
    } catch (error) {
      console.error("pgvector search failed, falling back to memory", error);
      disablePg();
    }
  }

  cleanMemory();
  const scored = [...memoryStore.entries()]
    .filter(([, entry]) => entry.expiresAt > Date.now())
    .map(([tmdbId, entry]) => ({
      tmdbId,
      score: cosineSimilarity(queryEmbedding, entry.embedding),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
  return new Map(scored.map((item) => [item.tmdbId, item.score]));
}

export async function getCachedMovie(tmdbId: number): Promise<CacheRecord | null> {
  if (pgEnabled()) {
    try {
      await ensureSchema();
      if (!pgEnabled()) throw new Error("pgvector disabled after timeout");
      const result = await getPool()?.query(
        `
        SELECT tmdb_id, title, original_title, overview, release_date, runtime,
          genres, keywords, director, cast_names, poster_path, backdrop_path,
          vote_average, vote_count, original_language, ai_tags
        FROM movie_search_cache
        WHERE tmdb_id = $1 AND expires_at > NOW()
        `,
        [tmdbId],
      );
      const row = result?.rows?.[0];
      if (!row) return null;
      return {
        tmdb_id: Number(row.tmdb_id),
        title: row.title,
        original_title: row.original_title,
        overview: row.overview,
        release_date: row.release_date,
        runtime: row.runtime,
        genres: row.genres ?? [],
        keywords: row.keywords ?? [],
        director: row.director ?? [],
        cast: row.cast_names ?? [],
        poster_path: row.poster_path,
        backdrop_path: row.backdrop_path,
        vote_average: Number(row.vote_average),
        vote_count: Number(row.vote_count),
        original_language: row.original_language,
        ai_tags: row.ai_tags ?? [],
      };
    } catch (error) {
      console.error("pgvector cache read failed", error);
      disablePg();
    }
  }
  cleanMemory();
  const entry = memoryStore.get(tmdbId);
  if (!entry || entry.expiresAt <= Date.now()) return null;
  return entry.record;
}

export function vectorStoreKind() {
  return pgEnabled() ? "pgvector" : "memory";
}

export function recordFromDetails(movie: MovieDetails): CacheRecord {
  return {
    tmdb_id: movie.tmdb_id,
    title: movie.title,
    original_title: movie.original_title,
    overview: movie.overview,
    release_date: movie.release_date,
    runtime: movie.runtime,
    genres: movie.genres,
    keywords: movie.keywords,
    director: movie.director,
    cast: movie.cast.map((member) => member.name),
    poster_path: movie.poster_path,
    backdrop_path: movie.backdrop_path,
    vote_average: movie.vote_average,
    vote_count: movie.vote_count,
    original_language: movie.original_language,
    ai_tags: movie.ai_tags,
  };
}
