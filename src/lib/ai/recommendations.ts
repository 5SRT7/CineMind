import { createChatCompletion } from "./provider";
import { termAliases } from "./query-understanding";
import { structuredTextMatch } from "../tmdb";
import type {
  AiRecommendation,
  MovieDetails,
  MovieDocument,
  StructuredQuery,
} from "../types";
import { clamp, round, safeJsonParse } from "../utils";

export function buildMovieDocument(movie: MovieDetails): MovieDocument {
  const text = [
    `Title: ${movie.title}`,
    `Original Title: ${movie.original_title}`,
    `Overview: ${movie.overview}`,
    `Genres: ${movie.genres.join(", ")}`,
    `Keywords: ${movie.keywords.join(", ")}`,
    `Director: ${movie.director.join(", ")}`,
    `Cast: ${movie.cast.map((member) => member.name).join(", ")}`,
    `AI Tags: ${movie.ai_tags.join(", ")}`,
  ].join("\n");
  return {
    tmdb_id: movie.tmdb_id,
    title: movie.title,
    original_title: movie.original_title,
    overview: movie.overview,
    genres: movie.genres,
    keywords: movie.keywords,
    director: movie.director,
    cast: movie.cast.map((member) => member.name),
    ai_tags: movie.ai_tags,
    text,
  };
}

function scorePreferenceMatch(structured: StructuredQuery, movie: MovieDetails) {
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
  const terms = structured.moods.concat(structured.styles, structured.themes);
  if (terms.length === 0) return 0.5;
  const hits = terms.filter((term) =>
    termAliases(term).some((alias) => haystack.includes(alias.toLowerCase())),
  ).length;
  return clamp(hits / terms.length, 0, 1);
}

function scoreQuality(movie: MovieDetails) {
  const rating = clamp(movie.vote_average / 10, 0, 1);
  const popularity = clamp(Math.log10(movie.vote_count + 1) / 6, 0, 1);
  return clamp(rating * 0.7 + popularity * 0.3, 0, 1);
}

export function rerankRecommendations(
  details: MovieDetails[],
  similarities: Map<number, number>,
  structured: StructuredQuery,
) {
  const recommendations: AiRecommendation[] = details.map((movie) => {
    const semanticScore = clamp(similarities.get(movie.tmdb_id) ?? 0, 0, 1);
    const structuredScore = structuredTextMatch(structured, movie);
    const preferenceScore = scorePreferenceMatch(structured, movie);
    const qualityScore = scoreQuality(movie);
    const finalScore =
      semanticScore * 0.5 +
      structuredScore * 0.2 +
      preferenceScore * 0.2 +
      qualityScore * 0.1;
    return {
      movie,
      final_score: round(finalScore, 4),
      semantic_score: round(semanticScore, 4),
      structured_score: round(structuredScore, 4),
      preference_score: round(preferenceScore, 4),
      quality_score: round(qualityScore, 4),
      match_percent: Math.round(clamp(0.55 + finalScore * 0.45, 0, 1) * 100),
      reason: "",
      tags: movie.ai_tags.slice(0, 6),
    };
  });
  return recommendations.sort((a, b) => b.final_score - a.final_score);
}

function localReason(
  structured: StructuredQuery,
  recommendation: AiRecommendation,
) {
  const movie = recommendation.movie;
  const matchedTerms = structured.moods
    .concat(structured.styles, structured.themes)
    .filter((term) =>
      termAliases(term).some((alias) =>
        [
          movie.title,
          movie.original_title,
          movie.overview,
          ...movie.genres,
          ...movie.keywords,
          ...movie.ai_tags,
        ]
          .join(" ")
          .toLowerCase()
          .includes(alias.toLowerCase()),
      ),
    );
  const matchedGenres = movie.genres.filter((genre) =>
    structured.genres.some(
      (target) =>
        genre.toLowerCase().includes(target.toLowerCase()) ||
        target.toLowerCase().includes(genre.toLowerCase()),
    ),
  );
  const parts: string[] = [];
  if (matchedGenres.length > 0) {
    parts.push(`类型${matchedGenres.join("、")}与需求一致`);
  }
  if (matchedTerms.length > 0) {
    parts.push(`在情绪与主题上贴合「${matchedTerms.slice(0, 3).join("、")}」`);
  }
  if (movie.ai_tags.length > 0) {
    parts.push(`影片氛围${movie.ai_tags.slice(0, 3).join("、")}`);
  }
  if (movie.vote_average >= 7.5) {
    parts.push(`口碑评分 ${movie.vote_average.toFixed(1)}/10`);
  }
  const base =
    parts.length > 0
      ? parts.join("，")
      : "候选影片在语义检索中与你的描述接近";
  return `推荐理由：${base}。AI 匹配度 ${recommendation.match_percent}%。`;
}

async function llmReasons(
  query: string,
  structured: StructuredQuery,
  recommendations: AiRecommendation[],
) {
  const movieContext = recommendations
    .map(({ movie, match_percent }, index) => {
      return `${index + 1}. tmdb_id=${movie.tmdb_id}; title=${movie.title} (${movie.original_title}); overview=${movie.overview.slice(
        0,
        220,
      )}; keywords=${movie.keywords.slice(0, 8).join(", ")}; genres=${movie.genres.join(
        ", ",
      )}; ai_tags=${movie.ai_tags.slice(0, 6).join(", ")}; match_percent=${match_percent}`;
    })
    .join("\n");
  const prompt = `用户查询：${query}
结构化需求：${JSON.stringify(structured)}

候选电影（只使用以下事实，不要编造剧情）：
${movieContext}

为每部电影生成一句中文推荐理由（50-90 字），解释它为什么符合用户需求，并明确指出影片关键词、氛围或类型与需求的对应关系。
输出 JSON：{"1": "理由", "2": "理由", ...}，key 使用 tmdb_id，只输出 JSON。`;

  try {
    const completion = await createChatCompletion({
      temperature: 0.4,
      responseFormat: "json_object",
      messages: [
        { role: "system", content: "你是电影推荐解释引擎，只依据给定事实，不编造。" },
        { role: "user", content: prompt },
      ],
    });
    const raw = completion.choices[0]?.message?.content ?? "{}";
    const parsed = safeJsonParse<Record<string, string>>(raw, {});
    return parsed;
  } catch (error) {
    console.error("LLM explanation failed, using local reasons", error);
    return null;
  }
}

export async function generateExplanations(
  query: string,
  structured: StructuredQuery,
  recommendations: AiRecommendation[],
) {
  const reasons = await llmReasons(query, structured, recommendations);
  return recommendations.map((recommendation) => ({
    ...recommendation,
    reason:
      reasons?.[String(recommendation.movie.tmdb_id)] ??
      localReason(structured, recommendation),
  }));
}
