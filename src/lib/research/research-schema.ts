import type { SourceType } from "@/lib/programme-enrichment";

export const RESEARCH_BATCH_LIMIT = 5;
export const RESEARCH_RECENT_DAYS = 14;

export const JOB_STATUSES = ["queued", "researching", "completed", "failed", "cancelled", "rate_limited"] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export const REVIEW_STATUSES = ["pending_review", "approved", "edited_and_approved", "rejected", "research_incomplete_identity", "needs_research_agent_fix", "catalogue_review_required"] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export const APPROVABLE_FIELDS = [
  "ieltsMin",
  "toeflMin",
  "cefr",
  "moi",
  "cambridge",
  "tests",
  "tuition",
  "academic",
  "englishTaught",
  "deadlines",
] as const;
export type ApprovableField = (typeof APPROVABLE_FIELDS)[number];

export type ResearchSubject = {
  slug: string;
  name: string;
  universityName: string;
  level: string;
  city: string;
  region: string;
  language: string;
  englishRequirement: string;
  universityWebsite: string | null;
  admissionPortal: string | null;
  /** Previous or current titles already verified in the catalogue. Never invented from a similar name. */
  verifiedTitles?: string[];
  degreeClass?: string | null;
  /** Catalogue Italian title. A search variant only; never an accepted identity name. */
  italianTitle?: string | null;
  /** Catalogue URLs that may seed discovery. A hint never confirms identity. */
  discoveryHints?: DiscoveryHint[];
};

export type DiscoveryHintKind = "programme_url" | "apply_url";

export type DiscoveryHint = {
  url: string;
  kind: DiscoveryHintKind;
};

export type UrlDiscoveryTrigger = "zero_eligible_candidates" | "tls_unavailable" | "no_discovery_pages" | "other_existing_reason";

export type ResearchSource = {
  url: string;
  title: string;
  sourceType: SourceType;
  language: "en" | "it" | "other";
  academicYear: string | null;
  publicationDate: string | null;
  lastUpdated: string | null;
  scope: "programme" | "department" | "university";
  relevantFields: string[];
  sourceFound: boolean;
  sourceConfirmed: boolean;
};

export type FieldEvidence = {
  field: string;
  value: string;
  sourceUrl: string;
  sourceTitle: string;
  language: "en" | "it" | "other";
  academicYear: string | null;
};

export type ResearchConflict = {
  field: string;
  englishValue: string;
  italianValue: string;
  englishUrl: string;
  italianUrl: string;
  proposedValue: string | null;
  reason: string;
};

export type DateType =
  | "application_open"
  | "application_deadline"
  | "admission_round_open"
  | "admission_round_deadline"
  | "non_eu_application_open"
  | "non_eu_application_deadline"
  | "non_eu_abroad_deadline"
  | "non_eu_deadline"
  | "visa_applicant_deadline"
  | "foreign_qualification_deadline"
  | "eu_application_deadline"
  | "pre_enrolment_open"
  | "pre_enrolment_deadline"
  | "universitaly_open"
  | "universitaly_deadline"
  | "admission_result_date"
  | "enrolment_open"
  | "enrolment_deadline"
  | "immatriculation_open"
  | "immatriculation_deadline"
  | "tuition_payment_deadline"
  | "document_submission_deadline"
  | "test_registration_open"
  | "test_registration_deadline"
  | "legal_reference_date"
  | "other";
export type ApplicantCategory =
  | "all_applicants"
  | "eu"
  | "eu_equivalent"
  | "non_eu"
  | "non_eu_residing_abroad"
  | "visa_applicant"
  | "international"
  | "foreign_qualification"
  | "italian_qualification"
  | "unknown";
export type IdentityConfidence = "confirmed" | "ambiguous" | "not_found";
export type ResearchOutcome = "pending_review" | "research_incomplete_identity" | "needs_research_agent_fix" | "catalogue_review_required";
export type CatalogueDecision = "keep" | "edit_manually" | "inactive_requested" | "investigate_later";

export type ResearchDeadline = {
  applicantType: string;
  applicantCategory: ApplicantCategory;
  round: string | null;
  date: string | null;
  dateType: DateType;
};

export type LinkedDocumentPurpose =
  | "admission_call_pdf"
  | "general_information_pdf"
  | "venue_notice_pdf"
  | "other_admission_pdf";

export type LinkedDocument = {
  url: string;
  label: string;
  purpose: LinkedDocumentPurpose;
};

export type DiscoveryMethod = "catalogue_hint" | "sitemap" | "course_index" | "internal_search" | "openai_web_search";

export type DiscoveryTraceEntry = {
  method: DiscoveryMethod;
  url: string;
  score: number;
  opened: boolean;
  identityEvidence: string[];
};

export type ConfirmedProgrammeIdentity = {
  programmeUrl: string;
  university: string;
  degreeLevel: string;
  degreeClass: string | null;
  officialTitles: string[];
  aliases: string[];
  trackOrCurriculum: string | null;
  universityDomain: string;
  confirmedAt?: string;
  supportingSources?: string[];
  provenance?: {
    programmeName: IdentityFieldProvenance | null;
    degreeLevel: IdentityFieldProvenance | null;
    degreeClass: IdentityFieldProvenance | null;
    trackOrCurriculum: IdentityFieldProvenance | null;
    aliases: IdentityFieldProvenance[];
  };
};

export type IdentityFieldProvenance = {
  value: string;
  sourceUrl: string;
  sourceType: string;
  confirmedAt: string;
  confidence: "confirmed";
};

export type IdentityConflict = {
  field: string;
  confirmedValue: string;
  observedValue: string;
  confirmedSource: string;
  conflictingSource: string;
};

export type AdmissionPassState = {
  searchExecuted: boolean;
  candidatesReturned: number;
  candidatesEligible: number;
  candidatesOpened: number;
  acceptedEvidenceFound: boolean;
  linksFound: number;
  linksRelevant: number;
  linksEligible: number;
  linksOpened: number;
  linkEvidenceAccepted: boolean;
  hubFollow?: AdmissionHubFollow | null;
  searchDiagnostics?: SearchStageDiagnostics | null;
};

export type AdmissionHubFollow = {
  hubUrl: string;
  linksConsidered: number;
  linksOpened: number;
  targetUrls: string[];
};

export type SearchRejectionReason =
  | "off_domain"
  | "duplicate"
  | "pdf_downranked"
  | "wrong_programme"
  | "wrong_level"
  | "wrong_language_variant"
  | "untrusted_source"
  | "source_scope_mismatch"
  | "no_readable_page"
  | "other";

export type SearchCandidateDiagnostic = {
  url: string;
  title: string;
  domain: string;
  eligible: boolean;
  rejectionReason: SearchRejectionReason | null;
  opened: boolean;
};

export type SearchStageDiagnostics = {
  query: string | null;
  resultsReturned: number;
  candidates: SearchCandidateDiagnostic[];
};

export type AdmissionProgress = {
  general: AdmissionPassState;
  international: AdmissionPassState;
  universitaly: AdmissionPassState;
};

export type ResearchUsage = {
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  webSearchCalls: number | null;
  officialFetches: number | null;
  urlDiscoveryCalls: number | null;
  extractionCalls: number | null;
  admissionResearchCalls: number | null;
  universitalyResearchCalls: number | null;
  urlDiscoveryTrigger?: UrlDiscoveryTrigger | null;
};

export type ResearchResult = {
  programmeSlug: string;
  researchedAt: string;
  targetAcademicYear: string | null;
  provider: string;
  usage: ResearchUsage | null;
  researchIncomplete: boolean;
  researchOutcome: ResearchOutcome;
  identityConfidence: IdentityConfidence;
  searchesAttempted: string[];
  discoveryTrace: DiscoveryTraceEntry[];
  ambiguousPages: string[];
  verifiedSourceNotes: string[];
  researchWarnings: string[];
  officialEnglishSource: "found" | "not_found" | "unconfirmed";
  officialItalianSource: "found" | "not_found" | "unconfirmed";
  catalogueAnomaly: {
    reason: string;
    catalogueName: string;
    catalogueLevel: string;
    officialName: string | null;
    officialLevel: string | null;
    urls: string[];
  } | null;
  catalogueDecision: CatalogueDecision | null;
  identity: {
    officialProgrammeName: string | null;
    programmeName: string | null;
    curriculumOrTrack: string | null;
    degreeClass: string | null;
    aliases: string[];
    university: string | null;
    degreeLevel: string | null;
    language: string | null;
    englishTaught: true | false | null;
    programmeTeachingLanguage: "english" | "italian" | "mixed" | "other" | "unknown" | null;
    curriculumTeachingLanguages: Array<{ curriculum: string; language: "english" | "italian" | "mixed" | "other" | "unknown"; evidenceScope: "curriculum"; sourceUrl: string }>;
  };
  unconfirmedModelIdentity: {
    university: string | null;
    degreeLevel: string | null;
    programmeName: string | null;
    language: string | null;
  } | null;
  application: {
    openingDate: string | null;
    deadlines: ResearchDeadline[];
    applicationFee: { amount: number | null; currency: "EUR" | null; notes: string | null } | null;
  };
  englishRequirement: {
    cefrLevel: string | null;
    ieltsMin: number | null;
    toeflMin: number | null;
    moiAccepted: true | false | null;
    cambridge: true | false | null;
    notes: string | null;
  };
  academicRequirement: {
    minimumCgpa: number | null;
    cgpaScale: number | null;
    minimumPercentage: number | null;
    requiredBackground: string[];
    ectsRequirements: string | null;
    notes: string | null;
  };
  tests: {
    required: true | false | null;
    types: string[];
    notes: string | null;
  };
  tuition: {
    type: "single" | "range" | "variable" | "unknown" | null;
    amount: number | null;
    min: number | null;
    max: number | null;
    currency: "EUR" | null;
    period: "year" | "programme" | "semester" | null;
    notes: string | null;
  };
  sources: ResearchSource[];
  linkedDocuments: LinkedDocument[];
  conflicts: ResearchConflict[];
  unknownFields: string[];
  fieldEvidence: FieldEvidence[];
  confirmedIdentity: ConfirmedProgrammeIdentity | null;
  identityConflicts: IdentityConflict[];
  admissionProgress: AdmissionProgress | null;
  reviewStatus: "pending_review";
};

export function emptyResearchResult(slug: string, provider: string): ResearchResult {
  return {
    programmeSlug: slug,
    researchedAt: new Date().toISOString(),
    targetAcademicYear: null,
    provider,
    usage: null,
    researchIncomplete: true,
    researchOutcome: "pending_review",
    identityConfidence: "not_found",
    searchesAttempted: [],
    discoveryTrace: [],
    ambiguousPages: [],
    verifiedSourceNotes: [],
    researchWarnings: [],
    officialEnglishSource: "not_found",
    officialItalianSource: "not_found",
    catalogueAnomaly: null,
    catalogueDecision: null,
    identity: { officialProgrammeName: null, programmeName: null, curriculumOrTrack: null, degreeClass: null, aliases: [], university: null, degreeLevel: null, language: null, englishTaught: null, programmeTeachingLanguage: null, curriculumTeachingLanguages: [] },
    unconfirmedModelIdentity: null,
    application: { openingDate: null, deadlines: [], applicationFee: null },
    englishRequirement: { cefrLevel: null, ieltsMin: null, toeflMin: null, moiAccepted: null, cambridge: null, notes: null },
    academicRequirement: { minimumCgpa: null, cgpaScale: null, minimumPercentage: null, requiredBackground: [], ectsRequirements: null, notes: null },
    tests: { required: null, types: [], notes: null },
    tuition: { type: null, amount: null, min: null, max: null, currency: null, period: null, notes: null },
    sources: [],
    linkedDocuments: [],
    conflicts: [],
    unknownFields: [],
    fieldEvidence: [],
    confirmedIdentity: null,
    identityConflicts: [],
    admissionProgress: null,
    reviewStatus: "pending_review",
  };
}
