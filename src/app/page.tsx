import Link from "next/link";
import { HomeSearch } from "@/components/home-search";
import { MovieGrid } from "@/components/movie-grid";
import { SectionHeading } from "@/components/section-heading";
import { getHomeSections } from "@/lib/tmdb";
import { tmdbImageUrl } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const sections = await getHomeSections();
  const heroMovie = sections.popular[0];
  const heroBackdrop = tmdbImageUrl(
    heroMovie?.backdrop_path ?? heroMovie?.poster_path,
    "original",
  );

  return (
    <>
      <section className="relative min-h-[78vh] overflow-hidden">
        {heroBackdrop ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={heroBackdrop}
            alt=""
            className="absolute inset-0 h-full w-full object-cover object-top opacity-35"
          />
        ) : null}
        <div className="hero-gradient absolute inset-0" />
        <div className="container-page relative flex min-h-[78vh] flex-col justify-center pb-14 pt-10">
          <p className="eyebrow mb-3">Similar Movie Finder</p>
          <h1 className="max-w-3xl text-4xl font-black leading-[1.08] tracking-tight sm:text-6xl">
            选一部喜欢的电影，找到
            <span className="text-accent">更多同类</span>
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-7 text-muted-strong sm:text-base">
            选 1-5 部你看过或喜欢的电影。CineMind
            会分析它们的共同类型、关键词和氛围，从 TMDB 检索相似候选，再解释为什么推荐这些影片。
          </p>
          <div className="mt-8">
            <HomeSearch />
          </div>
        </div>
      </section>

      <section className="container-page py-12">
        <SectionHeading
          eyebrow="Trending"
          title="热门电影"
          action={
            <span className="hidden text-xs text-muted sm:block">
              {sections.mode === "demo" ? "演示数据" : "TMDB 实时数据"}
            </span>
          }
        />
        <MovieGrid movies={sections.popular.slice(0, 12)} priorityStart={6} />
      </section>

      <section className="container-page py-12">
        <SectionHeading eyebrow="Top Rated" title="高分电影" />
        <MovieGrid movies={sections.topRated.slice(0, 12)} />
      </section>

      <section className="container-page pb-16 pt-12">
        <SectionHeading
          eyebrow="New Release"
          title="最近上映"
          action={
            <Link
              href="/ai-search"
              className="text-sm font-semibold text-accent hover:text-[#e04a4a]"
            >
              试试 AI 搜索
            </Link>
          }
        />
        <MovieGrid movies={sections.nowPlaying.slice(0, 12)} />
      </section>
    </>
  );
}
