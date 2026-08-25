"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BookmarkX, Loader2, Plus } from "lucide-react";
import type { WatchlistItem } from "@/lib/watchlist";
import { MoviePoster } from "./movie-poster";

export function WatchlistClient() {
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [removingId, setRemovingId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/watchlist")
      .then((response) => {
        if (!response.ok) throw new Error("get watchlist failed");
        return response.json();
      })
      .then((data) => {
        if (!cancelled) setItems(data.items ?? []);
      })
      .catch(() => {
        if (!cancelled) setError("连接不到数据库");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function remove(tmdbId: number) {
    setRemovingId(tmdbId);
    setError("");
    try {
      const response = await fetch(`/api/watchlist/${tmdbId}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("remove failed");
      setItems((current) =>
        current.filter((item) => item.tmdb_id !== tmdbId),
      );
    } catch {
      setError("连接不到数据库");
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <div className="container-page py-10">
      <div className="mb-8">
        <p className="eyebrow mb-2">Watchlist</p>
        <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
          待看电影
        </h1>
        <p className="mt-2 text-sm text-muted-strong">
          在电影详情页点击“想看”后，影片会出现在这里。
        </p>
      </div>

      {error ? (
        <div className="mb-6 rounded-lg border border-accent/30 bg-accent-soft p-4 text-sm text-accent">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          正在加载…
        </div>
      ) : null}

      {!loading && items.length === 0 && !error ? (
        <div className="rounded-xl border border-line py-16 text-center">
          <BookmarkX className="mx-auto mb-3 h-8 w-8 text-muted" aria-hidden />
          <p className="text-sm text-muted">还没有待看电影。</p>
          <Link
            href="/browse"
            className="mt-4 inline-flex h-10 items-center gap-2 rounded-lg bg-accent px-5 text-sm font-bold text-white transition-colors hover:bg-[#8f1515]"
          >
            <Plus className="h-4 w-4" aria-hidden />
            去浏览电影
          </Link>
        </div>
      ) : null}

      {!loading && items.length > 0 ? (
        <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {items.map((item) => (
            <div key={item.tmdb_id} className="group">
              <Link
                href={`/movies/${item.tmdb_id}`}
                className="relative block overflow-hidden rounded-lg transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_20px_50px_-18px_rgba(185,28,28,0.55)]"
              >
                <MoviePoster movie={item} />
              </Link>
              <div className="pt-3">
                <Link
                  href={`/movies/${item.tmdb_id}`}
                  className="line-clamp-1 text-sm font-bold hover:text-accent"
                >
                  {item.title || item.original_title}
                </Link>
                <p className="mt-1 line-clamp-1 text-xs text-muted">
                  {[item.release_date?.slice(0, 4), ...item.genres]
                    .filter(Boolean)
                    .join(" · ") || item.original_title}
                </p>
              </div>
              <button
                type="button"
                onClick={() => remove(item.tmdb_id)}
                disabled={removingId === item.tmdb_id}
                className="mt-2 flex h-8 items-center gap-1.5 rounded-md border border-white/10 px-2.5 text-xs font-semibold text-muted-strong transition-colors hover:border-accent/50 hover:text-accent disabled:cursor-not-allowed disabled:opacity-50"
              >
                {removingId === item.tmdb_id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                ) : (
                  <BookmarkX className="h-3.5 w-3.5" aria-hidden />
                )}
                移除
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
