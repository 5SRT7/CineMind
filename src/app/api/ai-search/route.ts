import { NextResponse } from "next/server";
import { runAiSearch, runMovieBasedSearch } from "@/lib/ai/pipeline";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const query = String(body.query ?? "").trim();
    const movieIds = Array.isArray(body.movie_ids)
      ? body.movie_ids.map(Number).filter((id: number) => Number.isInteger(id) && id > 0)
      : [];
    const rawFilters =
      body.filters && typeof body.filters === "object" ? body.filters : {};
    const filters = {
      genres: Array.isArray(rawFilters.genres)
        ? rawFilters.genres.filter((item: unknown) => typeof item === "string")
        : [],
      year_min:
        typeof rawFilters.year_min === "number" && Number.isFinite(rawFilters.year_min)
          ? rawFilters.year_min
          : null,
      year_max:
        typeof rawFilters.year_max === "number" && Number.isFinite(rawFilters.year_max)
          ? rawFilters.year_max
          : null,
      languages: Array.isArray(rawFilters.languages)
        ? rawFilters.languages.filter((item: unknown) => typeof item === "string")
        : [],
      certifications: Array.isArray(rawFilters.certifications)
        ? rawFilters.certifications.filter((item: unknown) => typeof item === "string")
        : [],
    };
    const notes = String(body.notes ?? "").trim().slice(0, 500);
    if (!query && movieIds.length === 0) {
      return NextResponse.json(
        { error: "query or movie_ids is required" },
        { status: 400 },
      );
    }
    if (query && query.length > 400) {
      return NextResponse.json(
        { error: "query must be shorter than 400 characters" },
        { status: 400 },
      );
    }
    if (movieIds.length > 5) {
      return NextResponse.json(
        { error: "最多选择 5 部电影" },
        { status: 400 },
      );
    }
    const result =
      movieIds.length > 0
        ? await runMovieBasedSearch(movieIds, { filters, notes })
        : await runAiSearch(query);
    return NextResponse.json(result);
  } catch (error) {
    console.error("ai search failed", error);
    return NextResponse.json(
      { results: [], error: "AI search failed" },
      { status: 500 },
    );
  }
}
