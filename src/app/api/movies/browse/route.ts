import { NextResponse } from "next/server";
import { browseMovies } from "@/lib/tmdb";

function splitParam(value: string | null) {
  if (!value) return [];
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function numberParam(value: string | null) {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  try {
    const result = await browseMovies({
      genres: splitParam(searchParams.get("genres")),
      year_min: numberParam(searchParams.get("year_min")),
      year_max: numberParam(searchParams.get("year_max")),
      languages: splitParam(searchParams.get("languages")),
      certifications: splitParam(searchParams.get("certifications")),
      min_rating: numberParam(searchParams.get("min_rating")),
      sort_by: searchParams.get("sort_by") || "vote_count.desc",
      page: numberParam(searchParams.get("page")) ?? 1,
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error("browse movies failed", error);
    return NextResponse.json(
      { results: [], error: "Browse failed" },
      { status: 500 },
    );
  }
}
