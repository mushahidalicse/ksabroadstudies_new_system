import { detectTargetDegreeLevel, type CatalogLevel } from "@/lib/research/degree-level";
import type { ResearchSubject } from "@/lib/research/research-schema";
import { officialDomains } from "@/lib/research/research-budget";

export type { CatalogLevel };

export function detectDegreeLevel(value: string): CatalogLevel | null {
  return detectTargetDegreeLevel(value.replace(/https?:\/\/\S+/gi, " "));
}

export function catalogLevel(value: string): CatalogLevel | null {
  const hay = value.trim().toLowerCase();
  if (hay === "bachelor" || hay === "master" || hay === "single-cycle" || hay === "phd") return hay;
  return detectDegreeLevel(hay);
}

export const INDEX_LINK_LIMIT = 3;
export const DISCOVERY_QUERY_LIMIT = 4;

export function normalizeTitle(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/master's|masters/g, "master")
    .replace(/bachelor's/g, "bachelor")
    .replace(/\bprogrammes?\b/g, "program")
    .replace(/\bcorsi\b/g, "corso")
    .replace(/[()[\]{}"“”'`]/g, " ")
    .replace(/[-–—_/]+/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function splitCatalogueTitle(name: string) {
  const match = name.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  return {
    programmeName: (match?.[1] || name).trim(),
    curriculumOrTrack: match?.[2]?.trim() || null,
  };
}

export function degreeClass(value: string) {
  return value.match(/\b((?:LM|L)-\d{1,3})\b/i)?.[1]?.toUpperCase() ?? null;
}

export function officialEnglishTitle(value: string) {
  return value.match(/(?:english title|titolo inglese|denominazione inglese)\s*:\s*([^.\n]{3,140})/i)?.[1]?.trim() ?? null;
}

const ITALIAN_TITLE_WORDS: Record<string, string> = {
  and: "e",
  medicine: "medicina",
  surgery: "chirurgia",
  dentistry: "odontoiatria",
  pharmacy: "farmacia",
  nursing: "infermieristica",
  architecture: "architettura",
  psychology: "psicologia",
  law: "giurisprudenza",
};

function capitalise(value: string) {
  return value ? `${value[0]?.toUpperCase() ?? ""}${value.slice(1)}` : value;
}

/**
 * Italian search phrases for finding official pages. Built from the catalogue Italian title or a
 * word-for-word dictionary that gives up on any unknown word. Never an alias or a verified title.
 */
export function searchTitleVariants(subject: Pick<ResearchSubject, "name" | "language" | "italianTitle">) {
  const parts = splitCatalogueTitle(subject.name);
  const variants: string[] = [];
  const catalogue = subject.italianTitle?.trim();
  if (catalogue) variants.push(catalogue);
  const words = parts.programmeName.toLowerCase().split(/\s+/).filter(Boolean);
  const translated = words.every((word) => ITALIAN_TITLE_WORDS[word])
    ? words.map((word) => ITALIAN_TITLE_WORDS[word]).map((word) => (word === "e" ? word : capitalise(word))).join(" ")
    : "";
  const englishTaught = /english|inglese/i.test(subject.language ?? "");
  if (translated) {
    variants.push(translated);
    if (englishTaught) variants.push(`${translated} in lingua inglese`);
  }
  const target = normalizeTitle(parts.programmeName);
  const seen = new Set<string>();
  return variants.filter((item) => {
    const key = normalizeTitle(item);
    if (!key || key === target || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 3);
}

export function buildDiscoveryQueries(subject: Pick<ResearchSubject, "name" | "level" | "universityWebsite" | "admissionPortal"> & Partial<Pick<ResearchSubject, "language" | "italianTitle">>) {
  const domain = officialDomains(subject)[0];
  if (!domain) return [];
  const parts = splitCatalogueTitle(subject.name);
  const variant = searchTitleVariants({ name: subject.name, language: subject.language ?? "", italianTitle: subject.italianTitle ?? null })[0];
  const levelWord = subject.level === "master"
    ? "laurea magistrale"
    : subject.level === "bachelor"
      ? "laurea"
      : subject.level === "single-cycle"
        ? "ciclo unico"
        : subject.level;
  return [
    `site:${domain} "${parts.programmeName}"`,
    parts.curriculumOrTrack ? `site:${domain} "${parts.curriculumOrTrack}"` : "",
    variant ? `site:${domain} "${variant}"` : "",
    `site:${domain} "${parts.programmeName}" ${levelWord}`,
    `site:${domain} "${parts.programmeName}" bando di ammissione extra-UE`,
  ].filter(Boolean).slice(0, DISCOVERY_QUERY_LIMIT);
}

export function isDiscoveryCandidate(target: { name: string; verifiedTitles?: readonly string[] | null }, source: { title: string; pageText?: string }) {
  const blob = normalizeTitle(`${source.title} ${source.pageText ?? ""} ${officialEnglishTitle(source.pageText ?? "") ?? ""}`);
  const parts = splitCatalogueTitle(target.name);
  const names = [normalizeTitle(parts.programmeName), ...(target.verifiedTitles ?? []).map((item) => normalizeTitle(item))].filter((item) => item.length > 3);
  const track = parts.curriculumOrTrack ? normalizeTitle(parts.curriculumOrTrack) : "";
  if (names.some((name) => blob.includes(name))) return true;
  if (track.length > 3 && blob.includes(track)) return true;
  return false;
}

export function scoreCandidate(
  source: { url: string; title: string; pageText?: string },
  target: { name: string; universityName: string; level: string },
) {
  const blob = `${source.url} ${source.title} ${source.pageText ?? ""}`;
  const expected = catalogLevel(target.level);
  const detected = detectDegreeLevel(blob);
  let score = 0;
  if (universityPresent(target.universityName, blob)) score += 3;
  if (expected && detected === expected) score += 4;
  if (expected && detected && detected !== expected) score -= 8;
  if (isDiscoveryCandidate(target, source)) score += 3;
  if (degreeClass(blob) && detected === expected) score += 2;
  if (/laurea|\/corsi\/|course|didattica|orienta|programme/i.test(source.url)) score += 3;
  if (/\.pdf($|\?)/i.test(source.url)) score -= 5;
  if (/\/news\/|\/notizie\/|\/eventi\/|\/avvisi\/|articolo/i.test(source.url)) score -= 6;
  return score;
}

export function universityPresent(universityName: string, value: string) {
  const hay = normalizeTitle(value);
  return normalizeTitle(universityName)
    .split(" ")
    .filter((token) => token.length > 3 && !["university", "universita", "degli", "studi", "della"].includes(token))
    .some((token) => hay.includes(token));
}

export function programmeLinksFromIndex(html: string, domain: string, limit = INDEX_LINK_LIMIT) {
  const found: string[] = [];
  for (const match of html.matchAll(/href="([^"]+)"/gi)) {
    let url = match[1];
    if (url.startsWith("/")) url = `https://${domain}${url}`;
    if (!url.includes(domain)) continue;
    if (/\/news\/|\/notizie\/|\/eventi\/|\/avvisi\//i.test(url)) continue;
    if (!/laurea|\/corsi\/|corsi-di-studio|course|didattica|orienta|programme/i.test(url)) continue;
    if (!found.includes(url)) found.push(url);
    if (found.length >= limit) break;
  }
  return found;
}

export function identityQualityCounts(rows: Array<{ reviewStatus: string | null }>, translatedAliasConfirmed = 0) {
  const degreeLevelMismatch = rows.filter((row) => row.reviewStatus === "catalogue_review_required").length;
  return {
    identityReviewRequired: degreeLevelMismatch,
    programmeNotFound: rows.filter((row) => row.reviewStatus === "research_incomplete_identity").length,
    degreeLevelMismatch,
    translatedAliasConfirmed,
  };
}

export function sameLevel(expected: CatalogLevel | null, detected: CatalogLevel | null) {
  return Boolean(expected && detected && expected === detected);
}
