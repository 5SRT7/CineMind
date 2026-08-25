"use client";

import { useMemo, useState } from "react";
import type { MovieSummary } from "@/lib/types";
import { tmdbImageUrl, yearFromDate } from "@/lib/utils";

type MoviePosterProps = {
  movie: Pick<
    MovieSummary,
    "title" | "original_title" | "poster_path" | "release_date" | "genres"
  >;
  priority?: boolean;
  className?: string;
};

export function MoviePoster({
  movie,
  priority = false,
  className = "",
}: MoviePosterProps) {
  const [failed, setFailed] = useState(false);
  const src = tmdbImageUrl(movie.poster_path, "w500");
  const year = yearFromDate(movie.release_date);
  const title = movie.title || movie.original_title;
  const meta = [
    year ? String(year) : null,
    movie.genres?.slice(0, 2).join(" / ") ?? null,
  ]
    .filter(Boolean)
    .join(" · ");

  const fallbackColors = useMemo(() => {
    const palettes = [
      ["#7f1d1d", "#1c1917"],
      ["#1e3a5f", "#0f172a"],
      ["#2f3e46", "#111827"],
      ["#5b2333", "#1a1a1a"],
      ["#3f2d20", "#18181b"],
      ["#1f3d3a", "#0f172a"],
    ];
    const index = Math.abs(
      [...title].reduce((sum, char) => sum + char.charCodeAt(0), 0),
    ) % palettes.length;
    return palettes[index];
  }, [title]);

  return (
    <div
      className={`relative aspect-[2/3] w-full overflow-hidden bg-panel-2 ${className}`}
    >
      {src && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={`${title} 海报`}
          loading={priority ? "eager" : "lazy"}
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <div
          className="poster-fallback"
          style={{
            background: `linear-gradient(160deg, ${fallbackColors[0]} 0%, ${fallbackColors[1]} 78%)`,
          }}
        >
          <div className="poster-fallback-title">{title}</div>
          <div className="poster-fallback-meta">{meta || movie.original_title}</div>
        </div>
      )}
    </div>
  );
}
