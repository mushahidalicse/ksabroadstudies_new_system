import type { SourceType } from "@/lib/programme-enrichment";
import { catalogLevel, normalizeTitle, splitCatalogueTitle } from "@/lib/research/discovery";
import { officialTargetBlock, safeFetch, type OfficialFetch } from "@/lib/research/fetch-safety";
import { sourceDecision } from "@/lib/research/identity-gate";
import { ageMs, HEALTHY_ROOT_MS, officialHostCooling, recordRootHealth, rootRole, TLS_RETRY_MS, type OfficialRootCache, type RootRole, type RootVia } from "@/lib/research/official-roots";
import { officialDomains } from "@/lib/research/research-budget";
import type { DiscoveryMethod, DiscoveryTraceEntry, ResearchSubject, UrlDiscoveryTrigger } from "@/lib/research/research-schema";
import { pageLinksFromHtml, selectAdmissionLinks, type PageLink } from "@/lib/research/page-links";
import { rememberUniversityFingerprint, type UniversityFingerprintCache } from "@/lib/research/university-identity";

export const DISCOVERY_LIMITS = {
  sitemapFiles: 2,
  indexPages: 2,
  candidateLinks: 3,
  sitemapLocs: 2000,
  indexLinks: 80,
  hintPages: 2,
};

type RankedCandidate = {
  url: string;
  anchor: string;
  method: DiscoveryMethod;
  score: number;
  tokenHits: number;
  stemHits: number;
  levelMatch: boolean;
  levelConflict: boolean;
  pdf: boolean;
  news: boolean;
  priority: number;
  sourceType: SourceType;
  scope: "programme" | "department" | "university";
};

export type DiscoveredPage = {
  url: string;
  title: string;
  text: string;
  html: string;
  readable: boolean;
  sourceType: SourceType;
  language: "en" | "it" | "other";
  scope: "programme" | "department" | "university";
  method: DiscoveryMethod;
  score: number;
  identityEvidence: string[];
  pageLinks: PageLink[];
};

export type OfficialDiscovery = {
  pages: DiscoveredPage[];
  trace: DiscoveryTraceEntry[];
  fetches: number;
  urlDiscoveryNeeded: boolean;
  urlDiscoveryTrigger: UrlDiscoveryTrigger | null;
  eligibleCandidates: number;
  hints: { candidates: string[]; seeds: string[]; rejected: string[] };
};

const STOP = new Set(["and", "the", "for", "with", "from", "dei", "degli", "delle", "della", "dello", "del", "programme", "program", "corso", "laurea", "magistrale", "master", "bachelor", "degree"]);

const STEMS: Record<string, string[]> = {
  applied: ["applicat"],
  computer: ["informat"],
  science: ["scienz"],
  machine: ["macchin"],
  learning: ["apprend"],
  data: ["dati"],
  business: ["aziend"],
  international: ["internazional"],
  engineering: ["ingegner"],
  medicine: ["medicin"],
  surgery: ["chirurg"],
  dentistry: ["odontoiatr"],
  pharmacy: ["farmac"],
  nursing: ["infermier"],
  architecture: ["architett"],
  psychology: ["psicolog"],
  economics: ["econom"],
  finance: ["finanz"],
  politics: ["polit"],
  relations: ["relazion"],
  accounting: ["contabil", "ragion"],
  management: ["gestion"],
  global: ["global"],
};

function decodeText(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export function readableDocument(html: string) {
  const title = decodeText(html.match(/<title[^>]*>([^<]{0,180})/i)?.[1] ?? "");
  const stripped = html
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<nav\b[\s\S]*?<\/nav>/gi, " ")
    .replace(/<footer\b[\s\S]*?<\/footer>/gi, " ")
    .replace(/<header\b[\s\S]*?<\/header>/gi, " ")
    .replace(/<aside\b[\s\S]*?<\/aside>/gi, " ")
    .replace(/<[^>]+\brole=["']navigation["'][^>]*>[\s\S]*?<\/(?:div|ul|section|nav)>/gi, " ")
    .replace(/<(div|section|aside)\b[^>]*(cookie|consent|banner)[^>]*>[\s\S]*?<\/\1>/gi, " ");
  const main = stripped.match(/<main\b[\s\S]*?<\/main>/i)?.[0]
    ?? stripped.match(/<article\b[\s\S]*?<\/article>/i)?.[0]
    ?? stripped;
  const h1 = decodeText(main.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1]?.replace(/<[^>]+>/g, " ") ?? "");
  const headings = [...main.matchAll(/<h2\b[^>]*>([\s\S]*?)<\/h2>/gi)].map((match) => decodeText(match[1].replace(/<[^>]+>/g, " "))).join(" ");
  const meta = decodeText(html.match(/<meta\b[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i)?.[1]
    ?? html.match(/<meta\b[^>]*content=["']([^"']*)["'][^>]*name=["']description["']/i)?.[1]
    ?? "");
  const body = decodeText(main.replace(/<[^>]+>/g, " "));
  const text = [h1, headings, meta, body].filter(Boolean).join(" ").replace(/\s+/g, " ").trim().slice(0, 12000);
  return { title: h1 || title, text };
}

export function officialSiteRoots(subject: Pick<ResearchSubject, "universityWebsite" | "admissionPortal">) {
  const roots: string[] = [];
  for (const raw of [subject.universityWebsite, subject.admissionPortal]) {
    if (!raw) continue;
    try {
      const url = new URL(raw);
      if (url.protocol !== "http:" && url.protocol !== "https:") continue;
      if (!roots.includes(url.origin)) roots.push(url.origin);
    } catch {
      continue;
    }
  }
  return roots.slice(0, DISCOVERY_LIMITS.sitemapFiles);
}

function programmeTokens(name: string) {
  const parts = splitCatalogueTitle(name);
  return normalizeTitle(`${parts.programmeName} ${parts.curriculumOrTrack ?? ""}`)
    .split(" ")
    .filter((token) => token.length >= 3 && !STOP.has(token));
}

function urlLevel(value: string) {
  const path = value.toLowerCase();
  if (/ciclo-unico|single-cycle/.test(path)) return "single-cycle" as const;
  if (/dottorato|\/phd\//.test(path)) return "phd" as const;
  if (/laurea-magistrale|lauree-magistrali/.test(path)) return "master" as const;
  if (/laurea-triennale|lauree-triennali/.test(path)) return "bachelor" as const;
  return null;
}

function isPdf(url: string) {
  return /\.pdf($|\?)/i.test(url);
}

function isNews(url: string) {
  return /\/news\/|\/notizie\/|\/eventi\/|\/avvisi\/|articolo/i.test(url);
}

function isIndexPath(pathname: string) {
  return /^\/(corsi|courses|course-catalogue|catalogo|programmes|programs|offerta-formativa|didattica|laurea-magistrale|laurea-triennale)\/?$/i.test(pathname);
}

const COURSE_INDEX_SEGMENT = /^(corsi|corsi-di-studio|corsi-di-laurea|corsi-di-laurea-magistrale|offerta-formativa|offerta-didattica|courses|degree-programmes|degree-programs|study-programmes)$/i;

/** A bounded course listing such as /didattica/corsi-di-studio. Used to follow links, never to confirm. */
export function isCourseIndexPath(pathname: string) {
  if (isIndexPath(pathname)) return true;
  const segments = pathname.split("/").filter(Boolean);
  if (!segments.length || segments.length > 3) return false;
  return COURSE_INDEX_SEGMENT.test(segments[segments.length - 1] ?? "");
}

function candidateKind(url: string): Pick<RankedCandidate, "priority" | "sourceType" | "scope"> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { priority: 8, sourceType: "other_official_source", scope: "university" };
  }
  const path = `${parsed.hostname}${parsed.pathname}`.toLowerCase();
  if (isNews(url)) return { priority: 90, sourceType: "other_official_source", scope: "university" };
  if (/bando|ammissione|admission/.test(path)) return { priority: 4, sourceType: "official_admission_call", scope: "programme" };
  if (/regolamento|regulation|didattico/.test(path) || isPdf(url)) return { priority: 3, sourceType: isPdf(url) ? "official_pdf" : "official_university_regulation", scope: "programme" };
  if (/^international\.|\/international\//.test(path)) return { priority: 5, sourceType: "official_programme_page", scope: "programme" };
  if (/dipartimento|\/department\//.test(path)) return { priority: 6, sourceType: "other_official_source", scope: "department" };
  if (isIndexPath(parsed.pathname) || (/orienta/.test(parsed.hostname) && isIndexPath(parsed.pathname))) {
    return { priority: 2, sourceType: "official_programme_page", scope: "university" };
  }
  if (/laurea|\/corsi\/|corsi-di-studio|\/all-courses\/|course|didattica|programme|orienta|offerta-formativa/i.test(path)) return { priority: 1, sourceType: "official_programme_page", scope: "programme" };
  return { priority: 7, sourceType: "other_official_source", scope: "university" };
}

export function scoreOfficialCandidate(url: string, anchor: string, subject: Pick<ResearchSubject, "name" | "level">) {
  const blob = normalizeTitle(`${url} ${anchor}`);
  const tokens = programmeTokens(subject.name);
  const tokenHits = tokens.filter((token) => blob.includes(token)).length;
  const stemHits = tokens.filter((token) => (STEMS[token] ?? []).some((stem) => blob.includes(stem))).length;
  const expected = catalogLevel(subject.level);
  const detected = urlLevel(url);
  const levelMatch = Boolean(expected && detected === expected);
  const levelConflict = Boolean(expected && detected && detected !== expected);
  const kind = candidateKind(url);
  let score = tokenHits * 3 + stemHits * 2 + (8 - Math.min(kind.priority, 8));
  if (levelMatch) score += 4;
  if (levelConflict) score -= 8;
  if (isPdf(url)) score -= 5;
  if (isNews(url)) score -= 6;
  return { score, tokenHits, stemHits, levelMatch, levelConflict, ...kind, pdf: isPdf(url), news: isNews(url) };
}

function isStrong(candidate: ReturnType<typeof scoreOfficialCandidate>) {
  return !candidate.pdf && !candidate.news && !candidate.levelConflict && candidate.score >= 8
    && (candidate.tokenHits >= 2 || (candidate.stemHits >= 2 && candidate.levelMatch));
}

function isEligible(candidate: ReturnType<typeof scoreOfficialCandidate>) {
  if (candidate.news && candidate.tokenHits < 2) return false;
  return candidate.tokenHits >= 1 || candidate.stemHits >= 2 || (candidate.stemHits >= 1 && (candidate.levelMatch || candidate.levelConflict));
}

function compareCandidates(left: RankedCandidate, right: RankedCandidate) {
  if (left.pdf !== right.pdf) return left.pdf ? 1 : -1;
  if (left.priority !== right.priority) return left.priority - right.priority;
  return right.score - left.score;
}

function xmlLocs(xml: string) {
  return [...xml.matchAll(/<loc>\s*([^<]+)\s*<\/loc>/gi)]
    .map((match) => decodeText(match[1]))
    .filter((loc) => /^https?:\/\//i.test(loc))
    .slice(0, DISCOVERY_LIMITS.sitemapLocs);
}

function isSitemapLoc(url: string) {
  return /\.xml($|\?)/i.test(url);
}

function sitemapRank(url: string) {
  if (/corsi|course|laurea|didattica|programma|program/i.test(url)) return 3;
  if (/news|eventi|avvisi|notizie/i.test(url)) return -3;
  return 0;
}

const ADMISSION_LINK = /ammissione|accesso|bando|candidatura|international|foreign|extra-?ue|non-eu|universitaly|pre-?iscrizion|titolo-estero|studenti-internazionali/i;

export function parseOfficialDocument(html: string, url: string, domains: string[]) {
  const pageLinks = pageLinksFromHtml(html, url, domains);
  const document = readableDocument(html);
  return { title: document.title, text: document.text, html: html.slice(0, 20000), pageLinks };
}

export function internationalAdmissionLinksFromHtml(html: string, base: string, domains: string[], limit = DISCOVERY_LIMITS.candidateLinks) {
  return selectAdmissionLinks(pageLinksFromHtml(html, base, domains), {
    kinds: ["international", "foreign_qualification", "visa_pre_enrolment"],
    limit,
  }).map((link) => link.href);
}

export function admissionLinksFromHtml(html: string, base: string, domains: string[], limit = 3) {
  const found: Array<{ url: string; pdf: boolean }> = [];
  for (const link of linksFromHtml(html, base, domains)) {
    let parsed: URL;
    try {
      parsed = new URL(link.url);
    } catch {
      continue;
    }
    const blob = `${parsed.pathname} ${link.anchor}`;
    if (!ADMISSION_LINK.test(blob) || isNews(link.url)) continue;
    if (found.some((item) => item.url === link.url)) continue;
    found.push({ url: link.url, pdf: isPdf(link.url) });
  }
  return found.sort((left, right) => Number(left.pdf) - Number(right.pdf)).slice(0, limit).map((item) => item.url);
}

function linksFromHtml(html: string, base: string, domains: string[]) {
  const links: Array<{ url: string; anchor: string }> = [];
  for (const match of html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    if (match[1].startsWith("#") || /^mailto:|^javascript:/i.test(match[1])) continue;
    let url = "";
    try {
      url = new URL(match[1], base).toString();
    } catch {
      continue;
    }
    if (officialTargetBlock(url, domains)) continue;
    const anchor = decodeText(match[2].replace(/<[^>]+>/g, " "));
    if (!links.some((link) => link.url === url)) links.push({ url, anchor });
    if (links.length >= DISCOVERY_LIMITS.indexLinks) break;
  }
  return links;
}

function remember(candidates: RankedCandidate[], url: string, anchor: string, method: DiscoveryMethod, subject: Pick<ResearchSubject, "name" | "level">) {
  if (candidates.some((item) => item.url === url) || isSitemapLoc(url) || isIndexPath(new URL(url).pathname)) return;
  const scored = scoreOfficialCandidate(url, anchor, subject);
  if (!isEligible(scored)) return;
  candidates.push({ url, anchor, method, ...scored });
}

function pageLanguage(url: string, text: string): "en" | "it" | "other" {
  const italian = (text.match(/\b(laurea|immatricolazione|requisiti|curriculari|classe|corso|lingua)\b/gi) || []).length;
  const english = (text.match(/\b(bachelor|admission|requirement|curriculum|language of instruction)\b/gi) || []).length;
  if (italian > english) return "it";
  if (english > italian) return "en";
  if (/\/en\/|international\./i.test(url)) return "en";
  return "other";
}

export function identityEvidenceLabels(subject: Pick<ResearchSubject, "name" | "universityName" | "level" | "universityWebsite" | "admissionPortal">, title: string, text: string, url?: string) {
  const decision = sourceDecision(subject, `${title}\n${text}`, url);
  const labels: string[] = [];
  if (decision.universityMatched) labels.push("university");
  if (decision.detected) labels.push("degree-level");
  if (decision.classCode) labels.push("degree-class");
  if (decision.basePresent || decision.translationConfirmed) labels.push("programme-title");
  if (decision.trackPresent) labels.push("curriculum");
  return labels;
}

function searchRequest(html: string, pageUrl: string, query: string, domains: string[]) {
  const form = html.match(/<form\b[^>]*>[\s\S]*?<\/form>/i)?.[0];
  if (!form || /method=["']post["']/i.test(form)) return null;
  const action = form.match(/action=["']([^"']+)["']/i)?.[1] ?? pageUrl;
  const field = [...form.matchAll(/<input\b[^>]*name=["']([^"']+)["'][^>]*>/gi)]
    .map((match) => match[1])
    .find((name) => /^(q|s|search|query|k)$/i.test(name));
  if (!field) return null;
  try {
    const url = new URL(action, pageUrl);
    if (officialTargetBlock(url.toString(), domains)) return null;
    url.searchParams.set(field, query);
    return url.toString();
  } catch {
    return null;
  }
}

export function selectableRoots(
  subject: Pick<ResearchSubject, "universityWebsite" | "admissionPortal">,
  cache: OfficialRootCache,
  now: number,
) {
  const domain = officialDomains(subject)[0];
  if (!domain) return [];
  const cached = cache.read(domain);
  const freshFail = new Set(cached.filter((row) => row.state === "tls_unavailable" && ageMs(row, now) < TLS_RETRY_MS).map((row) => row.origin));
  const fresh = cached.filter((row) => row.state === "healthy" && ageMs(row, now) < HEALTHY_ROOT_MS);
  const healthy = fresh.filter((row) => !row.via).map((row) => row.origin);
  const learned = fresh.filter((row) => row.via).map((row) => row.origin);
  const catalogue = officialSiteRoots(subject).filter((origin) => !freshFail.has(origin));
  const merged: string[] = [];
  for (const origin of [...healthy, ...catalogue, ...learned]) {
    if (!merged.includes(origin) && !freshFail.has(origin)) merged.push(origin);
  }
  if (!merged.length) {
    const retry = cached
      .filter((row) => row.state === "tls_unavailable" && ageMs(row, now) >= TLS_RETRY_MS)
      .sort((left, right) => Date.parse(left.lastChecked) - Date.parse(right.lastChecked));
    if (retry[0]) merged.push(retry[0].origin);
  }
  return merged.slice(0, DISCOVERY_LIMITS.sitemapFiles);
}

/**
 * Catalogue hints become fetch targets only. A programme URL is a candidate page to read;
 * an apply URL on a host that is not already a root seeds a bounded course-index crawl.
 * Off-family URLs are rejected. Nothing here confirms identity.
 */
export function trustedDiscoveryHints(
  subject: Pick<ResearchSubject, "universityWebsite" | "admissionPortal" | "discoveryHints">,
  roots: string[],
) {
  const domains = officialDomains(subject);
  const knownOrigins = new Set([...roots, ...officialSiteRoots(subject)]);
  const result = { candidates: [] as string[], seeds: [] as string[], rejected: [] as string[] };
  const ordered = [...(subject.discoveryHints ?? [])].sort((left, right) => Number(left.kind !== "programme_url") - Number(right.kind !== "programme_url"));
  for (const hint of ordered) {
    let parsed: URL;
    try {
      parsed = new URL(hint.url);
    } catch {
      result.rejected.push(hint.url);
      continue;
    }
    const href = parsed.toString();
    if (!domains.length || officialTargetBlock(href, domains)) {
      result.rejected.push(hint.url);
      continue;
    }
    if (result.candidates.includes(href) || result.seeds.includes(href)) continue;
    if (hint.kind === "programme_url") result.candidates.push(href);
    else if (!knownOrigins.has(parsed.origin)) result.seeds.push(href);
  }
  return result;
}

function navigationRole(context: string, url: string): RootRole {
  let origin = "";
  try {
    origin = new URL(url).origin;
  } catch {
    return "other";
  }
  const byHost = rootRole(origin);
  if (byHost !== "other" && byHost !== "main") return byHost;
  const blob = `${context} ${url}`.toLowerCase();
  if (/scuola|school|facolt|faculty/.test(blob)) return "school";
  if (/dipartiment|department/.test(blob)) return "department";
  if (/corsi|course|didattica|programme|offerta-formativa/.test(blob)) return "catalogue";
  return byHost;
}

function diversifyHosts(ranked: RankedCandidate[], limit: number) {
  const picked: RankedCandidate[] = [];
  const seenHost = new Set<string>();
  for (const item of ranked) {
    const host = new URL(item.url).hostname;
    if (seenHost.has(host)) continue;
    seenHost.add(host);
    picked.push(item);
    if (picked.length >= limit) return picked.map((chosen) => chosen.url);
  }
  for (const item of ranked) {
    if (picked.some((chosen) => chosen.url === item.url)) continue;
    picked.push(item);
    if (picked.length >= limit) break;
  }
  return picked.map((chosen) => chosen.url);
}

export function orderedOfficialUrls(
  subject: Pick<ResearchSubject, "name" | "level" | "universityWebsite" | "admissionPortal">,
  urls: string[],
  options: { cache?: OfficialRootCache; now?: number } = {},
) {
  const domains = officialDomains(subject);
  const ranked: RankedCandidate[] = [];
  for (const url of urls) {
    if (!domains.length || officialTargetBlock(url, domains)) continue;
    remember(ranked, url, "", "openai_web_search", subject);
  }
  const now = options.now ?? Date.now();
  const domain = domains[0] ?? "";
  const cooling = (url: string) => Boolean(options.cache && domain && officialHostCooling(options.cache, domain, url, now));
  const fresh = ranked.filter((item) => !cooling(item.url)).sort(compareCandidates);
  const cooled = ranked.filter((item) => cooling(item.url)).sort(compareCandidates);
  const chosen = diversifyHosts(fresh, DISCOVERY_LIMITS.candidateLinks);
  if (chosen.length) return chosen;
  return diversifyHosts(cooled, DISCOVERY_LIMITS.candidateLinks);
}

export async function loadOfficialPage(url: string, domains: string[], fetchImpl: OfficialFetch) {
  const response = await safeFetch(url, domains, fetchImpl);
  if (response.rejected || !response.ok || isPdf(url) || response.contentType.includes("pdf")) {
    return { url, title: url, text: "", html: "", pageLinks: [] as PageLink[], readable: false, rejected: response.rejected };
  }
  const parsed = parseOfficialDocument(response.body, response.url, domains);
  return {
    url: response.url,
    title: parsed.title || url,
    text: parsed.text,
    html: parsed.html,
    pageLinks: parsed.pageLinks,
    readable: parsed.text.length > 0,
    rejected: null as null,
  };
}

export async function discoverOfficialCandidates(
  subject: Pick<ResearchSubject, "name" | "universityName" | "level" | "universityWebsite" | "admissionPortal" | "discoveryHints">,
  fetchImpl: OfficialFetch = fetch,
  options: { cache?: OfficialRootCache; now?: number; universityCache?: UniversityFingerprintCache } = {},
): Promise<OfficialDiscovery> {
  const domains = officialDomains(subject);
  const cache = options.cache;
  const now = options.now ?? Date.now();
  const roots = cache ? selectableRoots(subject, cache, now) : officialSiteRoots(subject);
  const hints = trustedDiscoveryHints(subject, roots);
  const candidates: RankedCandidate[] = [];
  const trace: DiscoveryTraceEntry[] = [];
  const tlsHosts = new Set<string>();
  const navigated = new Map<string, { role: RootRole; via: RootVia }>();
  let fetches = 0;
  let pagesFetched = 0;
  const empty = { pages: [], trace, fetches, urlDiscoveryNeeded: false, urlDiscoveryTrigger: null, eligibleCandidates: 0, hints };
  const noteUniversity = (pageUrl: string, html: string) => {
    if (!options.universityCache || !domains[0] || !html) return;
    rememberUniversityFingerprint(options.universityCache, { catalogueName: subject.universityName, registeredDomain: domains[0], pageUrl, html });
  };
  if (!domains.length) return empty;
  if (!roots.length) return { ...empty, urlDiscoveryNeeded: true, urlDiscoveryTrigger: "other_existing_reason" };

  const noteHost = (url: string, response: { rejected: "scheme" | "host" | "redirect" | "tls" | null; status: number }) => {
    let origin = "";
    try {
      origin = new URL(url).origin;
    } catch {
      return;
    }
    const learned = navigated.get(origin);
    if (response.rejected === "tls") {
      if (cache) recordRootHealth(cache, domains[0], origin, "tls_unavailable", now, learned);
      if (!tlsHosts.has(origin)) {
        tlsHosts.add(origin);
        trace.push({ method: "sitemap", url: origin, score: 0, opened: false, identityEvidence: ["tls_unavailable"] });
      }
      return;
    }
    if (response.status >= 200 && response.status < 400) pagesFetched += 1;
    if (cache && response.status > 0) recordRootHealth(cache, domains[0], origin, "healthy", now, learned);
  };
  const learnLinkedHost = (link: { url: string; anchor: string }, pageUrl: string) => {
    let origin = "";
    let pageOrigin = "";
    try {
      origin = new URL(link.url).origin;
      pageOrigin = new URL(pageUrl).origin;
    } catch {
      return;
    }
    if (origin === pageOrigin || roots.includes(origin) || navigated.has(origin)) return;
    navigated.set(origin, { role: navigationRole(link.anchor, link.url), via: "official_navigation" });
  };
  const followIndex = (html: string, pageUrl: string, queue: string[], seen: Set<string>) => {
    for (const link of linksFromHtml(html, pageUrl, domains)) {
      learnLinkedHost(link, pageUrl);
      if (isCourseIndexPath(new URL(link.url).pathname) && !seen.has(link.url) && !queue.includes(link.url) && queue.length < 4) queue.push(link.url);
      else remember(candidates, link.url, link.anchor, "course_index", subject);
    }
  };

  for (const url of hints.candidates) {
    if (candidates.some((item) => item.url === url)) continue;
    const scored = scoreOfficialCandidate(url, "", subject);
    candidates.push({ url, anchor: "", method: "catalogue_hint", ...scored, priority: 0 });
  }

  if (hints.seeds.length && !candidates.some(isStrong)) {
    const hintQueue = [...hints.seeds];
    const seenHint = new Set<string>();
    let hintPages = 0;
    while (hintQueue.length && hintPages < DISCOVERY_LIMITS.hintPages && !candidates.some(isStrong)) {
      const next = hintQueue.shift();
      if (!next || seenHint.has(next) || officialTargetBlock(next, domains)) continue;
      seenHint.add(next);
      hintPages += 1;
      fetches += 1;
      const response = await safeFetch(next, domains, fetchImpl);
      if (hints.seeds.includes(next) && !navigated.has(new URL(next).origin)) {
        navigated.set(new URL(next).origin, { role: navigationRole(readableDocument(response.body).title, next), via: "catalogue_hint" });
      }
      noteHost(next, response);
      if (!response.ok) continue;
      noteUniversity(response.url, response.body);
      followIndex(response.body, response.url, hintQueue, seenHint);
    }
  }

  const queue = roots.flatMap((root) => [`${root}/sitemap.xml`, `${root}/sitemap_index.xml`]);
  const seenSitemaps = new Set<string>();
  let sitemapFiles = 0;
  while (queue.length && sitemapFiles < DISCOVERY_LIMITS.sitemapFiles && !candidates.some(isStrong)) {
    const next = queue.shift();
    if (!next || seenSitemaps.has(next)) continue;
    seenSitemaps.add(next);
    sitemapFiles += 1;
    fetches += 1;
    const response = await safeFetch(next, domains, fetchImpl);
    noteHost(next, response);
    if (!response.ok) continue;
    const children: string[] = [];
    for (const loc of xmlLocs(response.body)) {
      if (officialTargetBlock(loc, domains)) continue;
      if (isSitemapLoc(loc)) children.push(loc);
      else remember(candidates, loc, "", "sitemap", subject);
    }
    if (children.length && sitemapFiles < DISCOVERY_LIMITS.sitemapFiles) {
      children.sort((left, right) => sitemapRank(right) - sitemapRank(left));
      queue.unshift(children[0]);
    }
  }

  const indexHtml: string[] = [];
  const indexBases: string[] = [];
  if (!candidates.some(isStrong)) {
    const indexQueue = roots.map((root) => `${root}/`);
    const seenIndex = new Set<string>();
    let indexPages = 0;
    while (indexQueue.length && indexPages < DISCOVERY_LIMITS.indexPages) {
      const next = indexQueue.shift();
      if (!next || seenIndex.has(next) || officialTargetBlock(next, domains)) continue;
      seenIndex.add(next);
      indexPages += 1;
      fetches += 1;
      const response = await safeFetch(next, domains, fetchImpl);
      noteHost(next, response);
      if (!response.ok) continue;
      noteUniversity(response.url, response.body);
      indexHtml.push(response.body);
      indexBases.push(response.url);
      followIndex(response.body, response.url, indexQueue, seenIndex);
    }
  }

  if (!candidates.some(isStrong)) {
    const parts = splitCatalogueTitle(subject.name);
    const query = `${parts.programmeName} ${parts.curriculumOrTrack ?? ""}`.trim();
    for (let index = 0; index < indexHtml.length; index += 1) {
      const request = searchRequest(indexHtml[index], indexBases[index], query, domains);
      if (!request) continue;
      fetches += 1;
      const response = await safeFetch(request, domains, fetchImpl);
      noteHost(request, response);
      if (!response.ok) break;
      for (const link of linksFromHtml(response.body, response.url, domains)) remember(candidates, link.url, link.anchor, "internal_search", subject);
      break;
    }
  }

  const selected = [...candidates].sort(compareCandidates).slice(0, DISCOVERY_LIMITS.candidateLinks);
  const pages: DiscoveredPage[] = [];
  for (const candidate of selected) {
    fetches += 1;
    const loaded = await loadOfficialPage(candidate.url, domains, fetchImpl);
    if (!loaded.rejected && !loaded.readable) navigated.delete(new URL(candidate.url).origin);
    noteHost(candidate.url, { rejected: loaded.rejected, status: loaded.rejected ? 0 : 200 });
    if (loaded.rejected || !loaded.readable) {
      trace.push({
        method: candidate.method,
        url: candidate.url,
        score: candidate.score,
        opened: false,
        identityEvidence: loaded.rejected === "tls" ? ["found_unconfirmed_tls"] : loaded.rejected ? ["redirect-rejected"] : [],
      });
      continue;
    }
    const title = loaded.title || candidate.anchor || candidate.url;
    const identityEvidence = identityEvidenceLabels(subject, title, loaded.text, loaded.url);
    trace.push({ method: candidate.method, url: loaded.url, score: candidate.score, opened: true, identityEvidence });
    pages.push({
      url: loaded.url,
      title,
      text: loaded.text,
      html: loaded.html,
      readable: true,
      sourceType: candidate.sourceType,
      language: pageLanguage(loaded.url, loaded.text),
      scope: candidate.scope,
      method: candidate.method,
      score: candidate.score,
      identityEvidence,
      pageLinks: loaded.pageLinks,
    });
    noteUniversity(loaded.url, loaded.html);
  }
  let urlDiscoveryTrigger: UrlDiscoveryTrigger | null = null;
  if (pages.length === 0 && candidates.length === 0) {
    if (tlsHosts.size > 0) urlDiscoveryTrigger = "tls_unavailable";
    else if (pagesFetched === 0) urlDiscoveryTrigger = "no_discovery_pages";
    else urlDiscoveryTrigger = "zero_eligible_candidates";
  }
  return {
    pages,
    trace,
    fetches,
    urlDiscoveryNeeded: urlDiscoveryTrigger !== null,
    urlDiscoveryTrigger,
    eligibleCandidates: candidates.length,
    hints,
  };
}
