import type { MovieSummary } from "@/lib/types";
import { MovieCard } from "./movie-card";

export function MovieGrid({
  movies,
  priorityStart = 0,
}: {
  movies: MovieSummary[];
  priorityStart?: number;
}) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {movies.map((movie, index) => (
        <MovieCard
          key={movie.tmdb_id}
          movie={movie}
          priority={index < priorityStart}
        />
      ))}
    </div>
  );
}
