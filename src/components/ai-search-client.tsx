"use client";

import {
  FormEvent,
  Suspense,
  useEffect,
  useRef,
  useState,
} from "react";
import { useSearchParams } from "next/navigation";
import {
  ArrowRight,
  Check,
  CircleDot,
  Layers,
  Loader2,
  Plus,
  Search,
  Sparkles,
  Star,
  X,
} from "lucide-react";
import type { AiSearchResult, MovieSummary } from "@/lib/types";
import {
  loadAiSearchState,
  saveAiSearchState,
} from "@/lib/ai-search-storage";
import {
  CERTIFICATION_OPTIONS,
  GENRE_OPTIONS,
  LANGUAGE_OPTIONS,
} from "@/lib/filter-options";
import { FilterChip } from "./filter-chip";
import { MoviePoster } from "./movie-poster";
import { YearRangeSlider } from "./year-range-slider";

const MAX_SELECTED = 5;

function AiSearchClientInner() {
  const searchParams = useSearchParams();
  const restoredRef = useRef(false);
  const [pickerQuery, setPickerQuery] = useState(
    () => searchParams.get("q") ?? "",
  );
  const [searchResults, setSearchResults] = useState<MovieSummary[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<MovieSummary[]>([]);
  const [filterGenres, setFilterGenres] = useState<string[]>([]);
  const [yearMin, setYearMin] = useState<number | null>(null);
  const [yearMax, setYearMax] = useState<number | null>(null);
  const [languages, setLanguages] = useState<string[]>([]);
  const [certifications, setCertifications] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [result, setResult] = useState<AiSearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const persisted = loadAiSearchState();
      if (persisted) {
        setPickerQuery(persisted.pickerQuery ?? "");
        setSearchResults(persisted.searchResults ?? []);
        setSelected(persisted.selected ?? []);
        setFilterGenres(persisted.filterGenres ?? []);
        setYearMin(persisted.yearMin ?? null);
        setYearMax(persisted.yearMax ?? null);
        setLanguages(persisted.languages ?? []);
        setCertifications(persisted.certifications ?? []);
        setNotes(persisted.notes ?? "");
        setResult(persisted.result ?? null);
      }
      restoredRef.current = true;
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!restoredRef.current) return;
    saveAiSearchState({
      pickerQuery,
      searchResults,
      selected,
      filterGenres,
      yearMin,
      yearMax,
      languages,
      certifications,
      notes,
      result,
    });
  }, [
    pickerQuery,
    searchResults,
    selected,
    filterGenres,
    yearMin,
    yearMax,
    languages,
    certifications,
    notes,
    result,
  ]);

  function toggleSelect(movie: MovieSummary) {
    setResult(null);
    setSelected((current) => {
      if (current.some((item) => item.tmdb_id === movie.tmdb_id)) {
        return current.filter((item) => item.tmdb_id !== movie.tmdb_id);
      }
      if (current.length >= MAX_SELECTED) return current;
      return [...current, movie];
    });
  }

  function toggleArrayValue(
    current: string[],
    value: string,
    setter: (next: string[]) => void,
  ) {
    setResult(null);
    if (current.includes(value)) {
      setter(current.filter((item) => item !== value));
    } else {
      setter([...current, value]);
    }
  }

  async function searchMovies(event?: FormEvent) {
    event?.preventDefault();
    const value = pickerQuery.trim();
    if (!value || searching) return;
    setSearching(true);
    setError("");
    try {
      const response = await fetch(
        `/api/movies/search?q=${encodeURIComponent(value)}`,
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "搜索失败");
      setSearchResults(data.results ?? []);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "搜索失败");
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }

  async function runRecommendations(event?: FormEvent) {
    event?.preventDefault();
    if (selected.length === 0 || loading) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const response = await fetch("/api/ai-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          movie_ids: selected.map((movie) => movie.tmdb_id),
          filters: {
            genres: filterGenres,
            year_min: yearMin,
            year_max: yearMax,
            languages,
            certifications,
          },
          notes,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "推荐失败");
      setResult(data);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "推荐失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container-page py-10">
      <div className="mx-auto max-w-3xl">
        <p className="eyebrow mb-2">Similar Movie Finder</p>
        <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
          选择电影，AI 找同类
        </h1>
        <p className="mt-3 text-sm leading-7 text-muted-strong">
          选一部或多部喜欢的电影，AI 会根据它们的共同类型、关键词和氛围推荐更多类似影片。
        </p>

        <form onSubmit={searchMovies} className="mt-7">
          <div className="flex flex-col gap-3 rounded-xl border border-white/15 bg-panel p-3 shadow-2xl shadow-black/40 sm:flex-row sm:items-center">
            <div className="flex min-w-0 flex-1 items-center gap-3 px-2">
              <Search className="h-5 w-5 shrink-0 text-muted" aria-hidden />
              <input
                value={pickerQuery}
                onChange={(event) => setPickerQuery(event.target.value)}
                placeholder="搜索电影，例如：Black Swan"
                className="min-w-0 flex-1 bg-transparent py-2 text-sm text-foreground placeholder:text-muted focus:outline-none"
                aria-label="搜索要选择的电影"
              />
            </div>
            <button
              type="submit"
              disabled={searching || !pickerQuery.trim()}
              className="flex h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-accent px-5 text-sm font-bold text-white transition-colors hover:bg-[#8f1515] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {searching ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                "搜索"
              )}
            </button>
          </div>
        </form>

        {searchResults.length > 0 ? (
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {searchResults.slice(0, 10).map((movie) => {
              const isSelected = selected.some(
                (item) => item.tmdb_id === movie.tmdb_id,
              );
              return (
                <button
                  key={movie.tmdb_id}
                  type="button"
                  onClick={() => toggleSelect(movie)}
                  className={`flex items-center gap-3 rounded-lg border p-2 text-left transition-colors ${
                    isSelected
                      ? "border-accent/60 bg-accent-soft"
                      : "border-line bg-panel hover:border-white/20"
                  }`}
                >
                  <div className="h-16 w-12 shrink-0 overflow-hidden rounded">
                    <MoviePoster movie={movie} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-1 text-sm font-bold">
                      {movie.title || movie.original_title}
                    </p>
                    <p className="mt-1 line-clamp-1 text-xs text-muted">
                      {[movie.release_date?.slice(0, 4), ...movie.genres]
                        .filter(Boolean)
                        .join(" · ") || movie.original_title}
                    </p>
                    <p className="mt-1 text-xs text-amber-400">
                      ★ {movie.vote_average.toFixed(1)}
                    </p>
                  </div>
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                      isSelected
                        ? "bg-accent text-white"
                        : "border border-white/15 text-muted-strong"
                    }`}
                  >
                    {isSelected ? (
                      <Check className="h-4 w-4" aria-hidden />
                    ) : (
                      <Plus className="h-4 w-4" aria-hidden />
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        ) : null}

        {selected.length > 0 ? (
          <div className="mt-6">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-bold text-muted-strong">
                已选择 {selected.length} / {MAX_SELECTED} 部
              </p>
              <button
                type="button"
                onClick={() => {
                  setSelected([]);
                  setFilterGenres([]);
                  setYearMin(null);
                  setYearMax(null);
                  setLanguages([]);
                  setCertifications([]);
                  setNotes("");
                  setResult(null);
                }}
                className="text-xs text-muted transition-colors hover:text-foreground"
              >
                清空
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {selected.map((movie) => (
                <span
                  key={movie.tmdb_id}
                  className="flex items-center gap-2 rounded-md border border-accent/40 bg-accent-soft px-3 py-2 text-sm font-semibold"
                >
                  <Sparkles className="h-3.5 w-3.5 text-accent" aria-hidden />
                  {movie.title || movie.original_title}
                  <button
                    type="button"
                    onClick={() => toggleSelect(movie)}
                    className="rounded p-0.5 text-muted transition-colors hover:text-accent"
                    aria-label={`移除 ${movie.title}`}
                  >
                    <X className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </span>
              ))}
            </div>

            <div className="mt-5 rounded-xl border border-line bg-panel/60 p-4">
              <p className="text-sm font-bold text-muted-strong">
                可选筛选
                <span className="ml-2 text-xs font-normal text-muted">不选则不限</span>
              </p>
              <div className="mt-4 space-y-4">
                <div>
                  <p className="mb-2 text-xs text-muted">类型</p>
                  <div className="flex flex-wrap gap-2">
                    {GENRE_OPTIONS.map((genre) => (
                      <FilterChip
                        key={genre}
                        label={genre}
                        selected={filterGenres.includes(genre)}
                        onClick={() =>
                          toggleArrayValue(filterGenres, genre, setFilterGenres)
                        }
                      />
                    ))}
                  </div>
                </div>
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs text-muted">年份范围</p>
                    <button
                      type="button"
                      onClick={() => {
                        setYearMin(null);
                        setYearMax(null);
                        setResult(null);
                      }}
                      className="text-xs text-muted transition-colors hover:text-foreground"
                    >
                      重置
                    </button>
                  </div>
                  <YearRangeSlider
                    min={yearMin}
                    max={yearMax}
                    onChange={(min, max) => {
                      setYearMin(min);
                      setYearMax(max);
                      setResult(null);
                    }}
                  />
                </div>
                <div>
                  <p className="mb-2 text-xs text-muted">语言</p>
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
                </div>
                <div>
                  <p className="mb-2 text-xs text-muted">分级</p>
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
                </div>
                <div>
                  <p className="mb-2 text-xs text-muted">备注</p>
                  <textarea
                    value={notes}
                    onChange={(event) => {
                      setNotes(event.target.value);
                      setResult(null);
                    }}
                    rows={3}
                    placeholder="例如：喜欢压抑、慢节奏、主角逐渐精神崩溃，结局不要大团圆"
                    className="w-full resize-none rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm leading-6 text-foreground placeholder:text-muted focus:outline-none focus:border-accent/50"
                  />
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={runRecommendations}
              disabled={loading}
              className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-accent px-6 text-sm font-bold text-white transition-colors hover:bg-[#8f1515] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  正在分析共同点…
                </>
              ) : (
                <>
                  基于 {selected.length} 部电影推荐
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </>
              )}
            </button>
          </div>
        ) : null}

        {error ? (
          <div className="mt-6 rounded-lg border border-accent/30 bg-accent-soft p-4 text-sm text-accent">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="mt-8 space-y-3">
            {[
              "获取所选电影信息",
              "分析共同类型与关键词",
              "从 TMDB 获取相似候选",
              "构建语义文档并生成 Embedding",
              "语义检索、混合排序与推荐解释",
            ].map((step, index) => (
              <div
                key={step}
                className="flex items-center gap-3 rounded-lg border border-line bg-panel px-4 py-3 text-sm text-muted-strong"
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent-soft text-accent">
                  {index + 1}
                </span>
                {step}
                <Loader2 className="ml-auto h-4 w-4 animate-spin text-accent" aria-hidden />
              </div>
            ))}
          </div>
        ) : null}
      </div>

      {result ? (
        <div className="mx-auto mt-12 max-w-5xl">
          <div className="mb-6 flex flex-wrap items-center gap-3">
            <p className="text-sm font-bold text-muted-strong">
              {result.results.length} 部推荐电影
            </p>
            <span className="rounded-md border border-white/10 px-2 py-1 text-[11px] text-muted">
              {result.mode === "demo" ? "演示数据模式" : "TMDB 实时模式"}
            </span>
            <span className="rounded-md border border-white/10 px-2 py-1 text-[11px] text-muted">
              {result.vectorStore === "pgvector" ? "pgvector" : "内存向量缓存"}
            </span>
            <span className="rounded-md border border-white/10 px-2 py-1 text-[11px] text-muted">
              模型 {result.provider}
            </span>
            <span className="rounded-md border border-white/10 px-2 py-1 text-[11px] text-muted">
              {result.latencyMs} ms
            </span>
          </div>

          {result.structured ? (
            <div className="mb-8 flex flex-wrap gap-2">
              {[
                ...result.structured.reference_movies.map((item) => `参考 · ${item}`),
                ...result.structured.genres.map((item) => `类型 · ${item}`),
                ...result.structured.styles.map((item) => `风格 · ${item}`),
                ...result.structured.themes.map((item) => `主题 · ${item}`),
                ...result.structured.countries.map((item) => `地区 · ${item}`),
                ...result.structured.languages.map((item) => `语言 · ${item}`),
                ...result.structured.certifications.map((item) => `分级 · ${item}`),
                ...(result.structured.notes
                  ? [`备注 · ${result.structured.notes}`]
                  : []),
              ].map((item) => (
                <span
                  key={item}
                  className="rounded-md bg-white/[0.05] px-2.5 py-1 text-xs font-medium text-muted-strong"
                >
                  {item}
                </span>
              ))}
            </div>
          ) : null}

          <div className="space-y-5">
            {result.results.map((recommendation, index) => {
              const movie = recommendation.movie;
              return (
                <article
                  key={movie.tmdb_id}
                  className="grid gap-5 rounded-xl border border-line bg-panel p-4 sm:grid-cols-[150px_1fr] sm:p-5"
                >
                  <a
                    href={`/movies/${movie.tmdb_id}`}
                    className="mx-auto w-32 overflow-hidden rounded-lg sm:mx-0 sm:w-full"
                  >
                    <MoviePoster movie={movie} priority={index < 2} />
                  </a>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="flex h-8 items-center gap-1.5 rounded-md bg-accent px-2.5 text-sm font-black text-white">
                        <Star className="h-4 w-4 fill-current" aria-hidden />
                        {recommendation.match_percent}%
                      </span>
                      <h2 className="text-lg font-extrabold tracking-tight">
                        {movie.title}
                      </h2>
                      <span className="text-xs text-muted">{movie.original_title}</span>
                    </div>
                    <p className="mt-1 text-xs text-muted">
                      {[movie.release_date?.slice(0, 4), ...movie.genres]
                        .filter(Boolean)
                        .join(" · ")}
                      {" · "}
                      TMDB {movie.vote_average.toFixed(1)}
                    </p>
                    <p className="mt-3 text-sm leading-7 text-muted-strong">
                      {recommendation.reason}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {recommendation.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-md bg-white/[0.05] px-2 py-1 text-[11px] text-muted-strong"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                    <div className="mt-4 grid grid-cols-4 gap-2 border-t border-line pt-3">
                      <ScoreBar label="语义" value={recommendation.semantic_score} />
                      <ScoreBar label="结构" value={recommendation.structured_score} />
                      <ScoreBar label="偏好" value={recommendation.preference_score} />
                      <ScoreBar label="口碑" value={recommendation.quality_score} />
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          {result.trace.length > 0 ? (
            <div className="mt-8 flex flex-wrap items-center gap-2 text-[11px] text-muted">
              <Layers className="h-3.5 w-3.5" aria-hidden />
              {result.trace.map((step, index) => (
                <span key={step} className="flex items-center gap-1.5">
                  {index > 0 ? <CircleDot className="h-2.5 w-2.5" aria-hidden /> : null}
                  {step}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  const percent = Math.round(value * 100);
  return (
    <div className="min-w-0">
      <div className="flex items-center justify-between gap-1 text-[11px] text-muted">
        <span>{label}</span>
        <span>{percent}%</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-accent"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

export function AiSearchClient() {
  return (
    <Suspense
      fallback={
        <div className="container-page py-10 text-sm text-muted">加载中…</div>
      }
    >
      <AiSearchClientInner />
    </Suspense>
  );
}
