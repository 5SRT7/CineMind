"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Search, Sparkles } from "lucide-react";

export function HomeSearch() {
  const router = useRouter();
  const [normalQuery, setNormalQuery] = useState("");

  function submitNormal(event: FormEvent) {
    event.preventDefault();
    const query = normalQuery.trim();
    if (query) router.push(`/search?q=${encodeURIComponent(query)}`);
  }

  return (
    <div className="w-full max-w-3xl">
      <Link
        href="/ai-search"
        className="flex items-center justify-between gap-3 rounded-xl border border-accent/40 bg-accent-soft p-4 backdrop-blur-xl transition-colors hover:border-accent/70"
      >
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-accent text-white">
            <Sparkles className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <p className="font-extrabold">选择电影，AI 找同类</p>
            <p className="mt-0.5 text-xs text-muted-strong">
              选 1-5 部喜欢的电影，AI 根据共同点推荐相似影片
            </p>
          </div>
        </div>
        <ArrowRight className="h-5 w-5 shrink-0 text-accent" aria-hidden />
      </Link>

      <form
        onSubmit={submitNormal}
        className="mt-3 flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.06] px-3 backdrop-blur"
      >
        <Search className="h-4 w-4 shrink-0 text-muted" aria-hidden />
        <input
          value={normalQuery}
          onChange={(event) => setNormalQuery(event.target.value)}
          placeholder="普通搜索：Inception"
          className="min-w-0 flex-1 bg-transparent py-3 text-sm text-foreground placeholder:text-muted focus:outline-none"
          aria-label="普通搜索"
        />
        <button
          type="submit"
          className="h-8 shrink-0 rounded-md px-3 text-xs font-bold text-foreground/80 transition-colors hover:bg-white/10"
        >
          搜索
        </button>
      </form>
    </div>
  );
}
