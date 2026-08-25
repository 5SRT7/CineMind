/* eslint-disable @typescript-eslint/no-explicit-any */
import { ProxyAgent, type Dispatcher } from "undici";
import {
  getDemoMovie,
  searchDemoMovies,
  DEMO_MOVIES,
} from "./demo-data";
import type {
  CastMember,
  HomeSections,
  MovieDetails,
  MovieSummary,
  MovieVideo,
  StructuredQuery,
} from "./types";
import { termAliases } from "./ai/query-understanding";
import { clamp } from "./utils";

const DEFAULT_TMDB_BASES = [
  "https://api.themoviedb.org/3",
  "https://api.tmdb.org/3",
];

type TmdbJson = Record<string, any>;
let proxyDispatcher: Dispatcher | null = null;
let tmdbUnavailableUntil = 0;
let tmdbActiveBase: string | null = null;

const TMDB_GENRE_NAMES: Record<number, string> = {
  28: "动作",
  12: "冒险",
  16: "动画",
  35: "喜剧",
  80: "犯罪",
  99: "纪录",
  18: "剧情",
  10751: "家庭",
  14: "奇幻",
  36: "历史",
  27: "恐怖",
  10402: "音乐",
  9648: "悬疑",
  10749: "爱情",
  878: "科幻",
  10770: "电视电影",
  53: "惊悚",
  10752: "战争",
  37: "西部",
};

export function isDemoMode() {
  return !process.env.TMDB_API_KEY && !process.env.TMDB_ACCESS_TOKEN;
}

function getProxyDispatcher() {
  const proxy =
    process.env.TMDB_PROXY ||
    process.env.HTTPS_PROXY ||
    process.env.https_proxy ||
    process.env.ALL_PROXY ||
    process.env.all_proxy;
  if (!proxy) return undefined;
  if (!proxyDispatcher) {
    proxyDispatcher = new ProxyAgent(proxy);
  }
  return proxyDispatcher;
}

function getTmdbBases() {
  const override = process.env.TMDB_API_BASE_URL;
  if (override) return [override];
  if (tmdbActiveBase) {
    return [
      tmdbActiveBase,
      ...DEFAULT_TMDB_BASES.filter((base) => base !== tmdbActiveBase),
    ];
  }
  return [...DEFAULT_TMDB_BASES];
}

function isNetworkError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /fetch failed|timed out|timeout|ENOTFOUND|ECONNREFUSED|ETIMEDOUT|socket hang up|temporarily unavailable/i.test(
    message,
  );
}

async function tmdbFetch<T>(path: string, params: Record<string, string | number> = {}): Promise<T> {
  if (Date.now() < tmdbUnavailableUntil) {
    throw new Error("TMDB temporarily unavailable (circuit open)");
  }
  const apiKey = process.env.TMDB_API_KEY;
  const accessToken = process.env.TMDB_ACCESS_TOKEN;
  const query = new URLSearchParams({
    language: process.env.TMDB_LANGUAGE || "zh-CN",
    ...Object.fromEntries(
      Object.entries(params).map(([key, value]) => [key, String(value)]),
    ),
  });

  const headers: Record<string, string> = {
    accept: "application/json",
  };
  if (accessToken) {
    headers.authorization = `Bearer ${accessToken}`;
  } else if (apiKey) {
    query.set("api_key", apiKey);
  }

  const fetchOptions: RequestInit & { dispatcher?: Dispatcher } = {
    headers,
    cache: "no-store",
  };
  const dispatcher = getProxyDispatcher();
  if (dispatcher) fetchOptions.dispatcher = dispatcher;

  let lastError: unknown;
  let networkFailure = false;
  for (const base of getTmdbBases()) {
    try {
      const response = await fetch(`${base}${path}?${query}`, {
        ...fetchOptions,
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) {
        throw new Error(`TMDB request failed: ${response.status} ${path} (${base})`);
      }
      tmdbActiveBase = base;
      tmdbUnavailableUntil = 0;
      return (await response.json()) as T;
    } catch (error) {
      lastError = error;
      if (isNetworkError(error)) networkFailure = true;
    }
  }
  if (networkFailure) tmdbUnavailableUntil = Date.now() + 60_000;
  throw lastError;
}

function normalizeSummary(raw: TmdbJson): MovieSummary {
  const genres = Array.isArray(raw.genres)
    ? raw.genres.map((genre: TmdbJson) => genre.name ?? genre).filter(Boolean)
    : Array.isArray(raw.genre_ids)
      ? raw.genre_ids
          .map((id: number) => TMDB_GENRE_NAMES[Number(id)] ?? String(id))
          .filter(Boolean)
      : [];
  return {
    tmdb_id: Number(raw.id),
    title: raw.title || raw.name || "未知片名",
    original_title: raw.original_title || raw.title || "Unknown",
    poster_path: raw.poster_path ?? null,
    backdrop_path: raw.backdrop_path ?? null,
    release_date: raw.release_date ?? null,
    vote_average: Number(raw.vote_average || 0),
    vote_count: Number(raw.vote_count || 0),
    genres,
    overview: raw.overview || "",
    original_language: raw.original_language ?? null,
    popularity: Number(raw.popularity || 0),
  };
}

function normalizeCast(raw: TmdbJson): CastMember[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((person: TmdbJson) => ({
      id: Number(person.id),
      name: person.name || person.original_name || "未知",
      character: person.character ?? null,
      profile_path: person.profile_path ?? null,
      order: Number(person.order || 0),
    }))
    .sort((a, b) => a.order - b.order)
    .slice(0, 12);
}

function crewNames(raw: TmdbJson, jobs: string[]) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((person: TmdbJson) => jobs.includes(person.job))
    .map((person: TmdbJson) => person.name || person.original_name)
    .filter(Boolean);
}

function findCertification(releaseDates: TmdbJson) {
  if (!releaseDates?.results) return { certification: null, country: null };
  const preferred = releaseDates.results.find(
    (entry: TmdbJson) => entry.iso_3166_1 === "US",
  );
  const source = preferred || releaseDates.results[0];
  const release = source?.release_dates?.find(
    (item: TmdbJson) => item.certification,
  );
  return {
    certification: release?.certification ?? null,
    country: source?.iso_3166_1 ?? null,
  };
}

const certificationCache = new Map<number, string | null>();

async function getMovieCertification(tmdbId: number) {
  if (certificationCache.has(tmdbId)) return certificationCache.get(tmdbId) ?? null;
  try {
    const releaseDates = await tmdbFetch<TmdbJson>(`/movie/${tmdbId}/release_dates`);
    const certification = findCertification(releaseDates).certification;
    certificationCache.set(tmdbId, certification);
    return certification;
  } catch (error) {
    console.error(`failed to fetch certification for ${tmdbId}`, error);
    certificationCache.set(tmdbId, null);
    return null;
  }
}

async function filterMoviesByCertification(
  movies: MovieSummary[],
  certificationFilters: string[],
) {
  const withCertifications = await mapWithConcurrency(
    movies,
    async (movie) => ({
      movie,
      certification: await getMovieCertification(movie.tmdb_id),
    }),
  );
  return withCertifications
    .filter(({ certification: actual }) =>
      certificationFilters.includes((actual ?? "").toLowerCase()),
    )
    .map(({ movie }) => movie);
}

async function mapWithConcurrency<T, R>(
  items: T[],
  worker: (item: T) => Promise<R>,
  concurrency = 6,
) {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  async function run() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, run));
  return results;
}

function normalizeVideos(raw: TmdbJson): MovieVideo[] {
  if (!Array.isArray(raw?.results)) return [];
  return raw.results
    .filter((video: TmdbJson) => video.site === "YouTube")
    .filter((video: TmdbJson) =>
      ["Trailer", "Teaser", "Featurette"].includes(video.type),
    )
    .map((video: TmdbJson) => ({
      name: video.name || video.type,
      key: video.key,
      site: video.site,
      type: video.type,
    }))
    .slice(0, 4);
}

function normalizeDetails(raw: TmdbJson): MovieDetails {
  const certification = findCertification(raw.release_dates);
  const keywords = Array.isArray(raw.keywords?.keywords)
    ? raw.keywords.keywords.map((keyword: TmdbJson) => keyword.name).filter(Boolean)
    : [];
  const productionCountries = Array.isArray(raw.production_countries)
    ? raw.production_countries.map((country: TmdbJson) => country.name).filter(Boolean)
    : [];
  const similar = Array.isArray(raw.similar?.results)
    ? raw.similar.results.slice(0, 12).map(normalizeSummary)
    : [];
  return {
    ...normalizeSummary(raw),
    runtime: raw.runtime ?? null,
    certification: certification.certification,
    certification_country: certification.country,
    director: crewNames(raw.credits?.crew, ["Director"]),
    writers: crewNames(raw.credits?.crew, ["Screenplay", "Writer", "Novel"]),
    cast: normalizeCast(raw.credits?.cast),
    keywords,
    videos: normalizeVideos(raw.videos),
    imdb_id: raw.imdb_id ?? null,
    production_countries: productionCountries,
    status: raw.status ?? null,
    ai_tags: [],
    similar,
  };
}

export async function searchMovies(query: string): Promise<MovieSummary[]> {
  if (isDemoMode()) {
    return searchDemoMovies(query).map((movie) => movie).slice(0, 20);
  }
  try {
    const response = await tmdbFetch<TmdbJson>("/search/movie", {
      query,
      include_adult: "false",
    });
    return ((response.results ?? []) as TmdbJson[])
      .slice(0, 20)
      .map(normalizeSummary);
  } catch (error) {
    console.error("TMDB search failed, falling back to demo data", error);
    return searchDemoMovies(query).map((movie) => movie).slice(0, 20);
  }
}

export async function getMovieDetails(tmdbId: number | string): Promise<MovieDetails | null> {
  if (isDemoMode()) {
    return getDemoMovie(Number(tmdbId));
  }
  const id = String(tmdbId);
  try {
    const [details, credits, keywords, releaseDates, videos, similar] =
      await Promise.all([
        tmdbFetch<TmdbJson>(`/movie/${id}`),
        tmdbFetch<TmdbJson>(`/movie/${id}/credits`),
        tmdbFetch<TmdbJson>(`/movie/${id}/keywords`),
        tmdbFetch<TmdbJson>(`/movie/${id}/release_dates`),
        tmdbFetch<TmdbJson>(`/movie/${id}/videos`),
        tmdbFetch<TmdbJson>(`/movie/${id}/similar`),
      ]);
    return normalizeDetails({
      ...details,
      credits,
      keywords,
      release_dates: releaseDates,
      videos,
      similar,
    });
  } catch (error) {
    console.error("getMovieDetails failed", error);
    const demo = getDemoMovie(Number(tmdbId));
    if (demo) return demo;
    return null;
  }
}

function demoHomeSections(): HomeSections {
  const popular = [...DEMO_MOVIES]
    .sort((a, b) => b.popularity - a.popularity)
    .map((movie) => movie);
  const topRated = [...DEMO_MOVIES]
    .sort((a, b) => b.vote_average - a.vote_average)
    .map((movie) => movie);
  const nowPlaying = [...DEMO_MOVIES]
    .sort((a, b) => (b.release_date ?? "").localeCompare(a.release_date ?? ""))
    .map((movie) => movie);
  return { popular, topRated, nowPlaying, mode: "demo" };
}

export async function getHomeSections(): Promise<HomeSections> {
  if (isDemoMode()) {
    return demoHomeSections();
  }

  try {
    const [popularResponse, topRatedResponse, nowPlayingResponse] = await Promise.all([
      tmdbFetch<TmdbJson>("/movie/popular", { page: 1 }),
      tmdbFetch<TmdbJson>("/movie/top_rated", { page: 1 }),
      tmdbFetch<TmdbJson>("/movie/now_playing", { page: 1 }),
    ]);
    return {
      popular: ((popularResponse.results ?? []) as TmdbJson[])
        .slice(0, 20)
        .map(normalizeSummary),
      topRated: ((topRatedResponse.results ?? []) as TmdbJson[])
        .slice(0, 20)
        .map(normalizeSummary),
      nowPlaying: ((nowPlayingResponse.results ?? []) as TmdbJson[])
        .slice(0, 20)
        .map(normalizeSummary),
      mode: "tmdb",
    };
  } catch (error) {
    console.error("TMDB home sections failed, falling back to demo data", error);
    return demoHomeSections();
  }
}

export type BrowseMoviesParams = {
  genres?: string[];
  year_min?: number | null;
  year_max?: number | null;
  languages?: string[];
  certifications?: string[];
  min_rating?: number | null;
  sort_by?: string;
  page?: number;
};

export type BrowseMoviesResult = {
  results: MovieSummary[];
  page: number;
  total_pages: number;
  total_results: number;
  mode: "demo" | "tmdb";
};

function sortDemoBrowse(
  movies: MovieSummary[],
  sortBy: string | undefined,
) {
  const sorted = [...movies];
  if (sortBy === "vote_average.desc") {
    return sorted.sort((a, b) => b.vote_average - a.vote_average);
  }
  if (sortBy === "release_date.desc") {
    return sorted.sort((a, b) =>
      (b.release_date ?? "").localeCompare(a.release_date ?? ""),
    );
  }
  if (sortBy === "release_date.asc") {
    return sorted.sort((a, b) =>
      (a.release_date ?? "").localeCompare(b.release_date ?? ""),
    );
  }
  return sorted.sort((a, b) => b.vote_count - a.vote_count);
}

function browseDemoMovies(params: BrowseMoviesParams): BrowseMoviesResult {
  const page = Math.max(1, params.page ?? 1);
  const genreFilters = (params.genres ?? []).map((genre) => genre.toLowerCase());
  const languageFilters = (params.languages ?? []).map((language) =>
    language.toLowerCase(),
  );
  const certificationFilters = (params.certifications ?? []).map((item) =>
    item.toLowerCase(),
  );
  let movies: MovieSummary[] = DEMO_MOVIES.filter((movie) => {
    if (
      genreFilters.length > 0 &&
      !movie.genres.some((genre) =>
        genreFilters.some((filter) =>
          genre.toLowerCase().includes(filter) ||
          filter.includes(genre.toLowerCase()),
        ),
      )
    ) {
      return false;
    }
    const year = Number((movie.release_date ?? "").slice(0, 4));
    if (params.year_min && year && year < params.year_min) return false;
    if (params.year_max && year && year > params.year_max) return false;
    if (
      languageFilters.length > 0 &&
      !languageFilters.includes((movie.original_language ?? "").toLowerCase())
    ) {
      return false;
    }
    if (
      certificationFilters.length > 0 &&
      !certificationFilters.includes((movie.certification ?? "").toLowerCase())
    ) {
      return false;
    }
    if (params.min_rating && movie.vote_average < params.min_rating) return false;
    return true;
  });
  movies = sortDemoBrowse(movies, params.sort_by);
  const pageSize = 25;
  const total_results = movies.length;
  const total_pages = Math.max(1, Math.ceil(total_results / pageSize));
  return {
    results: movies.slice((page - 1) * pageSize, page * pageSize),
    page,
    total_pages,
    total_results,
    mode: "demo",
  };
}

export async function browseMovies(
  params: BrowseMoviesParams,
): Promise<BrowseMoviesResult> {
  const page = Math.max(1, params.page ?? 1);
  if (isDemoMode()) {
    return browseDemoMovies(params);
  }

  const query: Record<string, string | number> = {
    include_adult: "false",
    page,
    sort_by: params.sort_by || "vote_count.desc",
  };
  const genreIds = mapGenres(params.genres ?? []);
  if (genreIds.length > 0) query.with_genres = genreIds.join(",");
  if (params.year_min) query["primary_release_date.gte"] = `${params.year_min}-01-01`;
  if (params.year_max) query["primary_release_date.lte"] = `${params.year_max}-12-31`;
  if ((params.languages ?? []).length > 0) {
    query.with_original_language = (params.languages ?? []).join("|");
  }
  const certificationFilters = (params.certifications ?? []).map((item) =>
    item.toLowerCase(),
  );
  if (
    certificationFilters.length > 0 &&
    certificationFilters[0] !== "r"
  ) {
    query.certification_country = "US";
    query.certification = certificationFilters[0].toUpperCase();
  }
  if (params.min_rating) query["vote_average.gte"] = params.min_rating;

  const APP_PAGE_SIZE = 25;
  const TMDB_PAGE_SIZE = 20;

  try {
    if (certificationFilters.length > 0) {
      const collected: MovieSummary[] = [];
      const seen = new Set<number>();
      const offset = (page - 1) * APP_PAGE_SIZE;
      const target = offset + APP_PAGE_SIZE;
      let totalResults = 0;
      for (let tmdbPage = 1; tmdbPage <= 40 && collected.length < target; tmdbPage += 1) {
        const response = await tmdbFetch<TmdbJson>("/discover/movie", {
          ...query,
          page: tmdbPage,
        });
        totalResults = Number(response.total_results || 0);
        const pageMovies = await filterMoviesByCertification(
          ((response.results ?? []) as TmdbJson[]).map(normalizeSummary),
          certificationFilters,
        );
        for (const movie of pageMovies) {
          if (seen.has(movie.tmdb_id)) continue;
          seen.add(movie.tmdb_id);
          collected.push(movie);
        }
        if (((response.results ?? []) as TmdbJson[]).length === 0) break;
      }
      return {
        results: collected.slice(offset, target),
        page,
        total_pages: Math.max(1, Math.ceil(totalResults / APP_PAGE_SIZE)),
        total_results: totalResults,
        mode: "tmdb",
      };
    }

    const startTmdbPage =
      Math.floor(((page - 1) * APP_PAGE_SIZE) / TMDB_PAGE_SIZE) + 1;
    const collected: MovieSummary[] = [];
    let totalResults = 0;
    for (
      let tmdbPage = startTmdbPage;
      tmdbPage < startTmdbPage + 2;
      tmdbPage += 1
    ) {
      const response = await tmdbFetch<TmdbJson>("/discover/movie", {
        ...query,
        page: tmdbPage,
      });
      totalResults = Number(response.total_results || 0);
      collected.push(
        ...((response.results ?? []) as TmdbJson[]).map(normalizeSummary),
      );
      if (((response.results ?? []) as TmdbJson[]).length === 0) break;
    }
    const offsetInWindow = ((page - 1) * APP_PAGE_SIZE) % TMDB_PAGE_SIZE;
    const results = collected.slice(
      offsetInWindow,
      offsetInWindow + APP_PAGE_SIZE,
    );
    return {
      results,
      page,
      total_pages: Math.max(1, Math.ceil(totalResults / APP_PAGE_SIZE)),
      total_results: totalResults,
      mode: "tmdb",
    };
  } catch (error) {
    console.error("TMDB browse failed, falling back to demo data", error);
    return browseDemoMovies(params);
  }
}

const GENRE_IDS: Record<string, number> = {
  action: 28,
  adventure: 12,
  animation: 16,
  comedy: 35,
  crime: 80,
  documentary: 99,
  drama: 18,
  family: 10751,
  fantasy: 14,
  history: 36,
  horror: 27,
  music: 10402,
  mystery: 9648,
  romance: 10749,
  "science fiction": 878,
  scifi: 878,
  "tv movie": 10770,
  thriller: 53,
  war: 10752,
  western: 37,
  动作: 28,
  冒险: 12,
  动画: 16,
  喜剧: 35,
  犯罪: 80,
  纪录: 99,
  剧情: 18,
  家庭: 10751,
  奇幻: 14,
  历史: 36,
  恐怖: 27,
  音乐: 10402,
  悬疑: 9648,
  爱情: 10749,
  科幻: 878,
  惊悚: 53,
  战争: 10752,
  西部: 37,
};

function mapGenres(genres: string[]) {
  const ids = genres
    .map((genre) => GENRE_IDS[genre.toLowerCase()] ?? GENRE_IDS[genre])
    .filter((id): id is number => Boolean(id));
  return [...new Set(ids)];
}

async function resolveReferenceMovies(referenceTitles: string[]) {
  const results: MovieSummary[] = [];
  for (const title of referenceTitles) {
    if (!title.trim()) continue;
    try {
      const response = await tmdbFetch<TmdbJson>("/search/movie", {
        query: title,
        language: "en-US",
        include_adult: "false",
      });
      const first = response.results?.[0];
      if (first) results.push(normalizeSummary(first));
    } catch {
      // A reference movie that cannot be resolved should not break the search.
    }
  }
  return results;
}

async function resolveReferenceMovieIds(referenceIds: number[]) {
  const results = await Promise.all(
    referenceIds.map(async (tmdbId) => {
      try {
        const raw = await tmdbFetch<TmdbJson>(`/movie/${tmdbId}`);
        return normalizeSummary(raw);
      } catch (error) {
        console.error(`failed to resolve reference movie ${tmdbId}`, error);
        return null;
      }
    }),
  );
  return results.filter((movie): movie is MovieSummary => Boolean(movie));
}

async function fetchReferenceSimilarMovies(
  referenceMovies: MovieSummary[],
  limit: number,
  structured: StructuredQuery,
) {
  const referenceIds = new Set(referenceMovies.map((movie) => movie.tmdb_id));
  const filterGenres = structured.filter_genres.map((genre) => genre.toLowerCase());
  const languageFilters = structured.languages.map((language) => language.toLowerCase());
  const unique = new Map<number, MovieSummary>();
  for (const reference of referenceMovies) {
    try {
      const [similarResponse, recommendationsResponse] = await Promise.all([
        tmdbFetch<TmdbJson>(`/movie/${reference.tmdb_id}/similar`, {
          language: process.env.TMDB_LANGUAGE || "zh-CN",
        }),
        tmdbFetch<TmdbJson>(`/movie/${reference.tmdb_id}/recommendations`, {
          language: process.env.TMDB_LANGUAGE || "zh-CN",
        }),
      ]);
      const candidates = [
        ...((similarResponse.results ?? []) as TmdbJson[]),
        ...((recommendationsResponse.results ?? []) as TmdbJson[]),
      ];
      for (const raw of candidates) {
        const movie = normalizeSummary(raw);
        if (referenceIds.has(movie.tmdb_id) || unique.has(movie.tmdb_id)) continue;
        const year = Number((movie.release_date ?? "").slice(0, 4));
        if (structured.year_min && year && year < structured.year_min) continue;
        if (structured.year_max && year && year > structured.year_max) continue;
        if (
          languageFilters.length > 0 &&
          !languageFilters.includes((movie.original_language ?? "").toLowerCase())
        ) {
          continue;
        }
        if (
          filterGenres.length > 0 &&
          !movie.genres.some((genre) =>
            filterGenres.some((filter) =>
              genre.toLowerCase().includes(filter) ||
              filter.includes(genre.toLowerCase()),
            ),
          )
        ) {
          continue;
        }
        unique.set(movie.tmdb_id, movie);
      }
    } catch (error) {
      console.error("failed to fetch reference similar movies", error);
    }
  }
  return [...unique.values()].slice(0, limit);
}

function filterDemoCandidates(structured: StructuredQuery, limit: number) {
  const queryText = structured.free_text.toLowerCase();
  const genreSet = structured.genres.map((genre) => genre.toLowerCase());
  const countrySet = structured.countries.map((country) => country.toLowerCase());
  const languageSet = structured.languages.map((language) => language.toLowerCase());

  const scored = DEMO_MOVIES.map((movie) => {
    const haystack = [
      movie.title,
      movie.original_title,
      movie.overview,
      ...movie.genres,
      ...movie.keywords,
      ...movie.ai_tags,
    ]
      .join(" ")
      .toLowerCase();
    let score = queryText ? (haystack.includes(queryText) ? 2 : 0) : 0.5;
    for (const token of structured.moods.concat(structured.styles, structured.themes)) {
      if (
        termAliases(token).some((alias) => haystack.includes(alias.toLowerCase()))
      ) {
        score += 1;
      }
    }
    const genreHit = movie.genres.some((genre) =>
      genreSet.some((target) => genre.toLowerCase().includes(target)),
    );
    if (genreHit) score += 3;
    const countryHit = (movie.production_countries as string[]).some((country) =>
      countrySet.some((target) => country.toLowerCase().includes(target)),
    );
    if (countryHit) score += 2;
    const languageHit = languageSet.some((language) =>
      (movie.original_language ?? "").includes(language),
    );
    if (languageHit) score += 2;
    const year = Number((movie.release_date ?? "").slice(0, 4));
    if (structured.year_min && year && year >= structured.year_min) score += 1;
    if (structured.year_max && year && year <= structured.year_max) score += 1;
    return { movie, score };
  })
    .filter((item) => item.score > 0)
    .filter(
      ({ movie }) =>
        !structured.reference_movies.some((title) =>
          [movie.title, movie.original_title].some((name) =>
            name.toLowerCase().includes(title.toLowerCase()),
          ),
        ),
    )
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  if (scored.length > 0) return scored.map((item) => item.movie);
  return DEMO_MOVIES.sort((a, b) => b.popularity - a.popularity)
    .filter(
      (movie) =>
        !structured.reference_movies.some((title) =>
          [movie.title, movie.original_title].some((name) =>
            name.toLowerCase().includes(title.toLowerCase()),
          ),
        ),
    )
    .slice(0, limit)
    .map((movie) => movie);
}

function getDiscoverYearRanges(structured: StructuredQuery) {
  if (structured.year_min || structured.year_max) {
    return [
      {
        gte: structured.year_min
          ? `${structured.year_min}-01-01`
          : undefined,
        lte: structured.year_max
          ? `${structured.year_max}-12-31`
          : undefined,
      },
    ];
  }
  const currentYear = new Date().getFullYear();
  return [
    { gte: "1970-01-01", lte: "1979-12-31" },
    { gte: "1980-01-01", lte: "1989-12-31" },
    { gte: "1990-01-01", lte: "1999-12-31" },
    { gte: "2000-01-01", lte: "2009-12-31" },
    { gte: "2010-01-01", lte: "2019-12-31" },
    { gte: "2020-01-01", lte: `${currentYear}-12-31` },
  ];
}

export async function getCandidateMovies(
  structured: StructuredQuery,
  limit = 12,
): Promise<MovieSummary[]> {
  if (isDemoMode()) {
    return filterDemoCandidates(structured, limit);
  }

  const referenceMovies =
    structured.reference_ids?.length > 0
      ? await resolveReferenceMovieIds(structured.reference_ids)
      : await resolveReferenceMovies(structured.reference_movies);
  const referenceIds = referenceMovies.map((movie) => movie.tmdb_id);
  const referenceSimilar = await fetchReferenceSimilarMovies(
    referenceMovies,
    limit,
    structured,
  );
  if (referenceSimilar.length >= limit) return referenceSimilar;
  const results: MovieSummary[] = [...referenceSimilar];
  const seenIds = new Set(results.map((movie) => movie.tmdb_id));
  const referenceGenres = referenceMovies.flatMap((movie) => movie.genres);
  const genreIds = [
    ...mapGenres(structured.genres),
    ...mapGenres(referenceGenres),
  ];
  const uniqueGenreIds = [...new Set(genreIds)];
  const languages = structured.languages.filter(Boolean);

  const params: Record<string, string | number> = {
    include_adult: "false",
    sort_by: "vote_count.desc",
    page: 1,
  };
  if (uniqueGenreIds.length > 0) params.with_genres = uniqueGenreIds.join(",");
  if (languages.length > 0) params.with_original_language = languages.join("|");

  try {
    const yearRanges = getDiscoverYearRanges(structured);
    const perBucketTarget =
      yearRanges.length === 1 ? limit : Math.max(2, Math.ceil(limit / yearRanges.length));
    for (const range of yearRanges) {
      if (results.length >= limit) break;
      const rangeParams: Record<string, string | number> = { ...params };
      if (range.gte) rangeParams["primary_release_date.gte"] = range.gte;
      if (range.lte) rangeParams["primary_release_date.lte"] = range.lte;
      const response = await tmdbFetch<TmdbJson>("/discover/movie", rangeParams);
      const discoverResults = ((response.results ?? []) as TmdbJson[])
        .map(normalizeSummary)
        .filter((movie) => !referenceIds.includes(movie.tmdb_id))
        .filter((movie) => !seenIds.has(movie.tmdb_id));
      let taken = 0;
      for (const movie of discoverResults) {
        if (results.length >= limit || taken >= perBucketTarget) break;
        results.push(movie);
        seenIds.add(movie.tmdb_id);
        taken += 1;
      }
    }

    if (structured.free_text.trim() && results.length < limit) {
      const searchResponse = await tmdbFetch<TmdbJson>("/search/movie", {
        query: structured.free_text,
        include_adult: "false",
      });
      const extra: MovieSummary[] = ((searchResponse.results ?? []) as TmdbJson[])
        .map(normalizeSummary)
        .filter((movie) => !referenceIds.includes(movie.tmdb_id))
        .filter((movie) => !seenIds.has(movie.tmdb_id))
        .slice(0, limit - results.length);
      results.push(...extra);
      for (const movie of extra) seenIds.add(movie.tmdb_id);
    }
    return results.slice(0, limit);
  } catch (error) {
    console.error("getCandidateMovies failed", error);
    return DEMO_MOVIES.map((movie) => movie).slice(0, limit);
  }
}

export function structuredTextMatch(structured: StructuredQuery, movie: MovieDetails) {
  const haystack = [
    movie.title,
    movie.original_title,
    movie.overview,
    ...movie.genres,
    ...movie.keywords,
    ...movie.ai_tags,
    ...movie.director,
  ]
    .join(" ")
    .toLowerCase();
  let score = 0;
  const maxScore = 6;
  const targetGenres = structured.genres.map((genre) => genre.toLowerCase());
  if (movie.genres.some((genre) => targetGenres.includes(genre.toLowerCase()))) score += 1;
  const preferenceTerms = structured.moods.concat(structured.styles, structured.themes);
  if (preferenceTerms.length > 0) {
    const termHits = preferenceTerms.filter((term) =>
      termAliases(term).some((alias) => haystack.includes(alias.toLowerCase())),
    ).length;
    score += (termHits / preferenceTerms.length) * 2;
  }
  const countryHit = structured.countries.some((country) =>
    movie.production_countries.some((productionCountry) =>
      productionCountry.toLowerCase().includes(country.toLowerCase()) ||
      country.toLowerCase().includes(productionCountry.toLowerCase()),
    ),
  );
  if (countryHit) {
    score += 1;
  }
  if (structured.languages.includes(movie.original_language ?? "")) score += 1;
  const year = Number((movie.release_date ?? "").slice(0, 4));
  if (structured.year_min && year && year >= structured.year_min) score += 1;
  if (structured.year_max && year && year <= structured.year_max) score += 1;
  return clamp(score / maxScore, 0, 1);
}
