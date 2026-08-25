export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function tmdbImageUrl(
  path: string | null | undefined,
  size: "w92" | "w185" | "w300" | "w342" | "w500" | "w780" | "original" = "w500",
) {
  if (!path) return null;
  return `https://image.tmdb.org/t/p/${size}${path}`;
}

export function yearFromDate(date: string | null | undefined) {
  if (!date) return null;
  const match = date.match(/^\d{4}/);
  return match ? Number(match[0]) : null;
}

export function formatReleaseDate(date: string | null | undefined) {
  if (!date) return "未知";
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return date;
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(parsed);
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function round(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function safeJsonParse<T>(text: string, fallback: T): T {
  try {
    const value = JSON.parse(text);
    return (value ?? fallback) as T;
  } catch {
    return fallback;
  }
}
