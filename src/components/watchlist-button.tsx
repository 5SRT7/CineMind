"use client";

import { useEffect, useState } from "react";
import { BookmarkCheck, BookmarkPlus, Loader2 } from "lucide-react";

export function WatchlistButton({ tmdbId }: { tmdbId: number }) {
  const [inWatchlist, setInWatchlist] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/watchlist/status?tmdb_id=${tmdbId}`)
      .then((response) => {
        if (!response.ok) throw new Error("status failed");
        return response.json();
      })
      .then((data) => {
        if (!cancelled) setInWatchlist(Boolean(data.in_watchlist));
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
  }, [tmdbId]);

  async function toggle() {
    if (loading) return;
    setLoading(true);
    setError("");
    try {
      if (inWatchlist) {
        const response = await fetch(`/api/watchlist/${tmdbId}`, {
          method: "DELETE",
        });
        if (!response.ok) throw new Error("remove failed");
      } else {
        const response = await fetch("/api/watchlist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tmdb_id: tmdbId }),
        });
        if (!response.ok) throw new Error("add failed");
      }
      setInWatchlist((current) => !current);
    } catch {
      setError("连接不到数据库");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={toggle}
        disabled={loading}
        className={`flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
          inWatchlist
            ? "border border-accent/50 bg-accent-soft text-accent hover:bg-accent/20"
            : "bg-accent text-white hover:bg-[#8f1515]"
        }`}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        ) : inWatchlist ? (
          <BookmarkCheck className="h-4 w-4" aria-hidden />
        ) : (
          <BookmarkPlus className="h-4 w-4" aria-hidden />
        )}
        {inWatchlist ? "已想看" : "想看"}
      </button>
      {error ? (
        <p className="mt-1 max-w-52 text-xs leading-5 text-accent">{error}</p>
      ) : null}
    </div>
  );
}
