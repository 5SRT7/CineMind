import type { Metadata } from "next";
import {
  BrowseClient,
  type BrowseInitialFilters,
} from "@/components/browse-client";
import { browseMovies } from "@/lib/tmdb";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "浏览电影",
  description: "按类型、年份、语言、分级和评分筛选电影。",
};

function splitParam(value: string | undefined) {
  if (!value) return [];
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function numberParam(value: string | undefined) {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export default async function BrowsePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const read = (key: string) =>
    typeof params[key] === "string" ? (params[key] as string) : undefined;
  const filters: BrowseInitialFilters = {
    genres: splitParam(read("genres")),
    yearMin: numberParam(read("year_min")),
    yearMax: numberParam(read("year_max")),
    languages: splitParam(read("languages")),
    certifications: splitParam(read("certifications")),
    minRating: read("min_rating") ?? "",
    sortBy: read("sort_by") ?? "vote_count.desc",
  };
  const page = numberParam(read("page")) ?? 1;
  const initial = await browseMovies({
    page,
    genres: filters.genres,
    year_min: filters.yearMin,
    year_max: filters.yearMax,
    languages: filters.languages,
    certifications: filters.certifications,
    min_rating: filters.minRating ? Number(filters.minRating) : null,
    sort_by: filters.sortBy,
  });
  return (
    <BrowseClient
      initialMovies={initial.results}
      initialPage={initial.page}
      initialTotalPages={initial.total_pages}
      initialMode={initial.mode}
      initialFilters={filters}
    />
  );
}
