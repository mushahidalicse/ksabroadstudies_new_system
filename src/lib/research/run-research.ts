import { completeResearchJob, failResearchJob, markResearchRateLimited, markResearching } from "@/lib/portal-store/research";
import type { ResearchProvider } from "@/lib/research/provider";
import { rateLimitWaitMs, ResearchRateLimitError, shouldRetryRateLimit } from "@/lib/research/research-budget";
import type { ResearchSubject } from "@/lib/research/research-schema";
import { validateResearch } from "@/lib/research/validate-research";

function safeMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "Research failed.";
  return message.replace(/Bearer\s+\S+/gi, "Bearer [redacted]").replace(/sk-[A-Za-z0-9_-]+/g, "sk-[redacted]");
}

export async function runResearchJob(id: string, subject: ResearchSubject, provider: ResearchProvider) {
  await markResearching(id);
  let attempt = 0;
  let raw: unknown;
  while (raw === undefined) {
    try {
      raw = await provider.research(subject);
    } catch (error) {
      if (error instanceof ResearchRateLimitError && shouldRetryRateLimit(attempt)) {
        attempt += 1;
        await new Promise((resolve) => setTimeout(resolve, rateLimitWaitMs(error.retryAfterSeconds)));
        continue;
      }
      if (error instanceof ResearchRateLimitError) {
        await markResearchRateLimited(id, safeMessage(error));
        return null;
      }
      await failResearchJob(id, safeMessage(error));
      return null;
    }
  }
  try {
    const result = validateResearch(raw, subject.slug, provider.id, subject);
    result.provider = provider.id;
    if (!result.searchesAttempted.length) {
      result.searchesAttempted = ["English official sources", "Italian official sources"];
    }
    const reviewStatus = result.researchOutcome === "pending_review" ? "pending_review" : result.researchOutcome;
    await completeResearchJob(id, subject.slug, result, reviewStatus);
    return result;
  } catch (error) {
    await failResearchJob(id, safeMessage(error));
    return null;
  }
}
