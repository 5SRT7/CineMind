import { NextResponse } from "next/server";
import { isInWatchlist } from "@/lib/watchlist";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tmdbId = Number(searchParams.get("tmdb_id"));
  if (!Number.isInteger(tmdbId) || tmdbId <= 0) {
    return NextResponse.json(
      { error: "tmdb_id is required" },
      { status: 400 },
    );
  }
  try {
    const inWatchlist = await isInWatchlist(tmdbId);
    return NextResponse.json({ tmdb_id: tmdbId, in_watchlist: inWatchlist });
  } catch (error) {
    console.error("watchlist status failed", error);
    return NextResponse.json(
      { error: "无法读取待看状态" },
      { status: 500 },
    );
  }
}
