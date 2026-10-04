import type { CatalogueRequirements } from "@/lib/catalogue-requirements";
import { emptyRecord, normalizeRecord, type EnrichmentRecord } from "@/lib/programme-enrichment";
import { APPROVABLE_FIELDS, type ApprovableField, type ResearchResult } from "@/lib/research/research-schema";

function evidenceFor(result: ResearchResult, field: string) {
  return result.fieldEvidence.find((item) => item.field === field && item.sourceUrl);
}

export function proposalToEnrichment(
  slug: string,
  current: EnrichmentRecord | null,
  result: ResearchResult,
  approved: ApprovableField[],
  edits: Partial<Record<ApprovableField, string>>,
  today: string,
) {
  const next = current ? structuredClone(current) : emptyRecord(slug);
  const chosen = new Set(approved);
  const notes: string[] = [];
  if (chosen.has("ieltsMin")) {
    const edited = edits.ieltsMin;
    next.english.ieltsMin = edited != null && edited !== "" ? Number(edited) : result.englishRequirement.ieltsMin;
  }
  if (chosen.has("toeflMin")) {
    const edited = edits.toeflMin;
    next.english.toeflMin = edited != null && edited !== "" ? Number(edited) : result.englishRequirement.toeflMin;
  }
  if (chosen.has("cefr")) next.english.level = edits.cefr || result.englishRequirement.cefrLevel;
  if (chosen.has("moi")) {
    const value = edits.moi || (result.englishRequirement.moiAccepted === true ? "accepted" : result.englishRequirement.moiAccepted === false ? "rejected" : "unknown");
    next.english.moi = value === "accepted" || value === "rejected" || value === "unknown" ? value : "unknown";
  }
  if (chosen.has("cambridge")) next.english.cambridgeAccepted = result.englishRequirement.cambridge;
  if (chosen.has("tests")) {
    next.test.required = result.tests.required;
    next.test.types = result.tests.types.filter((item): item is EnrichmentRecord["test"]["types"][number] =>
      ["CEnT-S", "TOLC", "SAT", "GRE", "GMAT", "interview", "university test", "other"].includes(item),
    );
    next.test.notes = result.tests.notes;
  }
  if (chosen.has("tuition") && result.tuition.type) {
    next.tuition.mode = result.tuition.type;
    next.tuition.amount = result.tuition.amount;
    next.tuition.min = result.tuition.min;
    next.tuition.max = result.tuition.max;
    next.tuition.period = result.tuition.period;
    next.tuition.notes = result.tuition.notes;
  }
  if (chosen.has("academic")) {
    next.academic.minimumCgpa = result.academicRequirement.minimumCgpa;
    next.academic.cgpaScale = result.academicRequirement.cgpaScale;
    next.academic.minimumPercentage = result.academicRequirement.minimumPercentage;
    next.academic.requiredBackground = result.academicRequirement.requiredBackground;
    next.academic.ects = result.academicRequirement.ectsRequirements;
    next.academic.notes = result.academicRequirement.notes;
  }
  if (chosen.has("englishTaught") && result.identity.englishTaught != null) {
    notes.push(result.identity.englishTaught ? "Official source says this programme is taught in English." : "Official source does not describe this programme as taught in English.");
  }
  if (chosen.has("deadlines") && result.application.deadlines.length) {
    notes.push(result.application.deadlines.map((item) => `${item.applicantType}${item.round ? ` (${item.round})` : ""}: ${item.date ?? "date not stated"}`).join("; "));
  }
  if (notes.length) next.notes = [next.notes, ...notes].filter(Boolean).join(" ").slice(0, 1000);
  const support = approved.map((field) => evidenceFor(result, field === "cefr" ? "cefr" : field === "deadlines" ? `deadline:${result.application.deadlines[0]?.applicantType ?? ""}` : field)).find(Boolean);
  const source = result.sources.find((item) => item.url === support?.sourceUrl) ?? result.sources[0];
  if (source) {
    next.sourceUrl = source.url;
    next.sourceTitle = source.title;
    next.sourceType = source.sourceType;
    next.academicYear = result.targetAcademicYear || source.academicYear || next.academicYear;
  }
  next.lastChecked = today;
  next.verificationStatus = source ? (approved.length && result.unknownFields.length === 0 ? "verified" : "partially_verified") : "needs_review";
  return normalizeRecord(next, slug);
}

export function reviewRows(result: ResearchResult, catalogue: CatalogueRequirements, enrichment: EnrichmentRecord | null) {
  const evidence = (field: string) => result.fieldEvidence.find((item) => item.field === field);
  const deadlineText = result.application.deadlines.map((item) => `${item.applicantType}: ${item.date ?? "date not stated"}`).join("; ");
  const rows: Array<{ id: ApprovableField; label: string; proposed: string; catalogue: string; enrichment: string; source: string }> = [
    { id: "ieltsMin", label: "IELTS minimum", proposed: result.englishRequirement.ieltsMin?.toString() ?? "Unknown", catalogue: catalogue.english.ieltsMin?.toString() ?? "Unknown", enrichment: enrichment?.english.ieltsMin?.toString() ?? "None", source: evidence("ieltsMin")?.sourceTitle ?? "No official source" },
    { id: "toeflMin", label: "TOEFL minimum", proposed: result.englishRequirement.toeflMin?.toString() ?? "Unknown", catalogue: catalogue.english.toeflMin?.toString() ?? "Unknown", enrichment: enrichment?.english.toeflMin?.toString() ?? "None", source: evidence("toeflMin")?.sourceTitle ?? "No official source" },
    { id: "cefr", label: "CEFR", proposed: result.englishRequirement.cefrLevel ?? "Unknown", catalogue: catalogue.english.level ?? "Unknown", enrichment: enrichment?.english.level ?? "None", source: evidence("cefr")?.sourceTitle ?? "No official source" },
    { id: "moi", label: "MOI", proposed: result.englishRequirement.moiAccepted === true ? "Accepted" : result.englishRequirement.moiAccepted === false ? "Not accepted" : "Unknown", catalogue: catalogue.english.moiAccepted === true ? "Accepted" : catalogue.english.moiAccepted === false ? "Not accepted" : "Unknown", enrichment: enrichment?.english.moi ?? "None", source: evidence("moi")?.sourceTitle ?? "No official source" },
    { id: "tests", label: "Admission test", proposed: result.tests.required == null ? "Unknown" : `${result.tests.required ? "Required" : "Not required"}${result.tests.types.length ? `: ${result.tests.types.join(", ")}` : ""}`, catalogue: catalogue.test.required == null ? "Unknown" : catalogue.test.type.join(", ") || "Recorded", enrichment: enrichment?.test.required == null ? "None" : enrichment.test.types.join(", ") || String(enrichment.test.required), source: evidence("tests")?.sourceTitle ?? "No official source" },
    { id: "tuition", label: "Tuition", proposed: result.tuition.amount != null ? `€${result.tuition.amount}` : result.tuition.min != null ? `€${result.tuition.min}–€${result.tuition.max}` : "Unknown", catalogue: catalogue.tuition?.amount != null ? `€${catalogue.tuition.amount}` : catalogue.tuition?.min != null ? `€${catalogue.tuition.min}–€${catalogue.tuition.max}` : "Unknown", enrichment: enrichment?.tuition.amount != null ? `€${enrichment.tuition.amount}` : enrichment?.tuition.min != null ? `€${enrichment.tuition.min}–€${enrichment.tuition.max}` : "None", source: evidence("tuition")?.sourceTitle ?? "No official source" },
    { id: "academic", label: "Academic requirement", proposed: result.academicRequirement.minimumCgpa?.toString() ?? result.academicRequirement.minimumPercentage?.toString() ?? "Unknown", catalogue: catalogue.academic.minimumCgpa?.toString() ?? catalogue.academic.minimumPercentage?.toString() ?? "Unknown", enrichment: enrichment?.academic.minimumCgpa?.toString() ?? "None", source: evidence("minimumCgpa")?.sourceTitle ?? evidence("minimumPercentage")?.sourceTitle ?? "No official source" },
    { id: "englishTaught", label: "Taught in English", proposed: result.identity.englishTaught == null ? "Unknown" : result.identity.englishTaught ? "Yes" : "No", catalogue: "Not a separate catalogue field", enrichment: "None", source: evidence("englishTaught")?.sourceTitle ?? "No official source" },
    { id: "deadlines", label: "Deadlines by applicant category", proposed: deadlineText || "Unknown", catalogue: "Kept on the university call. Not replaced by one date.", enrichment: "None", source: result.fieldEvidence.find((item) => item.field.startsWith("deadline:"))?.sourceTitle ?? "No official source" },
  ];
  return rows.filter((row) => (APPROVABLE_FIELDS as readonly string[]).includes(row.id));
}
