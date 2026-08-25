import type { Metadata } from "next";
import { WatchlistClient } from "@/components/watchlist-client";

export const metadata: Metadata = {
  title: "待看电影",
  description: "查看你想看的电影列表。",
};

export default function WatchlistPage() {
  return <WatchlistClient />;
}
