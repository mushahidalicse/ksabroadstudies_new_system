import { acceptedAdmissionEvents, admissionCandidateRank, admissionSourceScope, hasGeneralAdmissionDeadline, hasInternationalDeadline, hasUniversitalyDeadline, isAdmissionHub, isConfirmedProgrammeUrl } from "@/lib/research/admission-gates";
import { buildAdmissionPrompt, buildExtractionPrompt, buildResearchPrompt, buildUniversitalyPrompt, buildUrlDiscoveryPrompt, extractJson } from "@/lib/research/research-programme";
import { freezeConfirmedIdentity, identityFromSources, identityObservation } from "@/lib/research/identity-gate";
import { catalogLevel, detectDegreeLevel, programmeLinksFromIndex, scoreCandidate, splitCatalogueTitle } from "@/lib/research/discovery";
import { officialTargetBlock, type OfficialFetch } from "@/lib/research/fetch-safety";
import { DISCOVERY_LIMITS, discoverOfficialCandidates, loadOfficialPage, orderedOfficialUrls } from "@/lib/research/official-discovery";
import { admissionLinkKind, admissionPdfInventory, normalizeAdmissionUrl, rankHubTargetLinks, selectAdmissionLinks, type AdmissionLinkKind, type HubTarget, type PageLink } from "@/lib/research/page-links";
import { fileOfficialRootCache, officialHostCooling, recordRootHealth, type OfficialRootCache } from "@/lib/research/official-roots";
import { fileUniversityFingerprintCache, memoryUniversityFingerprintCache } from "@/lib/research/university-identity";
import { admissionSearchPasses, officialDomains, researchBudget, ResearchRateLimitError, urlDiscoveryPasses } from "@/lib/research/research-budget";
import type { AdmissionProgress, ConfirmedProgrammeIdentity, DiscoveryTraceEntry, IdentityConflict, ResearchSource, ResearchSubject, ResearchUsage, SearchCandidateDiagnostic, SearchRejectionReason } from "@/lib/research/research-schema";

export const HUB_LIMITS = { hubsPerStage: 1, linksConsidered: 3, linksOpened: 1 } as const;
const SEARCH_DIAGNOSTIC_LIMIT = 6;

const DEFAULT_MODEL = "gpt-5.5";

function responseText(body: unknown) {
  if (body && typeof body === "object" && typeof (body as { output_text?: unknown }).output_text === "string") {
    const direct = (body as { output_text: string }).output_text.trim();
    if (direct) return direct;
  }
  const output = body && typeof body === "object" && Array.isArray((body as { output?: unknown }).output)
    ? (body as { output: Array<Record<string, unknown>> }).output
    : [];
  const chunks: string[] = [];
  for (const item of output) {
    if (item.type !== "message" || !Array.isArray(item.content)) continue;
    for (const part of item.content) {
      if (part && typeof part === "object" && typeof (part as { text?: unknown }).text === "string") {
        chunks.push((part as { text: string }).text);
      }
    }
  }
  return chunks.join("\n");
}

function usageFrom(body: unknown): ResearchUsage {
  const output = body && typeof body === "object" && Array.isArray((body as { output?: unknown }).output)
    ? (body as { output: Array<{ type?: string }> }).output
    : [];
  const usage = body && typeof body === "object" ? (body as { usage?: Record<string, unknown> }).usage : undefined;
  const count = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : null);
  return {
    inputTokens: count(usage?.input_tokens),
    outputTokens: count(usage?.output_tokens),
    totalTokens: count(usage?.total_tokens),
    webSearchCalls: output.filter((item) => item?.type === "web_search_call").length,
    officialFetches: null,
    urlDiscoveryCalls: null,
    extractionCalls: null,
    admissionResearchCalls: null,
    universitalyResearchCalls: null,
  };
}

function addUsage(left: ResearchUsage, right: ResearchUsage): ResearchUsage {
  const sum = (a: number | null, b: number | null) => (a == null && b == null ? null : (a ?? 0) + (b ?? 0));
  return {
    inputTokens: sum(left.inputTokens, right.inputTokens),
    outputTokens: sum(left.outputTokens, right.outputTokens),
    totalTokens: sum(left.totalTokens, right.totalTokens),
    webSearchCalls: sum(left.webSearchCalls, right.webSearchCalls),
    officialFetches: sum(left.officialFetches, right.officialFetches),
    urlDiscoveryCalls: sum(left.urlDiscoveryCalls, right.urlDiscoveryCalls),
    extractionCalls: sum(left.extractionCalls, right.extractionCalls),
    admissionResearchCalls: sum(left.admissionResearchCalls, right.admissionResearchCalls),
    universitalyResearchCalls: sum(left.universitalyResearchCalls, right.universitalyResearchCalls),
    urlDiscoveryTrigger: left.urlDiscoveryTrigger ?? right.urlDiscoveryTrigger ?? null,
  };
}

function countStage(usage: ResearchUsage, field: "urlDiscoveryCalls" | "extractionCalls" | "admissionResearchCalls" | "universitalyResearchCalls") {
  return { ...usage, [field]: (usage[field] ?? 0) + 1 };
}

export function researchModel() {
  return process.env.OPENAI_RESEARCH_MODEL?.trim() || DEFAULT_MODEL;
}

function usesReasoning(model: string) {
  return /^gpt-5(\.|$|-)/.test(model) && !/search-api|chat-latest|codex|transcribe|tts/.test(model);
}

export function buildDiscoveryRequest(subject: ResearchSubject) {
  const budget = researchBudget();
  const domains = officialDomains(subject);
  const model = researchModel();
  const tool: Record<string, unknown> = { type: "web_search", search_context_size: budget.searchContext };
  if (domains.length) tool.filters = { allowed_domains: domains };
  const payload: Record<string, unknown> = {
    model,
    max_tool_calls: budget.maxToolCalls,
    max_output_tokens: budget.maxOutputTokens,
    tools: [tool],
    input: [{ role: "user", content: buildResearchPrompt(subject) }],
  };
  if (usesReasoning(model)) payload.reasoning = { effort: budget.reasoningEffort };
  return payload;
}

export function buildUrlDiscoveryRequest(subject: ResearchSubject, pass: 1 | 2) {
  const budget = researchBudget();
  const domains = officialDomains(subject);
  const model = researchModel();
  const tool: Record<string, unknown> = { type: "web_search", search_context_size: "low" };
  if (domains.length) tool.filters = { allowed_domains: domains };
  const payload: Record<string, unknown> = {
    model,
    max_tool_calls: 1,
    max_output_tokens: Math.min(budget.maxOutputTokens, 800),
    tools: [tool],
    input: [{ role: "user", content: buildUrlDiscoveryPrompt(subject, pass) }],
  };
  if (usesReasoning(model)) payload.reasoning = { effort: "low" };
  return payload;
}

function boundedSearchRequest(subject: ResearchSubject, content: string) {
  const budget = researchBudget();
  const domains = officialDomains(subject);
  const model = researchModel();
  const tool: Record<string, unknown> = { type: "web_search", search_context_size: "low" };
  if (domains.length) tool.filters = { allowed_domains: domains };
  const payload: Record<string, unknown> = {
    model,
    max_tool_calls: 1,
    max_output_tokens: Math.min(budget.maxOutputTokens, 800),
    tools: [tool],
    input: [{ role: "user", content }],
  };
  if (usesReasoning(model)) payload.reasoning = { effort: "low" };
  return payload;
}

export function buildAdmissionRequest(subject: ResearchSubject, pass: 1 | 2, aliases: string[] = []) {
  return boundedSearchRequest(subject, buildAdmissionPrompt(subject, aliases, pass));
}

export function buildUniversitalyRequest(subject: ResearchSubject, aliases: string[] = []) {
  return boundedSearchRequest(subject, buildUniversitalyPrompt(subject, aliases));
}

export function buildExtractionRequest(subject: ResearchSubject, sources: Array<{ url: string; title: string; text: string }>) {
  const budget = researchBudget();
  const model = researchModel();
  const payload: Record<string, unknown> = {
    model,
    max_output_tokens: budget.maxOutputTokens,
    input: [{ role: "user", content: buildExtractionPrompt(subject, sources) }],
  };
  if (usesReasoning(model)) payload.reasoning = { effort: budget.reasoningEffort };
  return payload;
}

async function postResponses(key: string, payload: Record<string, unknown>) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(180000),
  });
  if (response.status === 429) {
    const retryAfter = Number(response.headers.get("retry-after"));
    throw new ResearchRateLimitError("OpenAI research was rate limited. The catalogue was not changed.", Number.isFinite(retryAfter) ? retryAfter : null);
  }
  if (!response.ok) {
    let detail = "";
    try {
      const err = (await response.json()) as { error?: { code?: string; type?: string; message?: string } };
      const code = err.error?.code || err.error?.type || "";
      const message = (err.error?.message || "").replace(/sk-[A-Za-z0-9_-]+/g, "sk-[redacted]").replace(/Bearer\s+\S+/gi, "Bearer [redacted]");
      detail = [code, message].filter(Boolean).join(": ").slice(0, 300);
    } catch {
      detail = "";
    }
    throw new Error(`OpenAI research failed (${response.status}${detail ? `: ${detail}` : ""}). The catalogue was not changed.`);
  }
  return response.json() as Promise<unknown>;
}

type LoadedPage = {
  url: string;
  title: string;
  sourceType: unknown;
  language: unknown;
  text: string;
  readable: boolean;
  html: string;
  pageLinks: PageLink[];
  fromLink: boolean;
  linkedFrom?: string;
};

export type OpenAIResearchDeps = {
  fetchImpl?: OfficialFetch;
  postResponses?: (key: string, payload: Record<string, unknown>) => Promise<unknown>;
  rootCache?: OfficialRootCache;
  now?: number;
};

async function readOfficialPage(url: string, domains: string[], fetchImpl: OfficialFetch) {
  const loaded = await loadOfficialPage(url, domains, fetchImpl);
  return {
    url: loaded.url,
    title: loaded.title,
    text: loaded.text,
    readable: loaded.readable && !loaded.rejected,
    html: loaded.rejected ? "" : loaded.html,
    pageLinks: loaded.rejected ? [] : loaded.pageLinks,
    rejected: loaded.rejected,
  };
}

function gateSources(pages: LoadedPage[]) {
  return pages.map((page) => ({ url: page.url, title: page.title, pageText: page.text }));
}

function controlEvents(pages: Array<{ url: string; title: string; text: string }>, subject: ResearchSubject, identity: ConfirmedProgrammeIdentity) {
  return acceptedAdmissionEvents(pages, subject, identity);
}

function emptyPass(): AdmissionProgress["general"] {
  return {
    searchExecuted: false,
    candidatesReturned: 0,
    candidatesEligible: 0,
    candidatesOpened: 0,
    acceptedEvidenceFound: false,
    linksFound: 0,
    linksRelevant: 0,
    linksEligible: 0,
    linksOpened: 0,
    linkEvidenceAccepted: false,
  };
}

function pushCandidate(found: Array<{ url: string; title: string }>, url: unknown, title?: unknown) {
  const value = String(url ?? "").trim().replace(/[),.;]+$/, "");
  if (!/^https?:\/\//i.test(value) || found.some((item) => item.url === value)) return;
  found.push({ url: value, title: String(title ?? "Official source") });
}

function walkCandidates(value: unknown, found: Array<{ url: string; title: string }>, depth: number) {
  if (depth > 6 || value == null) return;
  if (typeof value === "string") {
    for (const match of value.matchAll(/https?:\/\/[^\s"'<>]+/g)) pushCandidate(found, match[0]);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) walkCandidates(item, found, depth + 1);
    return;
  }
  if (typeof value === "object") {
    const row = value as Record<string, unknown>;
    if (typeof row.url === "string") pushCandidate(found, row.url, row.title);
    for (const key of Object.keys(row)) walkCandidates(row[key], found, depth + 1);
  }
}

export function admissionCandidatesFromResponse(body: unknown) {
  const found: Array<{ url: string; title: string }> = [];
  const parsed = extractJson(responseText(body));
  if (parsed && typeof parsed === "object" && Array.isArray((parsed as { sources?: unknown }).sources)) {
    for (const source of (parsed as { sources: Array<Record<string, unknown>> }).sources) pushCandidate(found, source.url, source.title);
  }
  walkCandidates(body, found, 0);
  return found;
}

function planAdmissionCandidates(subject: ResearchSubject, body: unknown, cache: OfficialRootCache, now: number, identity: ConfirmedProgrammeIdentity) {
  const domains = officialDomains(subject);
  const all = admissionCandidatesFromResponse(body);
  const fresh = all.filter((item) => domains.length > 0 && !officialTargetBlock(item.url, domains));
  const selected = fresh
    .sort((left, right) => Number(officialHostCooling(cache, domains[0], left.url, now)) - Number(officialHostCooling(cache, domains[0], right.url, now))
      || admissionCandidateRank(left, subject, identity) - admissionCandidateRank(right, subject, identity)
      || Number(/\.pdf($|\?)/i.test(left.url)) - Number(/\.pdf($|\?)/i.test(right.url)))
    .slice(0, 3);
  return { all, returned: fresh.length, selected };
}

function searchQuery(body: unknown) {
  const output = body && typeof body === "object" && Array.isArray((body as { output?: unknown }).output)
    ? (body as { output: Array<Record<string, unknown>> }).output
    : [];
  for (const item of output) {
    if (item.type !== "web_search_call" || !item.action || typeof item.action !== "object") continue;
    const action = item.action as { query?: unknown; queries?: unknown };
    const query = typeof action.query === "string" ? action.query : Array.isArray(action.queries) && typeof action.queries[0] === "string" ? action.queries[0] : null;
    if (query) return query.replace(/\s+/g, " ").trim().slice(0, 200);
  }
  return null;
}

function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

const ENGLISH_VARIANT = /\bin lingua inglese\b|\bin english\b|\benglish[- ]taught\b/i;
const ITALIAN_VARIANT = /\bin lingua italiana\b|\btaught in italian\b|\bitalian[- ]taught\b/i;

function englishVariantTarget(subject: ResearchSubject, identity: ConfirmedProgrammeIdentity) {
  return [subject.name, subject.italianTitle ?? "", ...(subject.verifiedTitles ?? []), ...identity.aliases].some((item) => ENGLISH_VARIANT.test(item));
}

function candidateConcern(item: { url: string; title: string }, subject: ResearchSubject, identity: ConfirmedProgrammeIdentity): SearchRejectionReason | null {
  const scope = admissionSourceScope({ url: item.url, title: item.title }, subject, identity);
  if (scope === "unrelated_programme") {
    const level = detectDegreeLevel(item.title);
    const expected = catalogLevel(identity.degreeLevel);
    return level && expected && level !== expected ? "wrong_level" : "wrong_programme";
  }
  const blob = `${item.url} ${item.title}`;
  if (englishVariantTarget(subject, identity) ? ITALIAN_VARIANT.test(blob) : ENGLISH_VARIANT.test(item.title)) return "wrong_language_variant";
  if (scope === "unknown") return "source_scope_mismatch";
  return null;
}

function savedScope(page: { url: string; title: string; text: string }, subject: ResearchSubject, identity: ConfirmedProgrammeIdentity): ResearchSource["scope"] {
  const scope = admissionSourceScope(page, subject, identity);
  if (scope === "university_wide" || scope === "national") return "university";
  if (scope === "department_specific") return "department";
  return "programme";
}

function traceLabels(trace: DiscoveryTraceEntry[]) {
  return trace.map((item) => `${item.method} ${item.url}`.trim()).slice(0, 6);
}

function candidateUrls(parsed: unknown, subject: ResearchSubject) {
  if (!parsed || typeof parsed !== "object" || !Array.isArray((parsed as { sources?: unknown }).sources)) return [];
  return (parsed as { sources: Array<{ url?: unknown; title?: unknown; sourceType?: unknown; language?: unknown }> }).sources
    .map((source) => ({ url: String(source.url ?? ""), title: String(source.title ?? "Official source"), sourceType: source.sourceType, language: source.language }))
    .filter((source) => /^https?:\/\//.test(source.url))
    .sort((left, right) => scoreCandidate(right, subject) - scoreCandidate(left, subject))
    .slice(0, researchBudget().maxSources);
}

export async function openaiResearch(subject: ResearchSubject, deps: OpenAIResearchDeps = {}) {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) throw new Error("OPENAI_API_KEY is not configured. Research was not sent.");
  const fetchImpl = deps.fetchImpl ?? fetch;
  const send = deps.postResponses ?? postResponses;
  const cache = deps.rootCache ?? fileOfficialRootCache();
  const universityCache = deps.rootCache ? memoryUniversityFingerprintCache() : fileUniversityFingerprintCache();
  const now = deps.now ?? Date.now();
  const domains = officialDomains(subject);
  if (!domains.length) {
    return {
      researchIncomplete: true,
      identityConfidence: "not_found",
      researchWarnings: ["No official university domain is available, so web search was not sent."],
      sources: [],
      unknownFields: ["official domain"],
      discoveryTrace: [],
    };
  }
  const site = await discoverOfficialCandidates(subject, fetchImpl, { cache, now, universityCache });
  const pages: LoadedPage[] = site.pages.map((page) => ({
    url: page.url,
    title: page.title,
    sourceType: page.sourceType,
    language: page.language,
    text: page.text,
    readable: page.readable,
    html: page.html,
    pageLinks: page.pageLinks ?? [],
    fromLink: false,
  }));
  const trace: DiscoveryTraceEntry[] = [...site.trace];
  let discovered: unknown = null;
  let usage: ResearchUsage = {
    inputTokens: null,
    outputTokens: null,
    totalTokens: null,
    webSearchCalls: 0,
    officialFetches: site.fetches,
    urlDiscoveryCalls: 0,
    extractionCalls: 0,
    admissionResearchCalls: 0,
    universitalyResearchCalls: 0,
  };
  let gate = identityFromSources(subject, gateSources(pages));
  if (gate.confidence !== "confirmed" && !gate.catalogueReview && site.urlDiscoveryNeeded) {
    usage = { ...usage, urlDiscoveryTrigger: site.urlDiscoveryTrigger };
    const passes = urlDiscoveryPasses();
    for (let pass = 1; pass <= passes && gate.confidence !== "confirmed" && !gate.catalogueReview; pass += 1) {
      const discoveredBody = await send(key, buildUrlDiscoveryRequest(subject, pass === 1 ? 1 : 2));
      discovered = extractJson(responseText(discoveredBody));
      usage = countStage(addUsage(usage, usageFrom(discoveredBody)), "urlDiscoveryCalls");
      for (const url of orderedOfficialUrls(subject, candidateUrls(discovered, subject).map((item) => item.url), { cache, now })) {
        if (gate.confidence === "confirmed" || gate.catalogueReview) break;
        if (pages.some((page) => page.url === url)) continue;
        if (officialHostCooling(cache, domains[0], url, now)) {
          trace.push({ method: "openai_web_search", url, score: 0, opened: false, identityEvidence: ["tls_unavailable"] });
          continue;
        }
        const loaded = await readOfficialPage(url, domains, fetchImpl);
        if (loaded.rejected === "tls") {
          recordRootHealth(cache, domains[0], url, "tls_unavailable", now);
          trace.push({ method: "openai_web_search", url, score: 0, opened: false, identityEvidence: ["found_unconfirmed_tls"] });
          continue;
        }
        if (loaded.rejected || !loaded.readable) {
          trace.push({ method: "openai_web_search", url, score: 0, opened: false, identityEvidence: loaded.rejected ? ["redirect-rejected"] : [] });
          continue;
        }
        recordRootHealth(cache, domains[0], loaded.url, "healthy", now);
        pages.push({ url: loaded.url, title: loaded.title, sourceType: "official_programme_page", language: "other", text: loaded.text, readable: true, html: loaded.html, pageLinks: loaded.pageLinks, fromLink: false });
        trace.push({ method: "openai_web_search", url: loaded.url, score: 0, opened: true, identityEvidence: [] });
        gate = identityFromSources(subject, gateSources(pages));
      }
      gate = identityFromSources(subject, gateSources(pages));
    }
  } else if (gate.confidence !== "confirmed" && !gate.catalogueReview) {
    const discoveredBody = await send(key, buildDiscoveryRequest(subject));
    discovered = extractJson(responseText(discoveredBody));
    usage = addUsage(usage, usageFrom(discoveredBody));
    for (const candidate of candidateUrls(discovered, subject)) {
      if (pages.some((page) => page.url === candidate.url)) continue;
      const loaded = await readOfficialPage(candidate.url, domains, fetchImpl);
      if (loaded.rejected) {
        if (loaded.rejected === "tls") recordRootHealth(cache, domains[0], candidate.url, "tls_unavailable", now);
        trace.push({ method: "openai_web_search", url: candidate.url, score: 0, opened: false, identityEvidence: loaded.rejected === "tls" ? ["found_unconfirmed_tls"] : ["redirect-rejected"] });
        continue;
      }
      pages.push({ ...candidate, url: loaded.url, title: loaded.title || candidate.title, text: loaded.text, readable: loaded.readable, html: loaded.html, pageLinks: loaded.pageLinks, fromLink: false });
      trace.push({ method: "openai_web_search", url: loaded.url, score: 0, opened: loaded.readable, identityEvidence: [] });
    }
    gate = identityFromSources(subject, gateSources(pages));
    if (gate.confidence !== "confirmed") {
      const extra: string[] = [];
      for (const page of pages) {
        for (const link of programmeLinksFromIndex(page.html, domains[0])) {
          if (!pages.some((item) => item.url === link) && !extra.includes(link) && extra.length < 3) extra.push(link);
        }
      }
      for (const url of extra) {
        const loaded = await readOfficialPage(url, domains, fetchImpl);
        if (loaded.rejected) continue;
        pages.push({ ...loaded, sourceType: "official_programme_page", language: "other", fromLink: false });
      }
      if (extra.length) gate = identityFromSources(subject, gateSources(pages));
    }
  }
  const kept = gate.confidence === "confirmed" ? pages.filter((_, index) => gate.kept.includes(index) && pages[index]?.readable) : [];
  const searchesAttempted = traceLabels(trace);
  if (!kept.length) {
    return {
      ...(discovered && typeof discovered === "object" ? discovered as Record<string, unknown> : {}),
      researchIncomplete: true,
      identityConfidence: gate.confidence,
      researchWarnings: gate.warnings,
      catalogueAnomaly: gate.anomaly,
      searchesAttempted,
      discoveryTrace: trace,
      sources: pages.map((page) => ({
        url: page.url,
        title: page.title,
        sourceType: page.sourceType || "official_programme_page",
        language: page.language || "other",
        scope: "programme",
        sourceFound: true,
        sourceConfirmed: false,
        readable: page.readable,
        pageText: gate.catalogueReview ? page.text : "",
      })),
      apiUsage: usage,
    };
  }
  const keptPages = kept;
  const confirmedIdentity = freezeConfirmedIdentity(subject, keptPages, gate, domains[0] ?? "");
  const identityConflicts: IdentityConflict[] = [...gate.identityConflicts];
  const admissionProgress: AdmissionProgress = { general: emptyPass(), international: emptyPass(), universitaly: emptyPass() };
  const extractedBody = await send(key, buildExtractionRequest(subject, kept.map((page) => ({ url: page.url, title: page.title, text: page.text }))));
  usage = countStage(addUsage(usage, usageFrom(extractedBody)), "extractionCalls");
  const admissionUrls = new Set<string>();
  if (admissionSearchPasses() > 0) {
    const known = new Set(pages.map((page) => page.url));
    const seenUrl = (url: string) => {
      for (const item of known) {
        if (item === url) return true;
        try {
          if (normalizeAdmissionUrl(item) === normalizeAdmissionUrl(url)) return true;
        } catch {
          continue;
        }
      }
      return false;
    };
    const events = () => controlEvents(pages, subject, confirmedIdentity);
    const openCandidates = async (name: "general" | "international" | "universitaly", body: unknown, ready: () => boolean) => {
      admissionProgress[name].searchExecuted = true;
      const plan = planAdmissionCandidates(subject, body, cache, now, confirmedIdentity);
      admissionProgress[name].candidatesReturned = plan.returned;
      admissionProgress[name].candidatesEligible = plan.selected.filter((item) => !seenUrl(item.url) && !officialHostCooling(cache, domains[0], item.url, now)).length;
      const diagnostics: SearchCandidateDiagnostic[] = plan.all.slice(0, SEARCH_DIAGNOSTIC_LIMIT).map((item) => {
        const block = officialTargetBlock(item.url, domains);
        const cooling = !block && officialHostCooling(cache, domains[0], item.url, now);
        const chosen = plan.selected.includes(item);
        const reason: SearchRejectionReason | null = block === "host" ? "off_domain"
          : block ? "untrusted_source"
            : seenUrl(item.url) ? "duplicate"
              : cooling ? "no_readable_page"
                : chosen ? null
                  : candidateConcern(item, subject, confirmedIdentity) ?? (/\.pdf($|\?)/i.test(item.url) ? "pdf_downranked" : "other");
        return { url: item.url.slice(0, 300), title: item.title.slice(0, 120), domain: hostOf(item.url), eligible: reason == null, rejectionReason: reason, opened: false };
      });
      const diagnose = (url: string, patch: Partial<SearchCandidateDiagnostic>) => {
        const row = diagnostics.find((item) => item.url === url.slice(0, 300));
        if (row) Object.assign(row, patch);
      };
      admissionProgress[name].searchDiagnostics = { query: searchQuery(body), resultsReturned: plan.all.length, candidates: diagnostics };
      for (const item of plan.selected) {
        if (seenUrl(item.url) || officialHostCooling(cache, domains[0], item.url, now)) continue;
        const loaded = await readOfficialPage(item.url, domains, fetchImpl);
        usage = { ...usage, officialFetches: (usage.officialFetches ?? 0) + 1 };
        if (loaded.rejected === "tls") {
          recordRootHealth(cache, domains[0], item.url, "tls_unavailable", now);
          trace.push({ method: "openai_web_search", url: item.url, score: 0, opened: false, identityEvidence: ["found_unconfirmed_tls"] });
          diagnose(item.url, { rejectionReason: "no_readable_page" });
          continue;
        }
        if (loaded.rejected || !loaded.readable) {
          diagnose(item.url, { rejectionReason: loaded.rejected === "host" ? "off_domain" : "no_readable_page" });
          continue;
        }
        diagnose(item.url, { opened: true });
        recordRootHealth(cache, domains[0], loaded.url, "healthy", now);
        pages.push({ url: loaded.url, title: loaded.title || item.title, sourceType: "official_admission_call", language: "other", text: loaded.text, readable: true, html: loaded.html, pageLinks: loaded.pageLinks, fromLink: false });
        admissionUrls.add(loaded.url);
        known.add(loaded.url);
        admissionProgress[name].candidatesOpened += 1;
        const observed = identityObservation({ url: loaded.url, title: loaded.title || item.title, text: loaded.text }, confirmedIdentity, subject);
        if (observed && !identityConflicts.some((item) => item.field === observed.field && item.conflictingSource === observed.conflictingSource)) identityConflicts.push(observed);
        if (ready()) break;
      }
      for (const row of diagnostics) {
        if (row.eligible && !row.opened && !row.rejectionReason) row.rejectionReason = candidateConcern(row, subject, confirmedIdentity) ?? "other";
      }
      admissionProgress[name].acceptedEvidenceFound = ready();
    };
    const keptUrls = new Set(keptPages.map((page) => page.url));
    const hubTarget: HubTarget = {
      labels: [subject.name, splitCatalogueTitle(subject.name).programmeName, subject.italianTitle ?? "", ...(subject.verifiedTitles ?? []), ...confirmedIdentity.aliases],
      degreeClass: confirmedIdentity.degreeClass,
      englishVariant: englishVariantTarget(subject, confirmedIdentity),
    };
    const followAdmissionHub = async (name: "general" | "international" | "universitaly") => {
      const hubs = pages.filter((page) => (
        page.pageLinks.length
        && page.linkedFrom
        && (keptUrls.has(page.linkedFrom) || isConfirmedProgrammeUrl(page.linkedFrom, confirmedIdentity))
        && isAdmissionHub({ url: page.url, title: page.title, text: page.text, links: page.pageLinks }, subject, confirmedIdentity)
      )).slice(0, HUB_LIMITS.hubsPerStage);
      for (const hub of hubs) {
        const considered = rankHubTargetLinks(hub.pageLinks, hubTarget)
          .filter((link) => !seenUrl(link.href) && !officialHostCooling(cache, domains[0], link.href, now))
          .slice(0, HUB_LIMITS.linksConsidered);
        const state = { hubUrl: hub.url, linksConsidered: considered.length, linksOpened: 0, targetUrls: [] as string[] };
        admissionProgress[name].hubFollow = state;
        for (const link of considered) {
          if (state.linksOpened >= HUB_LIMITS.linksOpened) break;
          const loaded = await readOfficialPage(link.href, domains, fetchImpl);
          usage = { ...usage, officialFetches: (usage.officialFetches ?? 0) + 1 };
          if (loaded.rejected === "tls") {
            recordRootHealth(cache, domains[0], link.href, "tls_unavailable", now);
            trace.push({ method: "course_index", url: link.href, score: 0, opened: false, identityEvidence: ["admission_hub", "found_unconfirmed_tls"] });
            continue;
          }
          if (loaded.rejected || !loaded.readable) continue;
          recordRootHealth(cache, domains[0], loaded.url, "healthy", now);
          pages.push({ url: loaded.url, title: loaded.title, sourceType: "official_admission_call", language: "other", text: loaded.text, readable: true, html: loaded.html, pageLinks: loaded.pageLinks, fromLink: true, linkedFrom: hub.url });
          admissionUrls.add(loaded.url);
          known.add(loaded.url);
          state.linksOpened += 1;
          state.targetUrls.push(loaded.url.slice(0, 300));
          trace.push({ method: "course_index", url: loaded.url, score: 0, opened: true, identityEvidence: ["admission_hub"] });
          const observed = identityObservation({ url: loaded.url, title: loaded.title, text: loaded.text }, confirmedIdentity, subject);
          if (observed && !identityConflicts.some((item) => item.field === observed.field && item.conflictingSource === observed.conflictingSource)) identityConflicts.push(observed);
        }
      }
    };
    const openLinkedCandidates = async (name: "general" | "international" | "universitaly", kinds: AdmissionLinkKind[], ready: () => boolean) => {
      const answeredBefore = ready();
      let linksFound = 0;
      let linksRelevant = 0;
      const pool: PageLink[] = [];
      for (const page of pages) {
        if (page.fromLink || !page.pageLinks.length) continue;
        const scope = admissionSourceScope({ url: page.url, title: page.title, text: page.text }, subject, confirmedIdentity);
        if (scope !== "programme_specific" && scope !== "department_specific" && scope !== "university_wide") continue;
        linksFound += page.pageLinks.length;
        linksRelevant += page.pageLinks.filter((link) => admissionLinkKind(link)).length;
        pool.push(...selectAdmissionLinks(page.pageLinks, { kinds, limit: DISCOVERY_LIMITS.candidateLinks }));
      }
      const selected = selectAdmissionLinks(pool, { kinds, limit: DISCOVERY_LIMITS.candidateLinks });
      admissionProgress[name].linksFound = linksFound;
      admissionProgress[name].linksRelevant = linksRelevant;
      admissionProgress[name].linksEligible = selected.filter((link) => !seenUrl(link.href) && !officialHostCooling(cache, domains[0], link.href, now)).length;
      for (const link of selected) {
        if (seenUrl(link.href) || officialHostCooling(cache, domains[0], link.href, now)) continue;
        const loaded = await readOfficialPage(link.href, domains, fetchImpl);
        usage = { ...usage, officialFetches: (usage.officialFetches ?? 0) + 1 };
        if (loaded.rejected === "tls") {
          recordRootHealth(cache, domains[0], link.href, "tls_unavailable", now);
          trace.push({ method: "course_index", url: link.href, score: 0, opened: false, identityEvidence: ["found_unconfirmed_tls"] });
          continue;
        }
        if (loaded.rejected || !loaded.readable) continue;
        recordRootHealth(cache, domains[0], loaded.url, "healthy", now);
        pages.push({ url: loaded.url, title: loaded.title, sourceType: "official_admission_call", language: "other", text: loaded.text, readable: true, html: loaded.html, pageLinks: loaded.pageLinks, fromLink: true, linkedFrom: link.sourceUrl });
        admissionUrls.add(loaded.url);
        known.add(loaded.url);
        admissionProgress[name].linksOpened += 1;
        trace.push({ method: "course_index", url: loaded.url, score: 0, opened: true, identityEvidence: [] });
        const observed = identityObservation({ url: loaded.url, title: loaded.title, text: loaded.text }, confirmedIdentity, subject);
        if (observed && !identityConflicts.some((item) => item.field === observed.field && item.conflictingSource === observed.conflictingSource)) identityConflicts.push(observed);
      }
      if (!ready()) await followAdmissionHub(name);
      admissionProgress[name].linkEvidenceAccepted = !answeredBefore && ready();
    };
    const generalReady = () => hasGeneralAdmissionDeadline(events());
    const internationalReady = () => hasInternationalDeadline(events());
    const universitalyReady = () => hasUniversitalyDeadline(events());
    await openLinkedCandidates("general", ["programme_admission", "generic_admission"], generalReady);
    if (!generalReady()) {
      const body = await send(key, buildAdmissionRequest(subject, 1, confirmedIdentity.aliases));
      usage = countStage(addUsage(usage, usageFrom(body)), "admissionResearchCalls");
      await openCandidates("general", body, generalReady);
    } else {
      admissionProgress.general.acceptedEvidenceFound = true;
    }
    await openLinkedCandidates("international", ["international", "foreign_qualification", "visa_pre_enrolment"], internationalReady);
    if (admissionSearchPasses() >= 2 && !internationalReady()) {
      const body = await send(key, buildAdmissionRequest(subject, 2, confirmedIdentity.aliases));
      usage = countStage(addUsage(usage, usageFrom(body)), "admissionResearchCalls");
      await openCandidates("international", body, internationalReady);
    } else if (internationalReady()) {
      admissionProgress.international.acceptedEvidenceFound = true;
    }
    await openLinkedCandidates("universitaly", ["universitaly"], universitalyReady);
    if (!universitalyReady()) {
      const body = await send(key, buildUniversitalyRequest(subject, confirmedIdentity.aliases));
      usage = countStage(addUsage(usage, usageFrom(body)), "universitalyResearchCalls");
      await openCandidates("universitaly", body, universitalyReady);
    } else {
      admissionProgress.universitaly.acceptedEvidenceFound = true;
    }
  }
  const extracted = extractJson(responseText(extractedBody));
  if (!extracted || typeof extracted !== "object") {
    throw new Error("OpenAI did not return structured JSON. No finding was saved as verified.");
  }
  const byUrl = new Map(pages.map((page) => [page.url, page]));
  const sources = Array.isArray((extracted as { sources?: unknown }).sources) ? (extracted as { sources: Array<Record<string, unknown>> }).sources : [];
  const listed = new Set(sources.map((source) => String(source.url ?? "")));
  for (const page of kept) {
    if (listed.has(page.url)) continue;
    sources.push({ url: page.url, title: page.title, sourceType: page.sourceType || "official_programme_page", language: page.language || "it", scope: "programme" });
  }
  for (const url of admissionUrls) {
    if (listed.has(url)) continue;
    const page = byUrl.get(url);
    if (!page) continue;
    sources.push({ url: page.url, title: page.title, sourceType: "official_admission_call", language: page.language || "it", scope: "programme" });
    listed.add(url);
  }
  const linkedDocuments = admissionPdfInventory(
    pages.filter((page) => page.readable && admissionUrls.has(page.url)).flatMap((page) => page.pageLinks),
  );
  return {
    ...(extracted as Record<string, unknown>),
    searchesAttempted,
    discoveryTrace: trace,
    sources: sources.map((source) => {
      const page = byUrl.get(String(source.url ?? ""));
      const scope = page ? savedScope(page, subject, confirmedIdentity) : source.scope;
      return { ...source, scope, sourceFound: true, sourceConfirmed: Boolean(page?.readable), readable: page?.readable ?? false, pageText: page?.text ?? "", pageTitle: page?.title ?? "" };
    }),
    apiUsage: usage,
    linkedDocuments,
    confirmedIdentity,
    identityConflicts,
    admissionProgress,
  };
}
