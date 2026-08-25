import Link from "next/link";
import { Star } from "lucide-react";
import type { MovieSummary } from "@/lib/types";
import { yearFromDate } from "@/lib/utils";
import { MoviePoster } from "./movie-poster";

export function MovieCard({
  movie,
  priority = false,
}: {
  movie: MovieSummary;
  priority?: boolean;
}) {
  const year = yearFromDate(movie.release_date);
  return (
    <Link
      href={`/movies/${movie.tmdb_id}`}
      className="group relative block rounded-lg transition-all duration-300 ease-out will-change-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent hover:z-20 hover:-translate-y-3 hover:rotate-[1.5deg] hover:scale-[1.04] hover:shadow-[0_24px_60px_-18px_rgba(185,28,28,0.6)]"
    >
      <div className="relative overflow-hidden rounded-lg transition-transform duration-300 ease-out">
        <MoviePoster movie={movie} priority={priority} />
        <div className="absolute inset-0 rounded-lg bg-gradient-to-t from-black/90 via-black/10 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
        <div className="pointer-events-none absolute inset-0 rounded-lg bg-gradient-to-br from-white/10 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
        <span className="absolute left-2.5 top-2.5 flex h-7 items-center gap-1 rounded-md bg-black/70 px-2 text-xs font-bold text-amber-400 backdrop-blur">
          <Star className="h-3.5 w-3.5 fill-current" aria-hidden />
          {movie.vote_average.toFixed(1)}
        </span>
      </div>
      <div className="pt-3">
        <h3 className="line-clamp-1 text-sm font-bold text-foreground">
          {movie.title || movie.original_title}
        </h3>
        <p className="mt-1 line-clamp-1 text-xs text-muted">
          {[year, movie.genres?.slice(0, 2).join(" / ")]
            .filter(Boolean)
            .join(" · ") || movie.original_title}
        </p>
      </div>
    </Link>
  );
}
