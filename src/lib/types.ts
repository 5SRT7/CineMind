export type MovieSummary = {
  tmdb_id: number;
  title: string;
  original_title: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string | null;
  vote_average: number;
  vote_count: number;
  genres: string[];
  overview: string;
  original_language: string | null;
  popularity: number;
};

export type CastMember = {
  id: number;
  name: string;
  character: string | null;
  profile_path: string | null;
  order: number;
};

export type MovieVideo = {
  name: string;
  key: string;
  site: string;
  type: string;
};

export type MovieDetails = MovieSummary & {
  runtime: number | null;
  certification: string | null;
  certification_country: string | null;
  director: string[];
  writers: string[];
  cast: CastMember[];
  keywords: string[];
  videos: MovieVideo[];
  imdb_id: string | null;
  production_countries: string[];
  status: string | null;
  ai_tags: string[];
  similar: MovieSummary[];
};

export type StructuredQuery = {
  reference_movies: string[];
  reference_ids: number[];
  genres: string[];
  filter_genres: string[];
  moods: string[];
  styles: string[];
  themes: string[];
  countries: string[];
  languages: string[];
  year_min: number | null;
  year_max: number | null;
  certifications: string[];
  notes: string;
  exclude: string[];
  free_text: string;
};

export type MovieDocument = {
  tmdb_id: number;
  title: string;
  original_title: string;
  overview: string;
  genres: string[];
  keywords: string[];
  director: string[];
  cast: string[];
  ai_tags: string[];
  text: string;
};

export type AiRecommendation = {
  movie: MovieDetails;
  final_score: number;
  semantic_score: number;
  structured_score: number;
  preference_score: number;
  quality_score: number;
  match_percent: number;
  reason: string;
  tags: string[];
};

export type AiSearchResult = {
  query: string;
  structured: StructuredQuery;
  results: AiRecommendation[];
  trace: string[];
  mode: "demo" | "tmdb" | "hybrid";
  vectorStore: "memory" | "pgvector";
  provider: "openai" | "siliconflow" | "local";
  latencyMs: number;
};

export type HomeSections = {
  popular: MovieSummary[];
  topRated: MovieSummary[];
  nowPlaying: MovieSummary[];
  mode: "demo" | "tmdb";
};
