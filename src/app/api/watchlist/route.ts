import { NextResponse } from "next/server";
import { getMovieDetails } from "@/lib/tmdb";
import { addToWatchlist, getWatchlist } from "@/lib/watchlist";

export async function GET() {
  try {
    const items = await getWatchlist();
    return NextResponse.json({ items, total: items.length });
  } catch (error) {
    console.error("get watchlist failed", error);
    return NextResponse.json(
      { error: "无法读取待看列表，请检查数据库连接" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const tmdbId = Number(body.tmdb_id);
    if (!Number.isInteger(tmdbId) || tmdbId <= 0) {
      return NextResponse.json(
        { error: "tmdb_id is required" },
        { status: 400 },
      );
    }
    const movie = await getMovieDetails(tmdbId);
    if (!movie) {
      return NextResponse.json({ error: "Movie not found" }, { status: 404 });
    }
    await addToWatchlist(movie);
    return NextResponse.json({ added: true, tmdb_id: tmdbId });
  } catch (error) {
    console.error("add to watchlist failed", error);
    return NextResponse.json(
      { error: "无法添加到待看列表，请检查数据库连接" },
      { status: 500 },
    );
  }
}
