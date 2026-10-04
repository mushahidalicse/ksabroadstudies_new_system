import { conflictFixture, italianEvidenceFixture } from "@/lib/research/fixtures";
import type { ResearchSubject } from "@/lib/research/research-schema";

export async function mockResearch(subject: ResearchSubject) {
  if (subject.slug.includes("conflict")) return conflictFixture(subject.slug);
  return italianEvidenceFixture(subject.slug);
}
