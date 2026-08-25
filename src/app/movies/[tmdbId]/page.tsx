import Link from "next/link";
import { notFound } from "next/navigation";
import {
  CalendarDays,
  Clock,
  ExternalLink,
  Flag,
  Globe2,
  Languages,
  PlayCircle,
  Star,
  Tag,
} from "lucide-react";
import { BackButton } from "@/components/back-button";
import { CastAvatar } from "@/components/cast-avatar";
import { MoviePoster } from "@/components/movie-poster";
import { WatchlistButton } from "@/components/watchlist-button";
import { getMovieDetails } from "@/lib/tmdb";
import {
  formatReleaseDate,
  tmdbImageUrl,
  yearFromDate,
} from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function MovieDetailPage({
  params,
}: {
  params: Promise<{ tmdbId: string }>;
}) {
  const { tmdbId } = await params;
  const movie = await getMovieDetails(tmdbId);
  if (!movie) notFound();

  const backdrop = tmdbImageUrl(movie.backdrop_path ?? movie.poster_path, "original");
  const trailer = movie.videos.find((video) => video.type === "Trailer") ?? movie.videos[0];

  return (
    <>
      <section className="relative overflow-hidden">
        {backdrop ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={backdrop}
            alt=""
            className="absolute inset-0 h-full w-full object-cover object-center opacity-25"
          />
        ) : null}
        <div className="hero-gradient absolute inset-0" />
        <div className="container-page relative pt-6">
          <BackButton />
        </div>
        <div className="container-page relative grid gap-8 pb-10 pt-4 md:grid-cols-[240px_1fr] md:gap-10 md:pb-14">
          <div className="mx-auto w-44 md:mx-0 md:w-full">
            <div className="overflow-hidden rounded-lg border border-white/10 shadow-2xl shadow-black/60">
              <MoviePoster movie={movie} priority />
            </div>
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="eyebrow">Movie Detail</p>
              {movie.certification ? (
                <span className="rounded border border-white/20 px-1.5 py-0.5 text-[11px] font-bold">
                  {movie.certification}
                  {movie.certification_country
                    ? ` · ${movie.certification_country}`
                    : ""}
                </span>
              ) : null}
            </div>
            <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-5xl">
              {movie.title}
            </h1>
            <p className="mt-2 text-sm text-muted-strong">
              {movie.original_title}
              {movie.release_date ? ` · ${formatReleaseDate(movie.release_date)}` : ""}
            </p>

            <div className="mt-5 flex flex-wrap gap-2">
              {movie.genres.map((genre) => (
                <span
                  key={genre}
                  className="rounded-md border border-white/10 bg-white/[0.06] px-2.5 py-1 text-xs font-medium"
                >
                  {genre}
                </span>
              ))}
            </div>

            <div className="mt-6 grid max-w-2xl grid-cols-2 gap-3 sm:grid-cols-3">
              <InfoItem
                icon={<Star className="h-4 w-4 text-amber-400" aria-hidden />}
                label="TMDB 评分"
                value={`${movie.vote_average.toFixed(1)} / 10`}
              />
              <InfoItem
                icon={<CalendarDays className="h-4 w-4 text-accent" aria-hidden />}
                label="上映年份"
                value={yearFromDate(movie.release_date)?.toString() ?? "未知"}
              />
              <InfoItem
                icon={<Clock className="h-4 w-4 text-amber-300" aria-hidden />}
                label="片长"
                value={movie.runtime ? `${movie.runtime} 分钟` : "未知"}
              />
              <InfoItem
                icon={<Flag className="h-4 w-4 text-accent" aria-hidden />}
                label="制片地区"
                value={movie.production_countries.join(" / ") || "未知"}
              />
              <InfoItem
                icon={<Languages className="h-4 w-4 text-rose-300" aria-hidden />}
                label="原始语言"
                value={movie.original_language?.toUpperCase() ?? "未知"}
              />
              <InfoItem
                icon={<Globe2 className="h-4 w-4 text-accent" aria-hidden />}
                label="投票数"
                value={movie.vote_count.toLocaleString()}
              />
            </div>

            <div className="mt-6 flex flex-wrap gap-2">
              <WatchlistButton tmdbId={movie.tmdb_id} />
              {movie.imdb_id ? (
                <a
                  href={`https://www.imdb.com/title/${movie.imdb_id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex h-10 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.06] px-4 text-sm font-semibold transition-colors hover:bg-white/10"
                >
                  IMDb
                  <ExternalLink className="h-4 w-4" aria-hidden />
                </a>
              ) : null}
              {trailer ? (
                <a
                  href={`https://www.youtube.com/watch?v=${trailer.key}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex h-10 items-center gap-2 rounded-lg bg-accent px-4 text-sm font-bold text-white transition-colors hover:bg-[#8f1515]"
                >
                  <PlayCircle className="h-4 w-4" aria-hidden />
                  {trailer.name || "观看预告片"}
                </a>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <section className="container-page grid gap-10 py-12 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0">
          <DetailSection title="剧情简介">
            <p className="max-w-3xl text-[15px] leading-8 text-foreground/90">
              {movie.overview || "暂无简介。"}
            </p>
          </DetailSection>

          {movie.ai_tags.length > 0 ? (
            <DetailSection title="AI 标签">
              <div className="flex flex-wrap gap-2">
                {movie.ai_tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-md bg-accent-soft px-2.5 py-1 text-xs font-semibold text-accent"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </DetailSection>
          ) : null}

          <DetailSection title="主创">
            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <p className="eyebrow mb-2">导演</p>
                <p className="font-semibold">
                  {movie.director.join("、") || "暂无资料"}
                </p>
              </div>
              <div>
                <p className="eyebrow mb-2">编剧</p>
                <p className="font-semibold">
                  {movie.writers.join("、") || "暂无资料"}
                </p>
              </div>
            </div>
          </DetailSection>

          <DetailSection title="演员">
            {movie.cast.length > 0 ? (
              <div className="grid grid-cols-3 gap-5 sm:grid-cols-5 lg:grid-cols-6">
                {movie.cast.slice(0, 12).map((person) => (
                  <CastAvatar key={person.id} person={person} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted">暂无演员资料。</p>
            )}
          </DetailSection>
        </div>

        <aside className="space-y-8">
          {trailer ? (
            <DetailSection title="预告片">
              <div className="aspect-video overflow-hidden rounded-lg border border-line bg-black">
                <iframe
                  src={`https://www.youtube.com/embed/${trailer.key}`}
                  title={trailer.name}
                  className="h-full w-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            </DetailSection>
          ) : null}

          <DetailSection title="关键词">
            {movie.keywords.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {movie.keywords.slice(0, 18).map((keyword) => (
                  <span
                    key={keyword}
                    className="flex items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-xs text-muted-strong"
                  >
                    <Tag className="h-3 w-3 text-accent" aria-hidden />
                    {keyword}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted">暂无关键词。</p>
            )}
          </DetailSection>

          {movie.similar.length > 0 ? (
            <DetailSection title="相似电影">
              <div className="grid grid-cols-2 gap-3">
                {movie.similar.slice(0, 6).map((similar) => (
                  <Link
                    key={similar.tmdb_id}
                    href={`/movies/${similar.tmdb_id}`}
                    className="group rounded-lg"
                  >
                    <div className="overflow-hidden rounded-lg">
                      <MoviePoster movie={similar} />
                    </div>
                    <p className="mt-2 line-clamp-1 text-xs font-semibold group-hover:text-accent">
                      {similar.title}
                    </p>
                  </Link>
                ))}
              </div>
            </DetailSection>
          ) : null}
        </aside>
      </section>
    </>
  );
}

function InfoItem({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
      <div className="flex items-center gap-1.5 text-[11px] text-muted">
        {icon}
        {label}
      </div>
      <p className="mt-1 text-sm font-bold">{value}</p>
    </div>
  );
}

function DetailSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-10 last:mb-0">
      <h2 className="mb-4 text-lg font-extrabold tracking-tight">{title}</h2>
      {children}
    </section>
  );
}
