import { revalidateTag } from "next/cache";
import { unstable_cache } from "next/cache";

/** Public catalogue cache TTL (seconds). Override with CACHE_REVALIDATE_SECONDS. */
export function cacheRevalidateSeconds() {
  const raw = Number(process.env.CACHE_REVALIDATE_SECONDS || "120");
  if (!Number.isFinite(raw) || raw < 30) return 120;
  return Math.min(Math.floor(raw), 3600);
}

export function cachedJsonReader<T>(
  tag: string,
  key: string,
  reader: () => Promise<T>,
) {
  return unstable_cache(reader, [key], {
    revalidate: cacheRevalidateSeconds(),
    tags: [tag],
  })();
}

export function bustCacheTag(tag: string) {
  revalidateTag(tag, "max");
}

export const CACHE_TAGS = {
  universities: "universities",
  phd: "phd",
  scholarships: "scholarships",
  content: "content",
} as const;

/** ISR default for public marketing pages under high traffic. */
export const PUBLIC_REVALIDATE_SECONDS = 120;
