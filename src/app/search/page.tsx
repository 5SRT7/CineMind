import type { Metadata } from "next";
import { SearchX } from "lucide-react";
import { MovieCard } from "@/components/movie-card";
import { isDemoMode, searchMovies } from "@/lib/tmdb";
import type { MovieSummary } from "@/lib/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "电影搜索",
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const query = q.trim();
  let movies: MovieSummary[] = [];
  let error = "";

  if (query) {
    try {
      movies = await searchMovies(query);
    } catch {
      error = "搜索失败，请稍后重试";
    }
  }

  return (
    <div className="container-page py-10">
      <div className="mb-8">
        <p className="eyebrow mb-2">Movie Search</p>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
          “{query || "未输入关键词"}”的搜索结果
        </h1>
        <p className="mt-2 text-xs text-muted">
          {isDemoMode() ? "演示数据模式" : "TMDB 实时数据"}
        </p>
      </div>

      {error ? (
        <div className="flex items-center gap-2 text-sm text-accent">{error}</div>
      ) : null}

      {!error && movies.length > 0 ? (
        <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {movies.map((movie, index) => (
            <MovieCard key={movie.tmdb_id} movie={movie} priority={index < 6} />
          ))}
        </div>
      ) : null}

      {!error && movies.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-line py-16 text-center">
          <SearchX className="mb-3 h-8 w-8 text-muted" aria-hidden />
          <p className="text-sm text-muted">没有找到相关电影，换个关键词试试。</p>
        </div>
      ) : null}
    </div>
  );
}
