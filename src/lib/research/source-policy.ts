import type { SourceType } from "@/lib/programme-enrichment";
import { SOURCE_TYPES } from "@/lib/programme-enrichment";
import type { ResearchConflict, ResearchSource } from "@/lib/research/research-schema";

const BLOCKED_HOSTS = [
  "reddit.com",
  "facebook.com",
  "instagram.com",
  "twitter.com",
  "x.com",
  "tiktok.com",
  "medium.com",
  "quora.com",
  "youtube.com",
  "linkedin.com",
  "whatsapp.com",
  "t.me",
];

const TYPE_RANK: Record<SourceType, number> = {
  official_admission_call: 1,
  official_university_regulation: 2,
  official_programme_page: 3,
  official_pdf: 4,
  official_application_portal: 5,
  other_official_source: 6,
};

const SCOPE_RANK = { programme: 1, department: 2, university: 3 };

export function officialUrl(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return false;
  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  return !BLOCKED_HOSTS.some((blocked) => host === blocked || host.endsWith(`.${blocked}`));
}

export function isSourceType(value: string): value is SourceType {
  return (SOURCE_TYPES as readonly string[]).includes(value);
}

export function yearStart(value: string | null) {
  const match = value?.match(/(20\d{2})/);
  return match ? Number(match[1]) : null;
}

export function sourceRank(source: Pick<ResearchSource, "sourceType" | "scope" | "academicYear">) {
  return {
    year: yearStart(source.academicYear) ?? 0,
    scope: SCOPE_RANK[source.scope] ?? 3,
    type: TYPE_RANK[source.sourceType] ?? 9,
  };
}

/** Prefer the newer, more programme-specific official source. A tie does not pick a winner. */
export function preferOfficial(english: ResearchSource, italian: ResearchSource) {
  const left = sourceRank(english);
  const right = sourceRank(italian);
  if (right.year !== left.year) return right.year > left.year ? "it" : "en";
  if (right.scope !== left.scope) return right.scope < left.scope ? "it" : "en";
  if (right.type !== left.type) return right.type < left.type ? "it" : "en";
  return null;
}

export function conflictFor(field: string, english: { value: string; source: ResearchSource }, italian: { value: string; source: ResearchSource }): ResearchConflict {
  const winner = preferOfficial(english.source, italian.source);
  const proposed = winner === "it" ? italian.value : winner === "en" ? english.value : null;
  const reason = winner === null
    ? "Official English and Italian sources disagree, and neither is clearly newer or more programme-specific."
    : winner === "it"
      ? "The Italian official source is newer or more programme-specific."
      : "The English official source is newer or more programme-specific.";
  return {
    field,
    englishValue: english.value,
    italianValue: italian.value,
    englishUrl: english.source.url,
    italianUrl: italian.source.url,
    proposedValue: proposed,
    reason,
  };
}
