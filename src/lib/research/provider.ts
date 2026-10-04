import { grokResearch } from "@/lib/research/grok-provider";
import { mockResearch } from "@/lib/research/mock-provider";
import { openaiResearch } from "@/lib/research/openai-provider";
import type { ResearchSubject } from "@/lib/research/research-schema";

export type ResearchProvider = {
  id: string;
  research(subject: ResearchSubject): Promise<unknown>;
};

export function getResearchProvider(): ResearchProvider {
  const choice = process.env.RESEARCH_PROVIDER?.trim() || "openai";
  if (choice === "mock") return { id: "mock", research: mockResearch };
  if (choice === "grok") return { id: "grok", research: grokResearch };
  return { id: "openai", research: openaiResearch };
}
