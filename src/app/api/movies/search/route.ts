import { NextResponse } from "next/server";
import { isDemoMode, searchMovies } from "@/lib/tmdb";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = (searchParams.get("q") ?? "").trim();
  if (!query) {
    return NextResponse.json({ results: [], error: "q is required" }, { status: 400 });
  }
  try {
    const results = await searchMovies(query);
    return NextResponse.json({
      results,
      mode: isDemoMode() ? "demo" : "tmdb",
      total: results.length,
    });
  } catch (error) {
    console.error("movie search failed", error);
    return NextResponse.json(
      { results: [], error: "Movie search failed" },
      { status: 500 },
    );
  }
}
