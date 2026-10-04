import { admissionSourceScope, isAdmissionHub, isConfirmedProgrammeUrl, scopedDatedEvents } from "@/lib/research/admission-gates";
import { splitCatalogueTitle } from "@/lib/research/discovery";
import { detectCurriculumTeachingLanguages, detectProgrammeTeachingLanguage, ectsRequirement, englishTaughtFromProgramme, headingTeachingLanguage, isApplyByDate, reclassifyDate, unsupportedNote, type ProgrammeTeachingLanguage } from "@/lib/research/extract-facts";
import { enrichConfirmedIdentity, identityFromSources, identityObservation, postConfirmationAdmissionConflict, sourceDecision } from "@/lib/research/identity-gate";
import { isSourceType, officialUrl } from "@/lib/research/source-policy";
import {
  emptyResearchResult,
  type AdmissionHubFollow,
  type AdmissionPassState,
  type AdmissionProgress,
  type ApplicantCategory,
  type ConfirmedProgrammeIdentity,
  type DateType,
  type DiscoveryTraceEntry,
  type FieldEvidence,
  type IdentityConflict,
  type IdentityFieldProvenance,
  type LinkedDocument,
  type LinkedDocumentPurpose,
  type ResearchResult,
  type ResearchSource,
  type ResearchSubject,
  type ResearchUsage,
  type SearchCandidateDiagnostic,
  type SearchRejectionReason,
  type SearchStageDiagnostics,
  type UrlDiscoveryTrigger,
} from "@/lib/research/research-schema";

type DraftSource = ResearchSource & { pageText: string; pageTitle: string; readable: boolean };

const IMAT_TEST = /\bIMAT\b|\binternational medical admissions? test\b/i;
const IMAT_CONTEXT = /\b(?:admission|ammissione|test|prova|exam|esame|concorso)\b/i;

function imatFromHtml(text: string) {
  for (const match of text.matchAll(new RegExp(IMAT_TEST.source, "gi"))) {
    if (match.index == null) continue;
    if (IMAT_CONTEXT.test(text.slice(Math.max(0, match.index - 160), match.index + match[0].length + 160))) return true;
  }
  return false;
}

function text(value: unknown, max = 240) {
  const clean = String(value ?? "").replace(/[\u0000-\u001F\u007F]/g, " ").trim().slice(0, max);
  return clean || null;
}

function storedIdentityUrl(value: unknown) {
  const clean = String(value ?? "").replace(/[\u0000-\u001F\u007F]/g, " ").trim();
  if (!clean || !officialUrl(clean)) return null;
  return clean;
}

function numberOrNull(value: unknown, min: number, max: number) {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) return null;
  return parsed;
}

function language(value: unknown): ResearchSource["language"] {
  const code = String(value ?? "").toLowerCase();
  if (code === "it" || code === "italian") return "it";
  if (code === "en" || code === "english") return "en";
  return "other";
}

const DATE_TYPES = new Set<DateType>([
  "application_open", "application_deadline", "admission_round_open", "admission_round_deadline",
  "non_eu_application_open", "non_eu_application_deadline", "non_eu_abroad_deadline", "non_eu_deadline", "visa_applicant_deadline", "foreign_qualification_deadline",
  "eu_application_deadline", "pre_enrolment_open", "pre_enrolment_deadline", "universitaly_open", "universitaly_deadline",
  "admission_result_date", "enrolment_open", "enrolment_deadline", "immatriculation_open",
  "immatriculation_deadline", "tuition_payment_deadline", "document_submission_deadline",
  "test_registration_open", "test_registration_deadline", "legal_reference_date", "other",
]);

function categoryFor(dateType: DateType): ApplicantCategory {
  if (dateType === "non_eu_abroad_deadline" || dateType === "non_eu_deadline") return "non_eu_residing_abroad";
  if (dateType === "non_eu_application_deadline" || dateType === "non_eu_application_open") return "non_eu";
  if (dateType === "foreign_qualification_deadline") return "foreign_qualification";
  if (dateType === "visa_applicant_deadline" || dateType === "universitaly_deadline" || dateType === "universitaly_open" || dateType === "pre_enrolment_deadline" || dateType === "pre_enrolment_open") return "visa_applicant";
  if (dateType === "eu_application_deadline") return "eu";
  return "all_applicants";
}

function dateTypeFor(value: unknown, applicantType: string): DateType | null {
  const named = String(value ?? "") as DateType;
  if (DATE_TYPES.has(named)) return reclassifyDate(named, applicantType);
  const hay = applicantType.toLowerCase();
  if (/registration (?:to|for) the (?:admission )?test|test registration|iscrizione alla prova|iscrizione al test/.test(hay)) {
    const opens = /\b(?:opens|opening|open|apre|aprono|apertura|inizio|inizia)\b/.test(hay);
    const closes = /\b(?:closes|deadline|scadenza|chiude|entro|fino al)\b/.test(hay);
    if (opens && !closes) return "test_registration_open";
    return "test_registration_deadline";
  }
  if (/immatricol|iscrizion|enrol/.test(hay)) {
    const opens = /\b(?:opens|opening|open|apre|aprono|apertura|inizio|inizia)\b/.test(hay);
    const closes = /\b(?:closes|deadline|scadenza|chiude|entro|fino al)\b/.test(hay);
    if (opens && !closes) return "enrolment_open";
    return "enrolment_deadline";
  }
  if (/non-eu|visa/.test(hay)) return "non_eu_abroad_deadline";
  if (/application|domanda/.test(hay)) return "application_deadline";
  return null;
}

function sourcesFrom(value: unknown): DraftSource[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const sources: DraftSource[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const url = text(row.url, 400);
    const pageText = typeof row.pageText === "string" ? row.pageText.slice(0, 12000) : "";
    let sourceType = String(row.sourceType ?? "");
    if (!isSourceType(sourceType) && pageText) sourceType = "other_official_source";
    if (!url || !officialUrl(url) || !isSourceType(sourceType)) continue;
    if (seen.has(url)) continue;
    seen.add(url);
    const scope = row.scope === "department" || row.scope === "university" ? row.scope : "programme";
    const readable = row.readable !== false;
    const sourceFound = row.sourceFound !== false;
    const sourceConfirmed = readable && row.sourceConfirmed !== false && sourceFound;
    sources.push({
      url,
      title: text(row.title, 180) ?? "Official source",
      sourceType,
      language: language(row.language),
      academicYear: text(row.academicYear, 40),
      publicationDate: text(row.publicationDate, 40),
      lastUpdated: text(row.lastUpdated, 40),
      scope,
      relevantFields: Array.isArray(row.relevantFields) ? row.relevantFields.map((field) => String(field)).slice(0, 12) : [],
      sourceFound,
      sourceConfirmed,
      readable,
      pageText,
      pageTitle: typeof row.pageTitle === "string" ? row.pageTitle.slice(0, 240) : "",
    });
  }
  return sources;
}

const LINKED_PURPOSES = new Set<LinkedDocumentPurpose>(["admission_call_pdf", "general_information_pdf", "venue_notice_pdf", "other_admission_pdf"]);

function linkedDocumentsFrom(value: unknown): LinkedDocument[] {
  if (!Array.isArray(value)) return [];
  const found: LinkedDocument[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const url = text(row.url, 400);
    const purpose = String(row.purpose ?? "") as LinkedDocumentPurpose;
    if (!url || !officialUrl(url) || !LINKED_PURPOSES.has(purpose) || seen.has(url)) continue;
    seen.add(url);
    found.push({ url, label: text(row.label, 180) ?? url.split("/").pop() ?? "pdf", purpose });
    if (found.length >= 8) break;
  }
  return found;
}

function capSavedSources(sources: DraftSource[], identity: ConfirmedProgrammeIdentity | null) {
  const selected = sources.slice(0, 4);
  if (!identity?.programmeUrl || selected.some((source) => isConfirmedProgrammeUrl(source.url, identity))) return selected;
  const confirming = sources.find((source) => isConfirmedProgrammeUrl(source.url, identity));
  if (!confirming) return selected;
  return [confirming, ...selected.filter((source) => source.url !== confirming.url)].slice(0, 4);
}

function provenanceFrom(value: unknown): IdentityFieldProvenance | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const fieldValue = text(row.value, 180);
  const sourceUrl = storedIdentityUrl(row.sourceUrl);
  if (!fieldValue || !sourceUrl) return null;
  return {
    value: fieldValue,
    sourceUrl,
    sourceType: text(row.sourceType, 80) ?? "official_programme_page",
    confirmedAt: text(row.confirmedAt, 40) ?? "",
    confidence: "confirmed",
  };
}

function evidenceFrom(value: unknown, allowed: Set<string>): FieldEvidence[] {
  if (!Array.isArray(value)) return [];
  const evidence: FieldEvidence[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const sourceUrl = text(row.sourceUrl, 400);
    const field = String(row.field ?? "");
    if (!sourceUrl || !officialUrl(sourceUrl) || !allowed.has(sourceUrl) || !field) continue;
    evidence.push({
      field,
      value: text(row.value, 240) ?? "",
      sourceUrl,
      sourceTitle: text(row.sourceTitle, 180) ?? "Official source",
      language: language(row.language),
      academicYear: text(row.academicYear, 40),
    });
  }
  return evidence;
}

function supported(evidence: FieldEvidence[], field: string) {
  return evidence.some((item) => item.field === field && item.value);
}

const URL_DISCOVERY_TRIGGERS = new Set(["zero_eligible_candidates", "tls_unavailable", "no_discovery_pages", "other_existing_reason"]);

function usageFrom(raw: unknown): ResearchUsage | null {
  if (!raw || typeof raw !== "object") return null;
  const usage = raw as Record<string, unknown>;
  const count = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : null);
  return {
    inputTokens: count(usage.inputTokens),
    outputTokens: count(usage.outputTokens),
    totalTokens: count(usage.totalTokens),
    webSearchCalls: count(usage.webSearchCalls),
    officialFetches: count(usage.officialFetches),
    urlDiscoveryCalls: count(usage.urlDiscoveryCalls),
    extractionCalls: count(usage.extractionCalls),
    admissionResearchCalls: count(usage.admissionResearchCalls),
    universitalyResearchCalls: count(usage.universitalyResearchCalls),
    urlDiscoveryTrigger: URL_DISCOVERY_TRIGGERS.has(String(usage.urlDiscoveryTrigger)) ? usage.urlDiscoveryTrigger as UrlDiscoveryTrigger : null,
  };
}

function discoveryTraceFrom(value: unknown): DiscoveryTraceEntry[] {
  if (!Array.isArray(value)) return [];
  const methods = new Set(["catalogue_hint", "sitemap", "course_index", "internal_search", "openai_web_search"]);
  const evidenceLabels = new Set(["university", "degree-level", "degree-class", "programme-title", "curriculum", "redirect-rejected", "tls_unavailable", "found_unconfirmed_tls", "admission_hub"]);
  const trace: DiscoveryTraceEntry[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const method = String(row.method ?? "");
    if (!methods.has(method)) continue;
    const url = text(row.url, 400) ?? "";
    if (url && !officialUrl(url)) continue;
    trace.push({
      method: method as DiscoveryTraceEntry["method"],
      url,
      score: typeof row.score === "number" && Number.isFinite(row.score) ? Math.round(row.score) : 0,
      opened: row.opened === true,
      identityEvidence: Array.isArray(row.identityEvidence) ? row.identityEvidence.map(String).filter((label) => evidenceLabels.has(label)).slice(0, 6) : [],
    });
    if (trace.length >= 12) break;
  }
  return trace;
}

function confirmedIdentityFrom(value: unknown): ConfirmedProgrammeIdentity | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const programmeUrl = storedIdentityUrl(row.programmeUrl);
  if (!programmeUrl) return null;
  const names = (item: unknown) => Array.isArray(item) ? item.map((entry) => text(entry, 180)).filter((entry): entry is string => Boolean(entry)).slice(0, 8) : [];
  const identityUrls = (item: unknown) => {
    if (!Array.isArray(item)) return [];
    const urls: string[] = [];
    for (const entry of item) {
      const url = storedIdentityUrl(entry);
      if (!url || urls.includes(url)) continue;
      urls.push(url);
      if (urls.length >= 8) break;
    }
    return urls;
  };
  const provenanceRow = row.provenance && typeof row.provenance === "object" ? row.provenance as Record<string, unknown> : null;
  const aliasesProvenance = provenanceRow && Array.isArray(provenanceRow.aliases)
    ? provenanceRow.aliases.flatMap((item) => {
        const parsed = provenanceFrom(item);
        return parsed ? [parsed] : [];
      }).slice(0, 8)
    : [];
  return {
    programmeUrl,
    university: text(row.university, 180) ?? "",
    degreeLevel: text(row.degreeLevel, 40) ?? "",
    degreeClass: text(row.degreeClass, 40),
    officialTitles: names(row.officialTitles),
    aliases: names(row.aliases),
    trackOrCurriculum: text(row.trackOrCurriculum, 180),
    universityDomain: text(row.universityDomain, 180) ?? "",
    confirmedAt: text(row.confirmedAt, 40) ?? undefined,
    supportingSources: identityUrls(row.supportingSources),
    provenance: provenanceRow ? {
      programmeName: provenanceFrom(provenanceRow.programmeName),
      degreeLevel: provenanceFrom(provenanceRow.degreeLevel),
      degreeClass: provenanceFrom(provenanceRow.degreeClass),
      trackOrCurriculum: provenanceFrom(provenanceRow.trackOrCurriculum),
      aliases: aliasesProvenance,
    } : undefined,
  };
}

function passState(value: unknown): AdmissionPassState {
  const row = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const count = (item: unknown) => (typeof item === "number" && Number.isFinite(item) && item >= 0 ? Math.round(item) : 0);
  return {
    searchExecuted: row.searchExecuted === true,
    candidatesReturned: count(row.candidatesReturned),
    candidatesEligible: count(row.candidatesEligible),
    candidatesOpened: count(row.candidatesOpened),
    acceptedEvidenceFound: row.acceptedEvidenceFound === true,
    linksFound: count(row.linksFound),
    linksRelevant: count(row.linksRelevant),
    linksEligible: count(row.linksEligible),
    linksOpened: count(row.linksOpened),
    linkEvidenceAccepted: row.linkEvidenceAccepted === true,
    hubFollow: hubFollowFrom(row.hubFollow),
    searchDiagnostics: searchDiagnosticsFrom(row.searchDiagnostics),
  };
}

function hubFollowFrom(value: unknown): AdmissionHubFollow | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const hubUrl = text(row.hubUrl, 300);
  if (!hubUrl) return null;
  const count = (item: unknown) => (typeof item === "number" && Number.isFinite(item) && item >= 0 ? Math.min(Math.round(item), 3) : 0);
  return {
    hubUrl,
    linksConsidered: count(row.linksConsidered),
    linksOpened: count(row.linksOpened),
    targetUrls: Array.isArray(row.targetUrls) ? row.targetUrls.flatMap((item) => text(item, 300) ?? []).slice(0, 3) : [],
  };
}

const REJECTION_REASONS = new Set<SearchRejectionReason>([
  "off_domain", "duplicate", "pdf_downranked", "wrong_programme", "wrong_level",
  "wrong_language_variant", "untrusted_source", "source_scope_mismatch", "no_readable_page", "other",
]);

function searchDiagnosticsFrom(value: unknown): SearchStageDiagnostics | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const returned = typeof row.resultsReturned === "number" && Number.isFinite(row.resultsReturned) && row.resultsReturned >= 0 ? Math.round(row.resultsReturned) : 0;
  const candidates = Array.isArray(row.candidates) ? row.candidates.flatMap((item): SearchCandidateDiagnostic[] => {
    if (!item || typeof item !== "object") return [];
    const candidate = item as Record<string, unknown>;
    const url = text(candidate.url, 300);
    if (!url) return [];
    const reason = REJECTION_REASONS.has(candidate.rejectionReason as SearchRejectionReason) ? candidate.rejectionReason as SearchRejectionReason : null;
    return [{
      url,
      title: text(candidate.title, 120) ?? "",
      domain: text(candidate.domain, 120) ?? "",
      eligible: candidate.eligible === true,
      rejectionReason: reason,
      opened: candidate.opened === true,
    }];
  }).slice(0, 6) : [];
  return { query: text(row.query, 200), resultsReturned: returned, candidates };
}

function admissionProgressFrom(value: unknown): AdmissionProgress | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  return { general: passState(row.general), international: passState(row.international), universitaly: passState(row.universitaly) };
}

function identityConflictsFrom(value: unknown): IdentityConflict[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    const field = text(row.field, 40);
    const confirmedValue = text(row.confirmedValue, 80);
    const observedValue = text(row.observedValue, 80);
    const confirmedSource = text(row.confirmedSource, 400);
    const conflictingSource = text(row.conflictingSource, 400);
    if (!field || !confirmedValue || !observedValue || !confirmedSource || !conflictingSource) return [];
    return [{ field, confirmedValue, observedValue, confirmedSource, conflictingSource }];
  }).slice(0, 8);
}

function languageState(sources: DraftSource[], languageCode: "en" | "it"): ResearchResult["officialEnglishSource"] {
  const rows = sources.filter((source) => source.language === languageCode);
  if (rows.some((source) => source.sourceConfirmed)) return "found";
  if (rows.some((source) => source.sourceFound)) return "unconfirmed";
  return "not_found";
}

function storedSource(source: DraftSource): ResearchSource {
  return {
    url: source.url,
    title: source.title,
    sourceType: source.sourceType,
    language: source.language,
    academicYear: source.academicYear,
    publicationDate: source.publicationDate,
    lastUpdated: source.lastUpdated,
    scope: source.scope,
    relevantFields: source.relevantFields,
    sourceFound: source.sourceFound,
    sourceConfirmed: source.sourceConfirmed,
  };
}

export function validateResearch(input: unknown, slug: string, provider: string, target?: Pick<ResearchSubject, "name" | "universityName" | "level"> & Partial<Pick<ResearchSubject, "universityWebsite" | "admissionPortal" | "verifiedTitles" | "degreeClass" | "italianTitle">>): ResearchResult {
  const base = emptyResearchResult(slug, provider);
  if (!input || typeof input !== "object") {
    base.unknownFields = ["structured result"];
    base.researchWarnings = ["The model did not return a structured result."];
    return base;
  }
  const body = input as Record<string, unknown>;
  const confirmedIdentity = confirmedIdentityFrom(body.confirmedIdentity);
  const warnings: string[] = [];
  let drafts = sourcesFrom(body.sources);
  for (const source of drafts) {
    if (!source.readable && source.url.toLowerCase().endsWith(".pdf")) {
      warnings.push(`PDF FOUND — CONTENT NOT VERIFIED: ${source.url}`);
    } else if (source.sourceFound && !source.sourceConfirmed) {
      warnings.push(`Source found but not confirmed: ${source.url}`);
    }
  }
  let identityConfidence = base.identityConfidence;
  let catalogueAnomaly = base.catalogueAnomaly;
  let programmeName: string | null = null;
  let curriculumOrTrack: string | null = null;
  let degreeClass: string | null = null;
  let aliases: string[] = [];
  let gateConflicts: IdentityConflict[] = [];
  if (target) {
    const gate = identityFromSources(target, drafts);
    warnings.push(...gate.warnings);
    if (confirmedIdentity) {
      for (let index = warnings.length - 1; index >= 0; index -= 1) {
        const match = /^Identity not confirmed for (\S+)\. /.exec(warnings[index] ?? "");
        if (!match) continue;
        const source = drafts.find((item) => item.url === match[1]);
        if (!source || source.sourceType !== "official_admission_call") continue;
        if (postConfirmationAdmissionConflict(target, source, confirmedIdentity)) continue;
        warnings.splice(index, 1);
      }
    }
    identityConfidence = gate.confidence;
    catalogueAnomaly = gate.anomaly;
    programmeName = gate.programmeName;
    curriculumOrTrack = gate.curriculumOrTrack;
    degreeClass = confirmedIdentity ? confirmedIdentity.degreeClass : gate.degreeClass;
    aliases = confirmedIdentity?.aliases?.length ? [...confirmedIdentity.aliases] : gate.aliases;
    if (confirmedIdentity?.trackOrCurriculum) curriculumOrTrack = confirmedIdentity.trackOrCurriculum;
    gateConflicts = gate.identityConflicts;
    const trustFrozen = Boolean(confirmedIdentity);
    if (trustFrozen || gate.confidence === "confirmed") {
      const allowed = new Set(gate.kept);
      drafts = drafts.map((source, index) => {
        if (allowed.has(index)) return source;
        const decision = target ? sourceDecision(target, `${source.title}\n${source.pageText}`, source.url, confirmedIdentity) : null;
        if (confirmedIdentity && source.sourceType === "official_admission_call" && postConfirmationAdmissionConflict(target, source, confirmedIdentity)) {
          return { ...source, sourceConfirmed: false };
        }
        if (source.sourceType === "official_admission_call" && source.readable && source.pageText && !decision?.levelRejected) return source;
        if (trustFrozen && source.readable && source.pageText && decision && !decision.levelRejected && decision.scope !== "unrelated_programme" && decision.scope !== "unknown") return source;
        return { ...source, sourceConfirmed: false };
      });
    } else {
      drafts = drafts.map((source) => ({ ...source, sourceConfirmed: false }));
    }
    if (trustFrozen) {
      identityConfidence = "confirmed";
      catalogueAnomaly = null;
      const confirmingPresent = drafts.some((source) => isConfirmedProgrammeUrl(source.url, confirmedIdentity));
      if (!confirmingPresent || gate.confidence !== "confirmed") warnings.push("post_confirmation_source_validation_incomplete");
    }
    drafts = drafts.map((source) => {
      const computed = admissionSourceScope({ url: source.url, title: source.pageTitle || source.title, text: source.pageText }, target, confirmedIdentity);
      if (computed === "university_wide" || computed === "national") return { ...source, scope: "university" };
      if (computed === "department_specific") return { ...source, scope: "department" };
      return source;
    });
  }
  const confirmed = new Set(drafts.filter((source) => source.sourceConfirmed).map((source) => source.url));
  const evidence = evidenceFrom(body.fieldEvidence, confirmed);
  const english = (body.englishRequirement ?? {}) as Record<string, unknown>;
  const academic = (body.academicRequirement ?? {}) as Record<string, unknown>;
  const tests = (body.tests ?? {}) as Record<string, unknown>;
  const tuition = (body.tuition ?? {}) as Record<string, unknown>;
  const application = (body.application ?? {}) as Record<string, unknown>;
  const identity = (body.identity ?? {}) as Record<string, unknown>;
  const unknown = new Set<string>(Array.isArray(body.unknownFields) ? body.unknownFields.map(String) : []);
  const identityBlocked = Boolean(target) && identityConfidence !== "confirmed";

  const ielts = !identityBlocked && supported(evidence, "ieltsMin") ? numberOrNull(english.ieltsMin, 4, 9) : null;
  const toefl = !identityBlocked && supported(evidence, "toeflMin") ? numberOrNull(english.toeflMin, 0, 120) : null;
  const cefr = !identityBlocked && supported(evidence, "cefr") ? text(english.cefrLevel, 8) : null;
  const moi = !identityBlocked && supported(evidence, "moi") && (english.moiAccepted === true || english.moiAccepted === false) ? english.moiAccepted : null;
  const cambridge = !identityBlocked && supported(evidence, "cambridge") && (english.cambridge === true || english.cambridge === false) ? english.cambridge : null;
  if (english.ieltsMin != null && ielts == null) unknown.add("ieltsMin");
  if (english.toeflMin != null && toefl == null) unknown.add("toeflMin");
  if (english.moiAccepted != null && moi == null) unknown.add("moi");

  const deadlines = identityBlocked || !Array.isArray(application.deadlines)
    ? []
    : application.deadlines.flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        const row = item as Record<string, unknown>;
        const applicantType = text(row.applicantType, 80);
        const dateType = applicantType ? dateTypeFor(row.dateType, applicantType) : null;
        if (!applicantType || !dateType || dateType === "legal_reference_date" || !supported(evidence, `deadline:${applicantType}`)) {
          if (row.date) unknown.add("deadline");
          return [];
        }
        return [{ applicantType, applicantCategory: categoryFor(dateType), round: text(row.round, 40), date: text(row.date, 40), dateType }];
      });

  let programmeTeachingLanguage: ProgrammeTeachingLanguage | null = null;
  const curriculumTeachingLanguages: ResearchResult["identity"]["curriculumTeachingLanguages"] = [];
  if (!identityBlocked && target) {
    const labels = [target.name, splitCatalogueTitle(target.name).programmeName, target.italianTitle ?? "", ...(target.verifiedTitles ?? []), ...(confirmedIdentity?.aliases ?? [])];
    for (const source of drafts.filter((item) => item.sourceConfirmed && item.pageText)) {
      const headingTitle = source.pageTitle || source.title;
      const page = { url: source.url, title: headingTitle, text: source.pageText };
      if (admissionSourceScope(page, target, confirmedIdentity) !== "programme_specific") continue;
      const bound = isConfirmedProgrammeUrl(source.url, confirmedIdentity)
        || sourceDecision(target, `${headingTitle}\n${source.pageText}`, source.url, confirmedIdentity).confirmed;
      if (!bound) continue;
      const firstLine = (source.pageText.split("\n")[0] ?? "").trim();
      const heading = headingTeachingLanguage([headingTitle, ...(firstLine.length > 8 && firstLine.length <= 180 ? [firstLine] : [])], labels);
      if (!heading) continue;
      programmeTeachingLanguage = heading;
      evidence.push({
        field: "programmeTeachingLanguage",
        value: heading,
        sourceUrl: source.url,
        sourceTitle: headingTitle,
        language: source.language,
        academicYear: source.academicYear,
      });
      break;
    }
  }
  if (!identityBlocked) {
    for (const source of drafts.filter((item) => item.sourceConfirmed && item.pageText)) {
      const page = { url: source.url, title: source.pageTitle || source.title, text: source.pageText };
      const programmePage = !target || (
        admissionSourceScope(page, target, confirmedIdentity) === "programme_specific"
        && (isConfirmedProgrammeUrl(source.url, confirmedIdentity)
          || sourceDecision(target, `${page.title}\n${source.pageText}`, source.url, confirmedIdentity).confirmed)
      );
      const programme = programmePage ? detectProgrammeTeachingLanguage(source.pageText) : null;
      if (programme && !programmeTeachingLanguage) {
        programmeTeachingLanguage = programme;
        evidence.push({
          field: "programmeTeachingLanguage",
          value: programme,
          sourceUrl: source.url,
          sourceTitle: source.title,
          language: source.language,
          academicYear: source.academicYear,
        });
      }
      for (const item of detectCurriculumTeachingLanguages(source.pageText)) {
        if (curriculumTeachingLanguages.some((current) => current.curriculum.toLowerCase() === item.curriculum.toLowerCase())) continue;
        curriculumTeachingLanguages.push({ ...item, sourceUrl: source.url });
        evidence.push({
          field: "curriculumTeachingLanguage",
          value: `${item.curriculum}: ${item.language}`,
          sourceUrl: source.url,
          sourceTitle: source.title,
          language: source.language,
          academicYear: source.academicYear,
        });
      }
    }
  }
  let englishTaught = programmeTeachingLanguage ? englishTaughtFromProgramme(programmeTeachingLanguage) : null;
  if (!identityBlocked && englishTaught == null && programmeTeachingLanguage == null && supported(evidence, "englishTaught") && (identity.englishTaught === true || identity.englishTaught === false)) {
    englishTaught = identity.englishTaught;
  }
  if (programmeTeachingLanguage === "english" || programmeTeachingLanguage === "italian" || programmeTeachingLanguage === "mixed") {
    evidence.push({
      field: "englishTaught",
      value: String(englishTaught),
      sourceUrl: evidence.find((item) => item.field === "programmeTeachingLanguage")?.sourceUrl ?? "",
      sourceTitle: evidence.find((item) => item.field === "programmeTeachingLanguage")?.sourceTitle ?? "",
      language: "other",
      academicYear: null,
    });
  }
  if (identity.englishTaught != null && englishTaught == null && programmeTeachingLanguage !== "mixed") unknown.add("englishTaught");

  if (!identityBlocked) {
    for (const source of drafts.filter((item) => item.sourceConfirmed && item.pageText)) {
      const scope = target ? admissionSourceScope({ url: source.url, title: source.title, text: source.pageText }, target, confirmedIdentity) : "unknown";
      if (scope === "unrelated_programme") continue;
      if (target && isAdmissionHub({ url: source.url, title: source.pageTitle || source.title, text: source.pageText }, target, confirmedIdentity)) continue;
      for (const found of scopedDatedEvents(source.pageText, scope, confirmedIdentity?.degreeLevel || target?.level || null, { url: source.url, title: source.title })) {
        if (found.dateType === "legal_reference_date") continue;
        if (found.historical) {
          warnings.push(`Historical admission date was not used as the current deadline: ${found.date}`);
          continue;
        }
        for (let index = deadlines.length - 1; index >= 0; index -= 1) {
          const current = deadlines[index];
          if (current.date !== found.date) continue;
          if (current.dateType === found.dateType) continue;
          if (isApplyByDate(current.dateType) !== isApplyByDate(found.dateType)) deadlines.splice(index, 1);
        }
        if (deadlines.some((item) => item.dateType === found.dateType && item.date === found.date)) continue;
        deadlines.push({ applicantType: found.label, applicantCategory: found.applicantCategory, round: found.round, date: found.date, dateType: found.dateType });
        evidence.push({
          field: `deadline:${found.label}`,
          value: found.date,
          sourceUrl: source.url,
          sourceTitle: source.title,
          language: source.language,
          academicYear: source.academicYear,
        });
      }
    }
  }

  let ects = !identityBlocked && supported(evidence, "ects") ? text(academic.ectsRequirements, 220) : null;
  if (!identityBlocked && !ects) {
    for (const source of drafts.filter((item) => item.sourceConfirmed && item.pageText)) {
      const found = ectsRequirement(source.pageText);
      if (!found) continue;
      ects = found;
      evidence.push({
        field: "ects",
        value: found,
        sourceUrl: source.url,
        sourceTitle: source.title,
        language: source.language,
        academicYear: source.academicYear,
      });
      break;
    }
  }

  const modelTests = !identityBlocked && supported(evidence, "tests");
  let htmlImat = false;
  if (!identityBlocked && target && !modelTests) {
    for (const source of drafts.filter((item) => item.sourceConfirmed && item.pageText && !/\.pdf($|\?)/i.test(item.url))) {
      const page = { url: source.url, title: source.pageTitle || source.title, text: source.pageText };
      if (admissionSourceScope(page, target, confirmedIdentity) !== "programme_specific" || !imatFromHtml(source.pageText)) continue;
      htmlImat = true;
      evidence.push({
        field: "tests",
        value: "IMAT",
        sourceUrl: source.url,
        sourceTitle: page.title,
        language: source.language,
        academicYear: source.academicYear,
      });
      break;
    }
  }

  const conflicts = identityBlocked || !Array.isArray(body.conflicts)
    ? []
    : body.conflicts.flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        const row = item as Record<string, unknown>;
        const englishUrl = text(row.englishUrl, 400);
        const italianUrl = text(row.italianUrl, 400);
        if (!englishUrl || !italianUrl || !confirmed.has(englishUrl) || !confirmed.has(italianUrl)) return [];
        return [{
          field: text(row.field, 40) ?? "requirement",
          englishValue: text(row.englishValue, 80) ?? "Unknown",
          italianValue: text(row.italianValue, 80) ?? "Unknown",
          englishUrl,
          italianUrl,
          proposedValue: text(row.proposedValue, 80),
          reason: text(row.reason, 300) ?? "Official English and Italian sources disagree.",
        }];
      });

  const evidenceFields = new Set(evidence.map((item) => item.field));
  const verifiedSourceNotes: string[] = [];
  for (const note of [english.notes, academic.notes, tests.notes, tuition.notes].map((item) => text(item, 240)).filter((item): item is string => Boolean(item))) {
    if (identityBlocked || unsupportedNote(note, evidenceFields)) warnings.push(`Possible claim removed because no confirmed official source supports it: ${note}`);
    else verifiedSourceNotes.push(note);
  }
  const noteFor = (field: "cefr" | "ects" | "tests" | "tuition" | "money", note: unknown) => {
    const clean = text(note, 240);
    if (!clean || identityBlocked || unsupportedNote(clean, evidenceFields)) return null;
    if (field === "cefr" && !evidenceFields.has("cefr") && !evidenceFields.has("ieltsMin") && !evidenceFields.has("toeflMin") && !evidenceFields.has("moi")) return null;
    return verifiedSourceNotes.includes(clean) ? clean : null;
  };

  let canonicalIdentity = confirmedIdentity;
  if (target && confirmedIdentity) {
    canonicalIdentity = enrichConfirmedIdentity(
      confirmedIdentity,
      target,
      drafts.filter((item) => item.sourceConfirmed && item.pageText).map((item) => ({
        url: item.url,
        title: item.title,
        text: item.pageText,
        sourceType: item.sourceType,
      })),
    );
    degreeClass = canonicalIdentity.degreeClass;
    if (canonicalIdentity.aliases.length) aliases = [...canonicalIdentity.aliases];
    if (canonicalIdentity.trackOrCurriculum) curriculumOrTrack = canonicalIdentity.trackOrCurriculum;
    for (const source of drafts.filter((item) => item.pageText && isConfirmedProgrammeUrl(item.url, canonicalIdentity))) {
      const decision = sourceDecision(target, `${source.title}\n${source.pageText}`, source.url, canonicalIdentity);
      if (decision.levelRejected) warnings.push("identity_conflict: the confirmed programme page contradicts the confirmed degree level.");
    }
    for (const source of drafts.filter((item) => item.pageText)) {
      const observed = identityObservation({ url: source.url, title: source.title, text: source.pageText }, canonicalIdentity, target);
      if (observed && !gateConflicts.some((item) => item.field === observed.field && item.conflictingSource === observed.conflictingSource)) gateConflicts.push(observed);
    }
  }

  const identityConflicts = identityConflictsFrom(body.identityConflicts);
  for (const conflict of gateConflicts) {
    if (!identityConflicts.some((item) => item.field === conflict.field && item.conflictingSource === conflict.conflictingSource)) identityConflicts.push(conflict);
  }
  for (const conflict of identityConflicts) {
    warnings.push(`identity_conflict: ${conflict.field} stays ${conflict.confirmedValue}; observed ${conflict.observedValue}.`);
  }

  const linkedDocuments = linkedDocumentsFrom(body.linkedDocuments);
  if (linkedDocuments.length) warnings.push("PDF found — content not verified");

  const nonEuApplicationFound = deadlines.some((item) => (
    item.dateType === "non_eu_application_deadline"
    || item.dateType === "non_eu_abroad_deadline"
    || item.dateType === "non_eu_deadline"
    || item.dateType === "visa_applicant_deadline"
  ));
  if (!identityBlocked && !nonEuApplicationFound) warnings.unshift("Official non-EU application deadline not confirmed.");

  const unconfirmedModelIdentity = !identityBlocked ? null : {
    university: text(identity.university, 180),
    degreeLevel: text(identity.degreeLevel, 40),
    programmeName: text(identity.officialProgrammeName, 180),
    language: text(identity.language, 40),
  };
  const diagnosticIdentity = unconfirmedModelIdentity && (unconfirmedModelIdentity.university || unconfirmedModelIdentity.degreeLevel || unconfirmedModelIdentity.programmeName || unconfirmedModelIdentity.language)
    ? unconfirmedModelIdentity
    : null;

  const outcome = catalogueAnomaly ? "catalogue_review_required" as const : identityBlocked ? "research_incomplete_identity" as const : "pending_review" as const;
  return {
    ...base,
    researchedAt: new Date().toISOString(),
    targetAcademicYear: text(body.targetAcademicYear, 40),
    researchIncomplete: identityBlocked || confirmed.size === 0 || body.researchIncomplete === true,
    researchOutcome: outcome,
    identityConfidence: target ? identityConfidence : confirmed.size ? "confirmed" : "not_found",
    searchesAttempted: Array.isArray(body.searchesAttempted) ? body.searchesAttempted.map((item) => String(item)).slice(0, 6) : [],
    discoveryTrace: discoveryTraceFrom(body.discoveryTrace),
    ambiguousPages: Array.isArray(body.ambiguousPages) ? body.ambiguousPages.map((item) => String(item)).filter((item) => officialUrl(item) && confirmed.has(item)).slice(0, 4) : [],
    verifiedSourceNotes: identityBlocked ? [] : verifiedSourceNotes,
    researchWarnings: warnings.slice(0, 12),
    officialEnglishSource: languageState(drafts, "en"),
    officialItalianSource: languageState(drafts, "it"),
    catalogueAnomaly,
    identity: {
      officialProgrammeName: identityBlocked ? null : canonicalIdentity?.officialTitles[0] || text(identity.officialProgrammeName, 180) || programmeName,
      programmeName,
      curriculumOrTrack,
      degreeClass,
      aliases,
      university: identityBlocked ? null : canonicalIdentity?.university || text(identity.university, 180),
      degreeLevel: identityBlocked ? null : canonicalIdentity?.degreeLevel || text(identity.degreeLevel, 40),
      language: identityBlocked ? null : text(identity.language, 40),
      englishTaught: identityBlocked ? null : englishTaught,
      programmeTeachingLanguage: identityBlocked ? null : programmeTeachingLanguage,
      curriculumTeachingLanguages: identityBlocked ? [] : curriculumTeachingLanguages,
    },
    application: {
      openingDate: !identityBlocked && supported(evidence, "openingDate") ? text(application.openingDate, 40) : null,
      deadlines,
      applicationFee: !identityBlocked && supported(evidence, "applicationFee")
        ? { amount: numberOrNull((application.applicationFee as { amount?: unknown } | null)?.amount, 0, 100000), currency: "EUR" as const, notes: null }
        : null,
    },
    englishRequirement: {
      cefrLevel: cefr,
      ieltsMin: ielts,
      toeflMin: toefl,
      moiAccepted: moi,
      cambridge,
      notes: noteFor("cefr", english.notes),
    },
    academicRequirement: {
      minimumCgpa: !identityBlocked && supported(evidence, "minimumCgpa") ? numberOrNull(academic.minimumCgpa, 0, 100) : null,
      cgpaScale: !identityBlocked && supported(evidence, "minimumCgpa") ? numberOrNull(academic.cgpaScale, 1, 100) : null,
      minimumPercentage: !identityBlocked && supported(evidence, "minimumPercentage") ? numberOrNull(academic.minimumPercentage, 0, 100) : null,
      requiredBackground: !identityBlocked && supported(evidence, "requiredBackground") && Array.isArray(academic.requiredBackground)
        ? academic.requiredBackground.map((item) => String(item).trim()).filter(Boolean).slice(0, 12)
        : [],
      ectsRequirements: ects,
      notes: noteFor("ects", academic.notes),
    },
    tests: {
      required: htmlImat ? true : modelTests && (tests.required === true || tests.required === false) ? tests.required : null,
      types: htmlImat ? ["IMAT"] : modelTests && Array.isArray(tests.types) ? tests.types.map(String).slice(0, 8) : [],
      notes: noteFor("tests", tests.notes),
    },
    tuition: {
      type: !identityBlocked && supported(evidence, "tuition") && (tuition.type === "single" || tuition.type === "range" || tuition.type === "variable" || tuition.type === "unknown") ? tuition.type : null,
      amount: !identityBlocked && supported(evidence, "tuition") && tuition.type === "single" ? numberOrNull(tuition.amount, 0, 100000) : null,
      min: !identityBlocked && supported(evidence, "tuition") && tuition.type === "range" ? numberOrNull(tuition.min, 0, 100000) : null,
      max: !identityBlocked && supported(evidence, "tuition") && tuition.type === "range" ? numberOrNull(tuition.max, 0, 100000) : null,
      currency: "EUR",
      period: tuition.period === "year" || tuition.period === "programme" || tuition.period === "semester" ? tuition.period : null,
      notes: noteFor("tuition", tuition.notes),
    },
    sources: capSavedSources(drafts, canonicalIdentity).map(storedSource),
    linkedDocuments,
    conflicts,
    unknownFields: [...unknown].slice(0, 20),
    fieldEvidence: identityBlocked ? [] : evidence,
    confirmedIdentity: canonicalIdentity,
    identityConflicts,
    unconfirmedModelIdentity: diagnosticIdentity,
    admissionProgress: admissionProgressFrom(body.admissionProgress),
    usage: usageFrom(body.apiUsage),
    reviewStatus: "pending_review",
  };
}
