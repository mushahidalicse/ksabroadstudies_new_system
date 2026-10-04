import type { ResearchResult } from "@/lib/research/research-schema";
import { conflictFor } from "@/lib/research/source-policy";

const italianCall = {
  url: "https://example.edu/it/bando-ammissione.pdf",
  title: "Business Administration Laurea Magistrale Example University Bando di ammissione",
  sourceType: "official_admission_call" as const,
  language: "it" as const,
  academicYear: "2026/27",
  publicationDate: "2026-03-01",
  lastUpdated: null,
  scope: "programme" as const,
  relevantFields: ["cefr", "ieltsMin"],
  sourceFound: true,
  sourceConfirmed: true,
};

export function italianEvidenceFixture(slug: string): ResearchResult {
  return {
    programmeSlug: slug,
    researchedAt: "2026-09-24T12:00:00.000Z",
    targetAcademicYear: "2026/27",
    provider: "mock",
    usage: null,
    researchIncomplete: false,
    researchOutcome: "pending_review",
    identityConfidence: "confirmed",
    searchesAttempted: ["English programme page", "Italian bando di ammissione"],
    discoveryTrace: [],
    ambiguousPages: [],
    verifiedSourceNotes: ["B2 English certification is required."],
    researchWarnings: [],
    officialEnglishSource: "not_found",
    officialItalianSource: "found",
    catalogueAnomaly: null,
    catalogueDecision: null,
    identity: {
      officialProgrammeName: "Business Administration",
      programmeName: "Business Administration",
      curriculumOrTrack: null,
      degreeClass: null,
      aliases: ["Business Administration"],
      university: "Example University",
      degreeLevel: "master",
      language: "English",
      englishTaught: true,
      programmeTeachingLanguage: "english",
      curriculumTeachingLanguages: [],
    },
    application: {
      openingDate: null,
      deadlines: [{ applicantType: "Non-EU residing abroad", applicantCategory: "non_eu_residing_abroad", round: null, date: "2027-03-15", dateType: "non_eu_abroad_deadline" }],
      applicationFee: null,
    },
    englishRequirement: { cefrLevel: "B2", ieltsMin: null, toeflMin: null, moiAccepted: null, cambridge: null, notes: "B2 English certification is required." },
    academicRequirement: { minimumCgpa: null, cgpaScale: null, minimumPercentage: null, requiredBackground: [], ectsRequirements: null, notes: null },
    tests: { required: null, types: [], notes: null },
    tuition: { type: null, amount: null, min: null, max: null, currency: null, period: null, notes: null },
    sources: [italianCall],
    linkedDocuments: [],
    conflicts: [],
    unknownFields: ["ieltsMin", "moi", "tuition"],
    fieldEvidence: [
      { field: "cefr", value: "B2", sourceUrl: italianCall.url, sourceTitle: italianCall.title, language: "it", academicYear: "2026/27" },
      { field: "englishTaught", value: "true", sourceUrl: italianCall.url, sourceTitle: italianCall.title, language: "it", academicYear: "2026/27" },
      { field: "deadline:Non-EU residing abroad", value: "2027-03-15", sourceUrl: italianCall.url, sourceTitle: italianCall.title, language: "it", academicYear: "2026/27" },
    ],
    confirmedIdentity: null,
    identityConflicts: [],
    admissionProgress: null,
    unconfirmedModelIdentity: null,
    reviewStatus: "pending_review",
  };
}

export function conflictFixture(slug: string): ResearchResult {
  const englishPage = {
    url: "https://example.edu/en/programme",
    title: "Programme page",
    sourceType: "official_programme_page" as const,
    language: "en" as const,
    academicYear: null,
    publicationDate: null,
    lastUpdated: null,
    scope: "programme" as const,
    relevantFields: ["ieltsMin"],
    sourceFound: true,
    sourceConfirmed: true,
  };
  const conflict = conflictFor("ieltsMin", { value: "6.0", source: englishPage }, { value: "6.5", source: italianCall });
  return {
    ...italianEvidenceFixture(slug),
    englishRequirement: { cefrLevel: "B2", ieltsMin: 6.5, toeflMin: null, moiAccepted: null, cambridge: null, notes: null },
    sources: [englishPage, italianCall],
    conflicts: [conflict],
    fieldEvidence: [
      ...italianEvidenceFixture(slug).fieldEvidence,
      { field: "ieltsMin", value: "6.5", sourceUrl: italianCall.url, sourceTitle: italianCall.title, language: "it", academicYear: "2026/27" },
    ],
    reviewStatus: "pending_review",
  };
}
