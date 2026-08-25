"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Loader2,
  RotateCcw,
  SlidersHorizontal,
} from "lucide-react";
import type { MovieSummary } from "@/lib/types";
import {
  CERTIFICATION_OPTIONS,
  GENRE_OPTIONS,
  LANGUAGE_OPTIONS,
} from "@/lib/filter-options";
import { FilterChip } from "./filter-chip";
import { MovieGrid } from "./movie-grid";
import { YearRangeSlider } from "./year-range-slider";

type BrowseClientProps = {
  initialMovies: MovieSummary[];
  initialPage: number;
  initialTotalPages: number;
  initialMode: "demo" | "tmdb";
  initialFilters: BrowseInitialFilters;
};

export type BrowseInitialFilters = {
  genres: string[];
  yearMin: number | null;
  yearMax: number | null;
  languages: string[];
  certifications: string[];
  minRating: string;
  sortBy: string;
};

export function BrowseClient({
  initialMovies,
  initialPage,
  initialTotalPages,
  initialMode,
  initialFilters,
}: BrowseClientProps) {
  const router = useRouter();
  const [genres, setGenres] = useState<string[]>(initialFilters.genres);
  const [yearMin, setYearMin] = useState<number | null>(initialFilters.yearMin);
  const [yearMax, setYearMax] = useState<number | null>(initialFilters.yearMax);
  const [languages, setLanguages] = useState<string[]>(initialFilters.languages);
  const [certifications, setCertifications] = useState<string[]>(
    initialFilters.certifications,
  );
  const [minRating, setMinRating] = useState(initialFilters.minRating);
  const [sortBy, setSortBy] = useState(initialFilters.sortBy);
  const [movies, setMovies] = useState(initialMovies);
  const [page, setPage] = useState(initialPage);
  const [totalPages, setTotalPages] = useState(initialTotalPages);
  const [mode, setMode] = useState(initialMode);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(true);

  function queryString(targetPage = 1) {
    const params = new URLSearchParams();
    if (genres.length > 0) params.set("genres", genres.join(","));
    if (yearMin) params.set("year_min", String(yearMin));
    if (yearMax) params.set("year_max", String(yearMax));
    if (languages.length > 0) params.set("languages", languages.join(","));
    if (certifications.length > 0) {
      params.set("certifications", certifications.join(","));
    }
    if (minRating) params.set("min_rating", minRating);
    params.set("sort_by", sortBy);
    params.set("page", String(targetPage));
    return params.toString();
  }

  function currentFilterKey() {
    return JSON.stringify({
      genres,
      yearMin,
      yearMax,
      languages,
      certifications,
      minRating,
      sortBy,
    });
  }

  const activeFilterCount =
    genres.length +
    (yearMin ? 1 : 0) +
    (yearMax ? 1 : 0) +
    languages.length +
    certifications.length +
    (minRating ? 1 : 0) +
    (sortBy !== "vote_count.desc" ? 1 : 0);

  const [appliedKey, setAppliedKey] = useState(() =>
    JSON.stringify(initialFilters),
  );

  function toggleArrayValue(
    current: string[],
    value: string,
    setter: (next: string[]) => void,
  ) {
    if (current.includes(value)) {
      setter(current.filter((item) => item !== value));
    } else {
      setter([...current, value]);
    }
  }

  async function applyFilters() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/movies/browse?${queryString(1)}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "筛选失败");
      setMovies(data.results ?? []);
      setPage(data.page ?? 1);
      setTotalPages(data.total_pages ?? 1);
      setMode(data.mode ?? "tmdb");
      setAppliedKey(currentFilterKey());
      setFiltersOpen(false);
      router.replace(`/browse?${queryString(1)}`, { scroll: false });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "筛选失败");
    } finally {
      setLoading(false);
    }
  }

  async function goToPage(targetPage: number) {
    if (loading || targetPage < 1 || targetPage > totalPages) return;
    if (currentFilterKey() !== appliedKey) {
      await applyFilters();
      return;
    }
    setLoading(true);
    setError("");
    try {
      const response = await fetch(
        `/api/movies/browse?${queryString(targetPage)}`,
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "翻页失败");
      setMovies(data.results ?? []);
      setPage(data.page ?? targetPage);
      setTotalPages(data.total_pages ?? totalPages);
      router.replace(`/browse?${queryString(targetPage)}`, { scroll: false });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "翻页失败");
    } finally {
      setLoading(false);
    }
  }

  function resetFilters() {
    setGenres([]);
    setYearMin(null);
    setYearMax(null);
    setLanguages([]);
    setCertifications([]);
    setMinRating("");
    setSortBy("vote_count.desc");
    setFiltersOpen(true);
  }

  return (
    <div className="container-page py-10">
      <div className="mb-8">
        <p className="eyebrow mb-2">Browse Movies</p>
        <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
          浏览电影
        </h1>
        <p className="mt-2 text-sm text-muted-strong">
          按类型、年份、语言、分级和评分慢慢筛选，找到想看的电影。
        </p>
      </div>

      <section className="mb-8 rounded-xl border border-line bg-panel p-4 sm:p-5">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setFiltersOpen((open) => !open)}
            className="flex items-center gap-2 rounded-md py-1 pr-2 transition-colors hover:text-foreground"
          >
            <SlidersHorizontal className="h-4 w-4 text-accent" aria-hidden />
            <p className="text-sm font-bold">筛选条件</p>
            {activeFilterCount > 0 ? (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-[11px] font-bold text-white">
                {activeFilterCount}
              </span>
            ) : null}
            {filtersOpen ? (
              <ChevronUp className="h-4 w-4 text-muted" aria-hidden />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted" aria-hidden />
            )}
          </button>
          <button
            type="button"
            onClick={resetFilters}
            className="ml-auto flex items-center gap-1.5 text-xs text-muted transition-colors hover:text-foreground"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden />
            重置
          </button>
        </div>

        {filtersOpen ? (
          <div className="mt-4">
        <div className="grid gap-5 lg:grid-cols-2">
          <FilterSection label="类型">
            <div className="flex flex-wrap gap-2">
              {GENRE_OPTIONS.map((genre) => (
                <FilterChip
                  key={genre}
                  label={genre}
                  selected={genres.includes(genre)}
                  onClick={() => toggleArrayValue(genres, genre, setGenres)}
                />
              ))}
            </div>
          </FilterSection>

          <FilterSection label="年份">
            <YearRangeSlider
              min={yearMin}
              max={yearMax}
              onChange={(min, max) => {
                setYearMin(min);
                setYearMax(max);
              }}
            />
          </FilterSection>

          <FilterSection label="语言">
            <div className="flex flex-wrap gap-2">
              {LANGUAGE_OPTIONS.map((language) => (
                <FilterChip
                  key={language.value}
                  label={language.label}
                  selected={languages.includes(language.value)}
                  onClick={() =>
                    toggleArrayValue(languages, language.value, setLanguages)
                  }
                />
              ))}
            </div>
          </FilterSection>

          <FilterSection label="分级">
            <div className="flex flex-wrap gap-2">
              {CERTIFICATION_OPTIONS.map((certification) => (
                <FilterChip
                  key={certification}
                  label={certification}
                  selected={certifications.includes(certification)}
                  onClick={() =>
                    toggleArrayValue(
                      certifications,
                      certification,
                      setCertifications,
                    )
                  }
                />
              ))}
            </div>
          </FilterSection>

          <FilterSection label="最低评分">
            <select
              value={minRating}
              onChange={(event) => setMinRating(event.target.value)}
              className="h-10 w-full rounded-md border border-line bg-[#1c1113] px-3 text-sm text-foreground focus:outline-none focus:border-accent/60"
            >
              <option value="">不限</option>
              <option value="6">6 分以上</option>
              <option value="7">7 分以上</option>
              <option value="8">8 分以上</option>
              <option value="9">9 分以上</option>
            </select>
          </FilterSection>

          <FilterSection label="排序">
            <select
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value)}
              className="h-10 w-full rounded-md border border-line bg-[#1c1113] px-3 text-sm text-foreground focus:outline-none focus:border-accent/60"
            >
              <option value="popularity.desc">综合排序</option>
              <option value="vote_count.desc">热门优先</option>
              <option value="vote_average.desc">评分优先</option>
              <option value="release_date.desc">最新优先</option>
              <option value="release_date.asc">最早优先</option>
            </select>
          </FilterSection>
        </div>

        <button
          type="button"
          onClick={applyFilters}
          disabled={loading}
          className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-accent px-6 text-sm font-bold text-white transition-colors hover:bg-[#8f1515] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              正在筛选…
            </>
          ) : (
            "应用筛选"
          )}
        </button>
          </div>
        ) : null}
      </section>

      {error ? (
        <div className="mb-6 rounded-lg border border-accent/30 bg-accent-soft p-4 text-sm text-accent">
          {error}
        </div>
      ) : null}

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <p className="text-sm font-bold text-muted-strong">
          共 {movies.length} 部
        </p>
        <span className="rounded-md border border-white/10 px-2 py-1 text-[11px] text-muted">
          {mode === "demo" ? "演示数据模式" : "TMDB 实时模式"}
        </span>
      </div>

      {movies.length > 0 ? (
        <MovieGrid movies={movies} priorityStart={6} />
      ) : (
        <div className="rounded-xl border border-line py-16 text-center text-sm text-muted">
          没有符合条件的电影，试试放宽筛选条件。
        </div>
      )}
      {totalPages > 1 ? (
        <Pagination
          page={page}
          totalPages={totalPages}
          loading={loading}
          onPageChange={goToPage}
        />
      ) : null}
    </div>
  );
}

function FilterSection({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-2 text-xs text-muted">{label}</p>
      {children}
    </div>
  );
}

function getPageNumbers(current: number, total: number) {
  if (total <= 7) {
    return Array.from({ length: total }, (_, index) => index + 1);
  }
  const candidates = [
    1,
    current - 1,
    current,
    current + 1,
    total,
  ].filter((page) => page >= 1 && page <= total);
  const unique = [...new Set(candidates)].sort((a, b) => a - b);
  const pages: Array<number | "..."> = [];
  let previous = 0;
  for (const page of unique) {
    if (page - previous > 1) pages.push("...");
    pages.push(page);
    previous = page;
  }
  return pages;
}

function Pagination({
  page,
  totalPages,
  loading,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  loading: boolean;
  onPageChange: (page: number) => void;
}) {
  const pages = getPageNumbers(page, totalPages);
  return (
    <div className="mt-10 flex flex-wrap items-center justify-center gap-2">
      <button
        type="button"
        onClick={() => onPageChange(page - 1)}
        disabled={loading || page <= 1}
        className="flex h-9 items-center gap-1 rounded-md border border-white/10 bg-white/[0.05] px-3 text-xs font-semibold transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden />
        上一页
      </button>
      {pages.map((item, index) =>
        item === "..." ? (
          <span key={`ellipsis-${index}`} className="px-1 text-muted">
            …
          </span>
        ) : (
          <button
            key={item}
            type="button"
            onClick={() => onPageChange(item)}
            disabled={loading || item === page}
            className={`flex h-9 min-w-9 items-center justify-center rounded-md px-2 text-xs font-bold transition-colors disabled:cursor-not-allowed ${
              item === page
                ? "bg-accent text-white"
                : "border border-white/10 bg-white/[0.05] text-muted-strong hover:bg-white/10"
            }`}
          >
            {item}
          </button>
        ),
      )}
      <button
        type="button"
        onClick={() => onPageChange(page + 1)}
        disabled={loading || page >= totalPages}
        className="flex h-9 items-center gap-1 rounded-md border border-white/10 bg-white/[0.05] px-3 text-xs font-semibold transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
      >
        下一页
        <ChevronRight className="h-4 w-4" aria-hidden />
      </button>
      <span className="ml-2 text-xs text-muted">
        第 {page} / {totalPages} 页
      </span>
    </div>
  );
}
