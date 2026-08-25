/* eslint-disable @typescript-eslint/no-explicit-any */
import { Pool } from "pg";
import type { MovieSummary } from "./types";

export type WatchlistItem = {
  tmdb_id: number;
  title: string;
  original_title: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string | null;
  vote_average: number;
  genres: string[];
  watched: boolean;
  created_at: string;
};

let pool: Pool | null = null;
let schemaReady: Promise<void> | null = null;

function defaultUserKey() {
  return process.env.WATCHLIST_USER_KEY || "default";
}

function getPool() {
  if (!process.env.DATABASE_URL) {
    throw new Error("Neon database is not configured");
  }
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 3,
      connectionTimeoutMillis: 3000,
    });
  }
  return pool;
}

async function ensureSchema() {
  if (!schemaReady) {
    schemaReady = getPool()
      .query(`
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
        )
      `)
      .then(() => undefined)
      .catch((error) => {
        schemaReady = null;
        throw error;
      });
  }
  return schemaReady;
}

function mapWatchlistRow(row: Record<string, any>): WatchlistItem {
  return {
    tmdb_id: Number(row.tmdb_id),
    title: row.title,
    original_title: row.original_title,
    poster_path: row.poster_path ?? null,
    backdrop_path: row.backdrop_path ?? null,
    release_date: row.release_date ?? null,
    vote_average: Number(row.vote_average || 0),
    genres: Array.isArray(row.genres) ? row.genres : [],
    watched: Boolean(row.watched),
    created_at:
      row.created_at instanceof Date
        ? row.created_at.toISOString()
        : String(row.created_at ?? ""),
  };
}

export async function getWatchlist(
  userKey = defaultUserKey(),
): Promise<WatchlistItem[]> {
  await ensureSchema();
  const result = await getPool().query(
    `
    SELECT tmdb_id, title, original_title, poster_path, backdrop_path,
      release_date, vote_average, genres, watched, created_at
    FROM user_watchlist
    WHERE user_key = $1
    ORDER BY created_at DESC
    `,
    [userKey],
  );
  return result.rows.map(mapWatchlistRow);
}

export async function isInWatchlist(
  tmdbId: number,
  userKey = defaultUserKey(),
) {
  await ensureSchema();
  const result = await getPool().query(
    `
    SELECT 1 FROM user_watchlist
    WHERE user_key = $1 AND tmdb_id = $2
    LIMIT 1
    `,
    [userKey, tmdbId],
  );
  return (result.rowCount ?? 0) > 0;
}

export async function addToWatchlist(
  movie: MovieSummary,
  userKey = defaultUserKey(),
) {
  await ensureSchema();
  await getPool().query(
    `
    INSERT INTO user_watchlist (
      user_key, tmdb_id, title, original_title, poster_path, backdrop_path,
      release_date, vote_average, genres
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
    ON CONFLICT (user_key, tmdb_id) DO NOTHING
    `,
    [
      userKey,
      movie.tmdb_id,
      movie.title,
      movie.original_title,
      movie.poster_path,
      movie.backdrop_path,
      movie.release_date,
      movie.vote_average,
      JSON.stringify(movie.genres),
    ],
  );
}

export async function removeFromWatchlist(
  tmdbId: number,
  userKey = defaultUserKey(),
) {
  await ensureSchema();
  const result = await getPool().query(
    `
    DELETE FROM user_watchlist
    WHERE user_key = $1 AND tmdb_id = $2
    `,
    [userKey, tmdbId],
  );
  return (result.rowCount ?? 0) > 0;
}
