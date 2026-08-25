import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { getEmbedding } from "./embedding";
import {
  buildStructuredQueryFromMovies,
  understandQuery,
  type MovieBasedOptions,
} from "./query-understanding";
import {
  buildMovieDocument,
  generateExplanations,
  rerankRecommendations,
} from "./recommendations";
import { getCandidateMovies, getMovieDetails, isDemoMode } from "../tmdb";
import type {
  AiRecommendation,
  AiSearchResult,
  MovieDetails,
  MovieDocument,
  MovieSummary,
  StructuredQuery,
} from "../types";
import {
  cleanupExpired,
  recordFromDetails,
  searchVectorStore,
  upsertMovieEmbedding,
  vectorStoreKind,
} from "../vector-store";
import { providerLabel } from "./provider";

const TOP_K = Number(process.env.AI_SEARCH_TOP_K || 10);

type AiSearchState = {
  query: string;
  structured: StructuredQuery | null;
  candidates: MovieSummary[];
  details: MovieDetails[];
  documents: MovieDocument[];
  similarities: Record<string, number>;
  recommendations: AiRecommendation[];
  trace: string[];
};

const StateAnnotation = Annotation.Root({
  query: Annotation<string>,
  structured: Annotation<StructuredQuery | null>(),
  candidates: Annotation<MovieSummary[]>(),
  details: Annotation<MovieDetails[]>(),
  documents: Annotation<MovieDocument[]>(),
  similarities: Annotation<Record<string, number>>(),
  recommendations: Annotation<AiRecommendation[]>(),
  trace: Annotation<string[]>({
    reducer: (left, right) => [...left, ...right],
    default: () => [],
  }),
});

async function parseQueryNode(state: AiSearchState) {
  const structured = state.structured ?? (await understandQuery(state.query));
  return { structured, trace: ["parse_query"] };
}

async function retrieveCandidatesNode(state: AiSearchState) {
  if (!state.structured) throw new Error("Structured query is missing");
  const candidates = await getCandidateMovies(state.structured, TOP_K);
  return { candidates, trace: ["retrieve_candidates"] };
}

async function mapWithConcurrency<T, R>(
  items: T[],
  worker: (item: T) => Promise<R>,
  concurrency = 4,
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

async function fetchDetailsNode(state: AiSearchState) {
  const details = await mapWithConcurrency(state.candidates, async (movie) => {
    return getMovieDetails(movie.tmdb_id);
  });
  return {
    details: details
      .filter((movie): movie is MovieDetails => Boolean(movie))
      .filter((movie) =>
        state.structured ? passesStructuredFilters(movie, state.structured) : true,
      ),
    trace: ["fetch_movie_details"],
  };
}

function passesStructuredFilters(movie: MovieDetails, structured: StructuredQuery) {
  const filterGenres = structured.filter_genres.map((genre) => genre.toLowerCase());
  if (
    filterGenres.length > 0 &&
    !movie.genres.some((genre) =>
      filterGenres.some((filter) =>
        genre.toLowerCase().includes(filter) ||
        filter.includes(genre.toLowerCase()),
      ),
    )
  ) {
    return false;
  }
  const year = Number((movie.release_date ?? "").slice(0, 4));
  if (structured.year_min && year && year < structured.year_min) return false;
  if (structured.year_max && year && year > structured.year_max) return false;
  if (
    structured.languages.length > 0 &&
    !structured.languages.includes(movie.original_language ?? "")
  ) {
    return false;
  }
  if (
    structured.certifications.length > 0 &&
    !structured.certifications
      .map((certification) => certification.toLowerCase())
      .includes((movie.certification ?? "").toLowerCase())
  ) {
    return false;
  }
  return true;
}

async function buildDocumentsNode(state: AiSearchState) {
  return {
    documents: state.details.map(buildMovieDocument),
    trace: ["build_documents"],
  };
}

async function embedDocumentsNode(state: AiSearchState) {
  await cleanupExpired();
  const detailsById = new Map(state.details.map((movie) => [movie.tmdb_id, movie]));
  await mapWithConcurrency(state.documents, async (document) => {
    const embedding = await getEmbedding(document.text);
    const movie = detailsById.get(document.tmdb_id);
    if (movie) {
      await upsertMovieEmbedding(recordFromDetails(movie), embedding);
    }
  }, 4);
  return { trace: ["embedding"] };
}

async function vectorSearchNode(state: AiSearchState) {
  const queryEmbedding = await getEmbedding(state.query);
  const similarities = await searchVectorStore(queryEmbedding, TOP_K);
  return {
    similarities: Object.fromEntries(similarities),
    trace: ["vector_search"],
  };
}

async function rerankNode(state: AiSearchState) {
  if (!state.structured) throw new Error("Structured query is missing");
  const similarities = new Map(
    Object.entries(state.similarities).map(([id, score]) => [Number(id), score]),
  );
  const ranked = rerankRecommendations(
    state.details.filter((movie) => similarities.has(movie.tmdb_id)),
    similarities,
    state.structured,
  );
  return { recommendations: ranked, trace: ["rerank"] };
}

async function explanationNode(state: AiSearchState) {
  if (!state.structured) throw new Error("Structured query is missing");
  const recommendations = await generateExplanations(
    state.query,
    state.structured,
    state.recommendations,
  );
  return { recommendations, trace: ["generate_explanation"] };
}

const workflow = new StateGraph(StateAnnotation)
  .addNode("parse_query", parseQueryNode)
  .addNode("retrieve_candidates", retrieveCandidatesNode)
  .addNode("fetch_movie_details", fetchDetailsNode)
  .addNode("build_documents", buildDocumentsNode)
  .addNode("embedding", embedDocumentsNode)
  .addNode("vector_search", vectorSearchNode)
  .addNode("rerank", rerankNode)
  .addNode("generate_explanation", explanationNode)
  .addEdge(START, "parse_query")
  .addEdge("parse_query", "retrieve_candidates")
  .addEdge("retrieve_candidates", "fetch_movie_details")
  .addEdge("fetch_movie_details", "build_documents")
  .addEdge("build_documents", "embedding")
  .addEdge("embedding", "vector_search")
  .addEdge("vector_search", "rerank")
  .addEdge("rerank", "generate_explanation")
  .addEdge("generate_explanation", END);

export const aiSearchGraph = workflow.compile();

export async function runAiSearch(
  query: string,
  structuredOverride?: StructuredQuery,
): Promise<AiSearchResult> {
  const startedAt = performance.now();
  const result = await aiSearchGraph.invoke(
    structuredOverride
      ? { query, structured: structuredOverride }
      : { query },
  );
  const latencyMs = Math.round(performance.now() - startedAt);
  return {
    query,
    structured: result.structured ?? {
      reference_movies: [],
      reference_ids: [],
      genres: [],
      filter_genres: [],
      moods: [],
      styles: [],
      themes: [],
      countries: [],
      languages: [],
      year_min: null,
      year_max: null,
      certifications: [],
      notes: "",
      exclude: [],
      free_text: query,
    },
    results: result.recommendations.slice(0, TOP_K),
    trace: result.trace,
    mode: isDemoMode() ? "demo" : "tmdb",
    vectorStore: vectorStoreKind(),
    provider: providerLabel() as "openai" | "siliconflow" | "local",
    latencyMs,
  };
}

export async function runMovieBasedSearch(
  movieIds: number[],
  options: MovieBasedOptions = {},
) {
  const uniqueIds = [
    ...new Set(
      movieIds
        .map(Number)
        .filter((id) => Number.isInteger(id) && id > 0),
    ),
  ].slice(0, 5);
  if (uniqueIds.length === 0) {
    throw new Error("请至少选择一部电影");
  }
  const movies = await mapWithConcurrency(uniqueIds, getMovieDetails, 4);
  const details = movies.filter((movie): movie is MovieDetails => Boolean(movie));
  if (details.length === 0) {
    throw new Error("无法读取所选电影的信息");
  }
  const structured = buildStructuredQueryFromMovies(details, options);
  return runAiSearch(structured.free_text, structured);
}
