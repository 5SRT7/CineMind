import { NextResponse } from "next/server";
import { removeFromWatchlist } from "@/lib/watchlist";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ tmdbId: string }> },
) {
  const { tmdbId } = await context.params;
  const parsedId = Number(tmdbId);
  if (!Number.isInteger(parsedId) || parsedId <= 0) {
    return NextResponse.json({ error: "invalid tmdb_id" }, { status: 400 });
  }
  try {
    const removed = await removeFromWatchlist(parsedId);
    return NextResponse.json({ removed, tmdb_id: parsedId });
  } catch (error) {
    console.error("remove from watchlist failed", error);
    return NextResponse.json(
      { error: "无法移除待看电影" },
      { status: 500 },
    );
  }
}
