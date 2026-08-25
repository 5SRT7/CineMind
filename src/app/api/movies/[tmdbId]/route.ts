import { NextResponse } from "next/server";
import { getMovieDetails, isDemoMode } from "@/lib/tmdb";

export async function GET(
  _request: Request,
  context: { params: Promise<{ tmdbId: string }> },
) {
  const { tmdbId } = await context.params;
  try {
    const movie = await getMovieDetails(tmdbId);
    if (!movie) {
      return NextResponse.json({ error: "Movie not found" }, { status: 404 });
    }
    return NextResponse.json({
      movie,
      mode: isDemoMode() ? "demo" : "tmdb",
    });
  } catch (error) {
    console.error("movie details failed", error);
    return NextResponse.json(
      { error: "Movie details failed" },
      { status: 500 },
    );
  }
}
