import type { Metadata } from "next";
import { AiSearchClient } from "@/components/ai-search-client";

export const metadata: Metadata = {
  title: "选电影找相似",
  description: "选择一部或多部喜欢的电影，AI 根据共同点推荐类似影片。",
};

export default function AiSearchPage() {
  return <AiSearchClient />;
}
