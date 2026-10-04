export class ResearchRateLimitError extends Error {
  readonly retryAfterSeconds: number | null;

  constructor(message: string, retryAfterSeconds: number | null) {
    super(message);
    this.name = "ResearchRateLimitError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export function researchBudget() {
  const toolCalls = Number(process.env.RESEARCH_MAX_TOOL_CALLS);
  const outputTokens = Number(process.env.RESEARCH_MAX_OUTPUT_TOKENS);
  const context = process.env.RESEARCH_SEARCH_CONTEXT?.trim() || "low";
  const effort = process.env.RESEARCH_REASONING_EFFORT?.trim() || "low";
  return {
    maxToolCalls: Number.isFinite(toolCalls) && toolCalls > 0 ? Math.min(toolCalls, 6) : 6,
    searchContext: context === "medium" || context === "high" ? context : "low",
    maxOutputTokens: Number.isFinite(outputTokens) && outputTokens > 0 ? Math.min(outputTokens, 2500) : 1600,
    reasoningEffort: effort === "medium" || effort === "high" ? effort : "low",
    maxSources: 4,
  };
}

export function urlDiscoveryPasses() {
  const value = Number(process.env.RESEARCH_URL_DISCOVERY_PASSES);
  if (!Number.isFinite(value) || value <= 0) return 2;
  return Math.min(Math.floor(value), 2);
}

export function admissionSearchPasses() {
  if (process.env.RESEARCH_ADMISSION_SEARCH_PASSES?.trim() === "0") return 0;
  const value = Number(process.env.RESEARCH_ADMISSION_SEARCH_PASSES);
  if (!Number.isFinite(value) || value <= 0) return 2;
  return Math.min(Math.floor(value), 2);
}

export function shouldRetryRateLimit(attempt: number) {
  return attempt < 1;
}

export function rateLimitWaitMs(retryAfterSeconds: number | null) {
  const override = process.env.RESEARCH_RATE_LIMIT_WAIT_MS;
  if (override != null && override !== "") return Math.max(0, Number(override) || 0);
  const seconds = retryAfterSeconds == null ? 2 : Math.min(Math.max(retryAfterSeconds, 0), 5);
  return seconds * 1000;
}

export function officialDomains(subject: { universityWebsite?: string | null; admissionPortal?: string | null }) {
  const domains = new Set<string>();
  for (const raw of [subject.universityWebsite, subject.admissionPortal]) {
    if (!raw) continue;
    try {
      const host = new URL(raw).hostname.replace(/^www\./, "").toLowerCase();
      const parts = host.split(".").filter(Boolean);
      if (parts.length >= 2) domains.add(parts.slice(-2).join("."));
    } catch {
      continue;
    }
  }
  return [...domains];
}
