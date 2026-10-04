import { createHash } from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import { proposalToEnrichment } from "../src/lib/research/approve-research";
import { conflictFixture, italianEvidenceFixture } from "../src/lib/research/fixtures";
import { admissionCandidatesFromResponse, buildAdmissionRequest, buildDiscoveryRequest, buildExtractionRequest, buildUrlDiscoveryRequest, HUB_LIMITS, openaiResearch } from "../src/lib/research/openai-provider";
import { admissionSearchPasses, ResearchRateLimitError, researchBudget, urlDiscoveryPasses } from "../src/lib/research/research-budget";
import { buildResearchPrompt, buildUrlDiscoveryQuery, italianDegreePhrase, trackSearchPhrases } from "../src/lib/research/research-programme";
import { deleteResearchJob, insertResearchJob, latestResearchJob, recentResearchWarning, runningResearchBlock, setReviewStatus } from "../src/lib/portal-store/research";
import { getResearchProvider } from "../src/lib/research/provider";
import { runResearchJob } from "../src/lib/research/run-research";
import { conflictFor } from "../src/lib/research/source-policy";
import { validateResearch } from "../src/lib/research/validate-research";
import { applicationClosesMessage, classifyDateContext, datedEvents, detectCurriculumTeachingLanguages, detectProgrammeTeachingLanguage, headingTeachingLanguage, isApplyByDate, reclassifyDate, teachingLanguage } from "../src/lib/research/extract-facts";
import { acceptedAdmissionEvents, admissionCandidateRank, admissionSourceScope, hasGeneralAdmissionDeadline, hasInternationalDeadline, hasUniversitalyDeadline, isAdmissionHub, scopedDatedEvents } from "../src/lib/research/admission-gates";
import { INDEX_LINK_LIMIT, buildDiscoveryQueries, detectDegreeLevel, identityQualityCounts, isDiscoveryCandidate, programmeLinksFromIndex, scoreCandidate, searchTitleVariants, splitCatalogueTitle } from "../src/lib/research/discovery";
import { extractOfficialUniversityNames, memoryUniversityFingerprintCache, rememberUniversityFingerprint } from "../src/lib/research/university-identity";
import { officialTargetBlock } from "../src/lib/research/fetch-safety";
import { freezeConfirmedIdentity, identityFromSources, identityObservation, sourceDecision } from "../src/lib/research/identity-gate";
import { DISCOVERY_LIMITS, discoverOfficialCandidates, internationalAdmissionLinksFromHtml, isCourseIndexPath, orderedOfficialUrls, parseOfficialDocument, readableDocument, scoreOfficialCandidate, selectableRoots, trustedDiscoveryHints } from "../src/lib/research/official-discovery";
import { admissionPdfInventory, rankHubTargetLinks, selectAdmissionLinks } from "../src/lib/research/page-links";
import { learnedDiscoveryRoots, memoryOfficialRootCache } from "../src/lib/research/official-roots";
import { deadlineReminderMessage } from "../src/lib/reminders/generate";
import { buildDegreeCatalogue, dedupeResolvedSlugs, publicCatalogue, resolveCatalogueSlug } from "../src/lib/programme-catalogue";
import { EMPTY_FINDER, filterProgrammes } from "../src/lib/programme-filters";
import type { UniversitiesDataset } from "../src/lib/types";
import type { ResearchSubject } from "../src/lib/research/research-schema";
import { loadLocalEnv } from "./load-env";

loadLocalEnv();

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

const subject: ResearchSubject = {
  slug: "sample-master-business",
  name: "Business Administration",
  universityName: "Example University",
  level: "master",
  city: "Rome",
  region: "lazio",
  language: "English",
  englishRequirement: "",
  universityWebsite: "https://example.edu",
  admissionPortal: null,
};

const prompt = buildResearchPrompt(subject);
assert(prompt.includes("bando di ammissione") && prompt.includes("English AND in Italian"), "research searches English and Italian");
assert(prompt.includes("requisiti di accesso") && prompt.includes("requisiti curriculari") && prompt.includes("residenti all'estero") && prompt.includes("test di ammissione"), "Italian admission terms stay in the prompt");
assert(!/passport|student email|payment|consultancy note/i.test(prompt), "research prompt has no student personal data");
const discovery = buildDiscoveryRequest(subject);
const discoveryTool = (discovery.tools as Array<{ search_context_size?: string; filters?: { allowed_domains?: string[] } }>)[0];
assert(researchBudget().maxToolCalls === 6, "the tool-call cap is 6");
assert(discovery.max_tool_calls === 6, "discovery cannot ask for more than 6 searches");
assert(discoveryTool?.search_context_size === "low", "search context stays low");
assert(discoveryTool?.filters?.allowed_domains?.includes("example.edu"), "search stays on the official domain");
assert(!("tools" in buildExtractionRequest(subject, [])), "extraction does not start another web search");
const admission = buildAdmissionRequest(subject, 2, ["Informatica Applicata"]);
const admissionTool = (admission.tools as Array<{ search_context_size?: string; filters?: { allowed_domains?: string[] } }>)[0];
assert(admissionSearchPasses() === 2 && researchBudget().maxToolCalls === 6, "admission search passes stay separate from the discovery budget");
assert(admission.max_tool_calls === 1 && buildAdmissionRequest(subject, 1).max_tool_calls === 1 && admissionTool?.search_context_size === "low", "each admission pass is one official-domain search");
assert(admissionTool?.filters?.allowed_domains?.includes("example.edu"), "admission search stays on the official domain");
const admissionText = (admission.input as Array<{ content: string }>)[0]?.content ?? "";
assert(admissionText.includes("not the application deadline") && admissionText.includes("extra-UE") && admissionText.includes("Admission search 2"), "the international admission pass keeps enrolment separate from application");
const savedAdmissionPasses = process.env.RESEARCH_ADMISSION_SEARCH_PASSES;
process.env.RESEARCH_ADMISSION_SEARCH_PASSES = "0";
assert(admissionSearchPasses() === 0, "admission research can be disabled for a test");
if (savedAdmissionPasses == null) delete process.env.RESEARCH_ADMISSION_SEARCH_PASSES;
else process.env.RESEARCH_ADMISSION_SEARCH_PASSES = savedAdmissionPasses;

const bachelorMismatch = validateResearch({
  identity: { officialProgrammeName: "International Studies (LM-52)", degreeLevel: "master" },
  englishRequirement: { cefrLevel: "B2", notes: "B2 is required." },
  sources: [{ url: "https://www.uniroma3.it/didattica/lauree-ws-lm/international-studies-lm-52/", title: "International Studies (LM-52)", sourceType: "official_programme_page", language: "it", pageText: "Laurea Magistrale LM-52 International Studies Roma Tre" }],
  fieldEvidence: [{ field: "cefr", value: "B2", sourceUrl: "https://www.uniroma3.it/didattica/lauree-ws-lm/international-studies-lm-52/", language: "it" }],
}, subject.slug, "openai", { name: "International Studies", universityName: "Roma Tre University", level: "bachelor" });
assert(bachelorMismatch.researchOutcome === "catalogue_review_required", "only a different degree level requires catalogue review");
assert(bachelorMismatch.catalogueAnomaly?.catalogueLevel === "bachelor" && bachelorMismatch.catalogueAnomaly.officialLevel === "master", "the catalogue anomaly records both levels");
assert(bachelorMismatch.identityConfidence === "not_found", "the mismatched identity is not confirmed");
assert(bachelorMismatch.englishRequirement.cefrLevel == null, "requirements from the wrong degree level are removed");
assert(bachelorMismatch.researchWarnings.some((warning) => /identity rejected/i.test(warning)), "the mismatch is recorded as a warning");

const parthenopePage = "Università Parthenope Laurea Magistrale Informatica Applicata. Classe LM-18. English title: Applied Computer Science. Curriculum Machine Learning and Big Data. Lingua di Erogazione Inglese. Accesso Libero. Inizio Immatricolazione 27 Luglio 2026. Scadenza Immatricolazione 1 Marzo 2027. Requisiti curriculari minimi rappresentati da 45 CFU così distribuiti: area fisica per almeno 5 CFU; area informatica per almeno 22 CFU; area matematica per almeno 15 CFU.";
const parthenope = validateResearch({
  sources: [
    { url: "https://orienta.uniparthenope.it/laurea-magistrale/informatica-applicata/", title: "Informatica Applicata", sourceType: "official_programme_page", language: "it", pageText: parthenopePage, sourceConfirmed: true },
    { url: "https://international.uniparthenope.it/all-courses/applied-computer-science/", title: "Applied Computer Science", sourceType: "official_programme_page", language: "en", sourceFound: true, sourceConfirmed: false, readable: false },
  ],
  englishRequirement: { ieltsMin: 6.5 },
  fieldEvidence: [{ field: "ieltsMin", value: "6.5", sourceUrl: "https://international.uniparthenope.it/all-courses/applied-computer-science/", language: "en" }],
}, "parthenope-applied", "openai", { name: "Applied Computer Science (Machine Learning and Big Data)", universityName: "University of Naples Parthenope", level: "master" });
assert(parthenope.identityConfidence === "confirmed", "an Italian official title can confirm the English catalogue name");
assert(parthenope.identity.aliases.includes("Informatica Applicata"), "the official Italian title is stored as an alias");
assert(parthenope.identity.englishTaught === true, "Lingua di Erogazione Inglese sets englishTaught");
assert(parthenope.application.deadlines.some((item) => item.dateType === "enrolment_open" && item.date === "2026-07-27"), "enrolment opening is kept with its date type");
assert(parthenope.application.deadlines.some((item) => item.dateType === "enrolment_deadline" && item.date === "2027-03-01"), "enrolment deadline is kept with its date type");
assert(parthenope.application.deadlines.every((item) => item.dateType !== "non_eu_deadline" && item.dateType !== "non_eu_abroad_deadline" && item.dateType !== "application_deadline"), "an enrolment date is not stored as an application or Non-EU deadline");
assert(parthenope.academicRequirement.ectsRequirements?.includes("45 CFU") && parthenope.academicRequirement.ectsRequirements.includes("15 CFU"), "the CFU breakdown is stored");
assert(parthenope.englishRequirement.ieltsMin == null, "an unconfirmed English page cannot create an IELTS value");
assert(parthenope.sources.some((source) => source.language === "en" && source.sourceFound && !source.sourceConfirmed), "an inaccessible English page stays found but unconfirmed");
assert(parthenope.officialEnglishSource === "unconfirmed", "the English source is not treated as confirmed");
assert(parthenope.officialItalianSource === "found", "a confirmed Italian page is enough when the English page cannot be opened");
assert(parthenope.identity.curriculumOrTrack === "Machine Learning and Big Data", "the parenthetical track is stored after the page confirms it");
assert(!parthenope.application.deadlines.some((item) => item.dateType === "application_deadline" || item.dateType === "application_open"), "enrolment-only evidence leaves the application deadline unknown");

const translatedPage = { title: "Informatica Applicata", pageText: "English title: Applied Computer Science. Università Parthenope." };
assert(isDiscoveryCandidate({ name: "Applied Computer Science (Machine Learning and Big Data)" }, translatedPage), "an official English title makes the Italian page a discovery candidate");
const parentPage = { title: "Applied Computer Science", pageText: "Laurea Magistrale" };
assert(isDiscoveryCandidate({ name: "Applied Computer Science (Machine Learning and Big Data)" }, parentPage), "the parent programme can be discovered without the parenthetical track");
const trackOnly = validateResearch({
  sources: [{ url: "https://orienta.example.edu/informatica/", title: "Informatica Applicata", sourceType: "official_programme_page", language: "it", pageText: "Università Parthenope Laurea Magistrale Classe LM-18 Curriculum Machine Learning and Big Data. English title is not printed." }],
}, "track-class", "openai", { name: "Applied Computer Science (Machine Learning and Big Data)", universityName: "University of Naples Parthenope", level: "master" });
assert(trackOnly.identityConfidence === "confirmed" && trackOnly.identity.degreeClass === "LM-18", "degree class plus the curriculum confirms a translated title");
const titleAlone = validateResearch({
  sources: [{ url: "https://orienta.example.edu/informatica/", title: "Informatica Applicata", sourceType: "official_programme_page", language: "it", pageText: "Università Parthenope Laurea Magistrale Informatica Applicata." }],
}, "title-alone", "openai", { name: "Applied Computer Science (Machine Learning and Big Data)", universityName: "University of Naples Parthenope", level: "master" });
assert(titleAlone.identityConfidence !== "confirmed", "a translated title alone does not confirm identity");
const news = scoreCandidate({ url: "https://www.uniparthenope.it/news/applied-computer-science", title: "Applied Computer Science", pageText: "Università Parthenope Laurea Magistrale" }, { name: "Applied Computer Science", universityName: "University of Naples Parthenope", level: "master" });
const programme = scoreCandidate({ url: "https://orienta.uniparthenope.it/laurea-magistrale/informatica-applicata/", title: "Applied Computer Science", pageText: "Università Parthenope Laurea Magistrale" }, { name: "Applied Computer Science", universityName: "University of Naples Parthenope", level: "master" });
assert(programme > news, "a programme page ranks above a news article");
const queries = buildDiscoveryQueries({ name: "Applied Computer Science (Machine Learning and Big Data)", level: "master", universityWebsite: "https://www.uniparthenope.it", admissionPortal: null });
assert(queries.length <= 4 && queries.some((query) => query.includes("\"Applied Computer Science\"")) && queries.some((query) => query.includes("Machine Learning and Big Data")) && !queries.some((query) => /informatica applicata/i.test(query)), "queries use the catalogue name and track, not an invented translation");
const indexHtml = [1, 2, 3, 4, 5].map((item) => `<a href="/laurea-magistrale/course-${item}/">Course</a>`).join("");
assert(programmeLinksFromIndex(indexHtml, "example.edu", INDEX_LINK_LIMIT).length === 3, "index fallback stays within three links");
const parts = splitCatalogueTitle("Applied Computer Science (Machine Learning and Big Data)");
assert(parts.programmeName === "Applied Computer Science" && parts.curriculumOrTrack === "Machine Learning and Big Data", "parentheses split the programme from the track");

assert(datedEvents("Scadenza immatricolazione 1 marzo 2027")[0]?.dateType === "enrolment_deadline", "immatricolazione is an enrolment deadline");
assert(datedEvents("Scadenza domanda di ammissione 15 febbraio 2027")[0]?.dateType === "application_deadline", "domanda di ammissione is an application deadline");
assert(datedEvents("Studenti extra-UE residenti all'estero: domanda entro 31 gennaio 2027")[0]?.dateType === "non_eu_application_deadline", "extra-UE abroad is a separate application deadline");
assert(datedEvents("Studenti extra-UE residenti all'estero: domanda entro 31 gennaio 2027")[0]?.applicantCategory === "non_eu_residing_abroad", "extra-UE residing abroad keeps its applicant category");
assert(datedEvents("Pre-iscrizione tramite Universitaly entro 30 novembre 2026")[0]?.dateType === "universitaly_deadline", "Universitaly stays a pre-enrolment deadline");
const bothDates = datedEvents("Scadenza domanda di ammissione 15 febbraio 2027. Scadenza immatricolazione 1 marzo 2027.");
assert(bothDates.some((item) => item.dateType === "application_deadline") && bothDates.some((item) => item.dateType === "enrolment_deadline"), "application and enrolment dates stay separate");
assert(reclassifyDate("application_deadline", "Scadenza immatricolazione 1 marzo 2027") === "enrolment_deadline", "source wording overrides an application label");
assert(reclassifyDate("enrolment_deadline", "Scadenza domanda di ammissione 15 febbraio 2027") === "application_deadline", "source wording overrides an enrolment label");
assert(applicationClosesMessage("enrolment_deadline", { name: "Applied Computer Science", days: 7 }) == null, "an enrolment date does not create an application reminder");
assert(applicationClosesMessage("immatriculation_deadline", { name: "Applied Computer Science", days: 7 }) == null, "an immatricolazione date does not create an application reminder");
assert(datedEvents("Studenti internazionali: domanda di ammissione 10 febbraio 2027")[0]?.applicantCategory === "international", "an international deadline is not treated as non-EU residing abroad");
assert(datedEvents("Richiedenti visto: domanda di ammissione 5 febbraio 2027")[0]?.dateType === "visa_applicant_deadline", "a visa applicant deadline stays separate");
assert(datedEvents("Domanda di ammissione per titolo di studio estero 8 febbraio 2027")[0]?.dateType === "foreign_qualification_deadline", "a foreign-qualification deadline stays separate");
assert(datedEvents("Universitaly pre-iscrizione 30 novembre 2026")[0]?.dateType === "universitaly_deadline", "Universitaly stays separate from enrolment");
const rounds = datedEvents("Round 1 domanda di ammissione 15 gennaio 2027. Round 2 EU applicants domanda di ammissione 20 febbraio 2027.");
assert(rounds.some((item) => item.round === "1" && item.date === "2027-01-15" && item.applicantCategory === "all_applicants") && rounds.some((item) => item.round === "2" && item.date === "2027-02-20" && item.applicantCategory === "eu"), "application rounds stay separate");
assert(datedEvents("Bando 2023/2024 domanda di ammissione 15 gennaio 2024")[0]?.historical === true, "an older admission cycle is historical");
const historical = validateResearch({
  sources: [{ url: "https://example.edu/bando-2023/", title: "Bando", sourceType: "official_admission_call", language: "it", pageText: "Example University Laurea Magistrale Business Administration. Bando 2023/2024 domanda di ammissione 15 gennaio 2024.", sourceConfirmed: true }],
}, subject.slug, "openai", subject);
assert(historical.identityConfidence === "confirmed" && historical.application.deadlines.every((item) => item.date !== "2024-01-15"), "an older cycle is not stored as the current application deadline");
assert(historical.researchWarnings.some((warning) => /historical admission date/i.test(warning)), "an older cycle stays visible as historical evidence");
assert(deadlineReminderMessage({ name: "Applied Computer Science", universityName: "Parthenope", days: 7, dateType: "enrolment_deadline" }) == null, "catalogue reminder wording is not used for enrolment");
assert(deadlineReminderMessage({ name: "Applied Computer Science", universityName: "Parthenope", days: 7 })?.includes("closes in 7 days"), "an ordinary catalogue deadline can still remind");
assert(classifyDateContext("domanda di ammissione")?.dateType === "application_deadline", "Italian application wording is classified");
assert(classifyDateContext("immatricolazione")?.dateType === "enrolment_deadline", "Italian enrolment wording is classified");
const enrolmentOpening = datedEvents("Enrolment for applicants with a foreign qualification opens on 15 September 2026.")[0];
assert(enrolmentOpening?.dateType === "enrolment_open" && enrolmentOpening.date === "2026-09-15" && enrolmentOpening.applicantCategory === "foreign_qualification", "an enrolment opening is not stored as a deadline");
const paduaEnrolmentOpening = datedEvents("Per chi ha titolo estero, le iscrizioni per l'a.a 2027/28 aprono il 15 settembre 2026.")[0];
assert(paduaEnrolmentOpening?.dateType === "enrolment_open" && paduaEnrolmentOpening.date === "2026-09-15" && paduaEnrolmentOpening.applicantCategory === "foreign_qualification", "Padua foreign-qualification enrolment that opens stays an opening");
const enrolmentClosing = datedEvents("Enrolment closes on 30 September 2026.")[0];
assert(enrolmentClosing?.dateType === "enrolment_deadline" && enrolmentClosing.date === "2026-09-30", "an enrolment closing stays a deadline");
const internationalPage = { url: "https://www.unipd.it/ammissione-studenti-internazionali", title: "Ammissione studenti internazionali" };
const internationalWindow = datedEvents("The first application window closes on 15 November 2026.", internationalPage)[0];
assert(internationalWindow?.dateType === "application_deadline" && internationalWindow.applicantCategory === "international" && internationalWindow.date === "2026-11-15", "an unlabeled window on an international admissions page stays international");
assert(internationalWindow?.applicantCategory !== "all_applicants" && internationalWindow?.applicantCategory !== "non_eu" && internationalWindow?.applicantCategory !== "non_eu_residing_abroad" && internationalWindow?.applicantCategory !== "visa_applicant", "international page context does not become all applicants, non-EU, or visa");
const italianWindow = datedEvents("La prima finestra di candidatura si chiude il 15 novembre 2026.", internationalPage)[0];
assert(italianWindow?.dateType === "application_deadline" && italianWindow.applicantCategory === "international" && italianWindow.date === "2026-11-15", "the Padua international window is not stored for all applicants");
const nonEuSection = datedEvents([
  "Non-EU students residing abroad",
  "This paragraph explains the documents required for the selected course and does not name an applicant group. ".repeat(3),
  "The application window closes on 2 May 2027.",
].join("\n"), internationalPage)[0];
assert(nonEuSection?.dateType === "non_eu_application_deadline" && nonEuSection.applicantCategory === "non_eu_residing_abroad" && nonEuSection.date === "2027-05-02", "an explicit non-EU-abroad section stays narrower than the international page");
const euSection = datedEvents("EU applicants only\nThe first application window closes on 15 November 2026.", internationalPage)[0];
assert(euSection?.applicantCategory === "eu" && euSection.dateType === "eu_application_deadline", "an EU section wins over the international page");
const allApplicantsWindow = datedEvents("The first application window closes on 15 November 2026 for all applicants.", internationalPage)[0];
assert(allApplicantsWindow?.applicantCategory === "all_applicants" && allApplicantsWindow.dateType === "application_deadline", "explicit all-applicants wording stays broader than the page");
const programmeWindow = datedEvents("The application window closes on 15 November 2026.", { url: "https://www.unipd.it/corsi-di-laurea/accounting-finance-and-business-consulting", title: "ACCOUNTING, FINANCE AND BUSINESS CONSULTING" })[0];
assert(programmeWindow?.applicantCategory === "all_applicants" && programmeWindow.dateType === "application_deadline", "a programme page without an applicant restriction stays all applicants");
const introEvents = scopedDatedEvents([
  "La prima finestra di candidatura si chiude il 15 novembre 2026.",
  "Corsi di laurea e di laurea magistrale a ciclo unico",
  "Domanda di ammissione entro il 15 febbraio 2027.",
].join("\n"), "university_wide", "master", internationalPage);
assert(introEvents.some((item) => item.date === "2026-11-15" && item.dateType === "application_deadline" && item.applicantCategory === "international") && !introEvents.some((item) => item.date === "2027-02-15"), "page-wide text before the first degree heading stays eligible and international");
assert(applicationClosesMessage("enrolment_open", { name: "Accounting, Finance and Business Consulting", days: 7 }) == null, "an enrolment opening does not say the application closes");
assert(applicationClosesMessage("application_open", { name: "Accounting, Finance and Business Consulting", days: 7 }) == null, "an application opening does not say the application closes");
assert(deadlineReminderMessage({ name: "Accounting, Finance and Business Consulting", universityName: "University of Padua", days: 7, dateType: "enrolment_open" }) == null, "an enrolment opening does not create a deadline reminder");
assert(deadlineReminderMessage({ name: "Accounting, Finance and Business Consulting", universityName: "University of Padua", days: 7, dateType: "application_open" }) == null, "an application opening does not create a deadline reminder");
assert(applicationClosesMessage("application_deadline", { name: "Accounting, Finance and Business Consulting", days: 7 })?.includes("closes in 7 days"), "an application deadline can still say that it closes");
assert(hasGeneralAdmissionDeadline(datedEvents("Applications open on 15 September 2026.")) === false, "an opening date does not answer the general deadline search");
const quality = identityQualityCounts([
  { reviewStatus: "catalogue_review_required" },
  { reviewStatus: "research_incomplete_identity" },
  { reviewStatus: "pending_review" },
], 1);
assert(quality.identityReviewRequired === 1 && quality.programmeNotFound === 1 && quality.degreeLevelMismatch === 1 && quality.translatedAliasConfirmed === 1, "identity quality counts stay on the admin desk");

const unsupported = validateResearch({
  englishRequirement: { cefrLevel: "B2", notes: "A certified B2 English level is required." },
  sources: [{ url: "https://example.edu/programme", title: "Programme page", sourceType: "official_programme_page", language: "en" }],
}, subject.slug, "openai");
assert(unsupported.englishRequirement.cefrLevel == null && unsupported.englishRequirement.notes == null, "an unsupported B2 claim is not stored");
assert(unsupported.researchWarnings.some((warning) => /B2/i.test(warning)), "the removed B2 claim becomes a warning");

const unreadPdf = validateResearch({
  englishRequirement: { notes: "The PDF says B2." },
  sources: [{ url: "https://www.uniroma3.it/bando.pdf", title: "Bando", sourceType: "official_admission_call", language: "it", readable: false }],
}, subject.slug, "openai");
assert(unreadPdf.englishRequirement.notes == null, "an unread PDF cannot supply a requirement");
assert(unreadPdf.researchWarnings.some((warning) => warning.includes("PDF FOUND — CONTENT NOT VERIFIED")), "an unread PDF is recorded as unverified");

const blocked = validateResearch({
  englishRequirement: { ieltsMin: 6.5 },
  sources: [{ url: "https://reddit.com/r/italy", title: "Forum", sourceType: "official_programme_page", language: "en" }],
  fieldEvidence: [{ field: "ieltsMin", value: "6.5", sourceUrl: "https://reddit.com/r/italy", language: "en" }],
  reviewStatus: "verified",
}, subject.slug, "mock");
assert(blocked.reviewStatus === "pending_review", "AI output cannot mark itself verified");
assert(blocked.englishRequirement.ieltsMin == null, "an unofficial source cannot create an IELTS value");
assert(blocked.usage == null, "a rejected source does not invent token usage");

const italian = validateResearch(italianEvidenceFixture(subject.slug), subject.slug, "mock");
assert(italian.sources[0]?.language === "it", "the Italian source is kept");
assert(italian.englishRequirement.cefrLevel === "B2", "the admin value is English");
assert(italian.englishRequirement.notes?.includes("B2 English"), "the explanation is English");
assert(italian.sources[0]?.url.includes("bando"), "the original URL is preserved");
assert(italian.reviewStatus === "pending_review", "Italian evidence stays pending");
assert(italian.englishRequirement.ieltsMin == null && italian.tuition.type == null, "unknown fields stay null");
assert(italian.sources.some((source) => source.language === "en") === false, "this fixture is the Italian source");
const withUsage = validateResearch({ ...italianEvidenceFixture(subject.slug), apiUsage: { inputTokens: 10, outputTokens: 4, totalTokens: 14, webSearchCalls: 2 } }, subject.slug, "openai");
assert(withUsage.usage?.inputTokens === 10 && withUsage.usage.outputTokens === 4 && withUsage.usage.totalTokens === 14 && withUsage.usage.webSearchCalls === 2, "token and tool usage is stored");
assert(withUsage.reviewStatus === "pending_review", "usage does not approve the finding");

const conflict = conflictFixture("sample-conflict");
assert(conflict.conflicts[0]?.proposedValue === "6.5", "the newer Italian call is the proposal");
assert(conflict.sources.some((source) => source.language === "en"), "the English official source is kept");
assert(conflict.conflicts[0]?.englishUrl && conflict.conflicts[0]?.italianUrl, "both official URLs stay visible");
assert(conflict.reviewStatus === "pending_review", "a conflict is not auto-approved");
const tie = conflictFor("ieltsMin", {
  value: "6.0",
  source: { ...conflict.sources[0], academicYear: "2026/27", sourceType: "official_admission_call", scope: "programme" },
}, {
  value: "6.5",
  source: { ...conflict.sources[1], academicYear: "2026/27", sourceType: "official_admission_call", scope: "programme" },
});
assert(tie.proposedValue == null, "an unclear conflict does not pick a value");

const partial = proposalToEnrichment(subject.slug, null, italian, ["cefr"], {}, "2026-09-24");
assert(partial.record?.english.level === "B2", "an approved field is mapped into enrichment");
assert(partial.record?.english.ieltsMin == null, "an unapproved field stays empty");
assert(partial.record?.verificationStatus === "partially_verified", "a partial approval is not fully verified");
const noSource = proposalToEnrichment(subject.slug, null, { ...italian, sources: [], fieldEvidence: [] }, ["cefr"], {}, "2026-09-24");
assert(noSource.record?.verificationStatus !== "verified", "verified still requires an official source");

assert(recentResearchWarning({
  id: "1", programmeSlug: subject.slug, university: "Example", status: "completed", provider: "mock",
  createdAt: "2026-09-21T00:00:00.000Z", startedAt: null, completedAt: "2026-09-21T00:00:00.000Z", error: "", reviewStatus: "pending_review",
}, Date.parse("2026-09-24T00:00:00.000Z"))?.includes("Research again"), "a recent job warns before another API call");
assert(runningResearchBlock({
  id: "2", programmeSlug: subject.slug, university: "Example", status: "researching", provider: "openai",
  createdAt: "2026-09-24T00:00:00.000Z", startedAt: "2026-09-24T00:00:00.000Z", completedAt: null, error: "", reviewStatus: null,
})?.includes("already running"), "a running job blocks a duplicate");
assert(runningResearchBlock(null) == null, "a programme with no job can be researched");

const savedProvider = process.env.RESEARCH_PROVIDER;
const savedKey = process.env.OPENAI_API_KEY;
delete process.env.RESEARCH_PROVIDER;
assert(getResearchProvider().id === "openai", "OpenAI is the active research provider");
process.env.RESEARCH_PROVIDER = "openai";
const active = getResearchProvider();
assert(active.id === "openai", "RESEARCH_PROVIDER=openai selects OpenAI");
assert(!JSON.stringify(active).includes("sk-"), "the provider object does not expose the API key");
process.env.RESEARCH_PROVIDER = "grok";
assert(getResearchProvider().id === "grok", "Grok remains an optional provider");
process.env.RESEARCH_PROVIDER = "mock";
assert(getResearchProvider().id === "mock", "mock mode stays available");
if (savedProvider == null) delete process.env.RESEARCH_PROVIDER;
else process.env.RESEARCH_PROVIDER = savedProvider;

assert(DISCOVERY_LIMITS.sitemapFiles === 2 && DISCOVERY_LIMITS.indexPages === 2 && DISCOVERY_LIMITS.candidateLinks === 3, "official discovery stays within 2 sitemap files, 2 index pages, and 3 links");
assert(officialTargetBlock("file:///C:/secret", ["example.edu"]) === "scheme", "file URLs are rejected");
assert(officialTargetBlock("http://127.0.0.1/secret", ["example.edu"]) === "host", "loopback is rejected");
assert(officialTargetBlock("http://10.0.0.8/secret", ["example.edu"]) === "host", "private network addresses are rejected");
assert(officialTargetBlock("http://192.168.1.4/secret", ["example.edu"]) === "host", "local network addresses are rejected");
assert(officialTargetBlock("https://evil.test/programme", ["example.edu"]) === "host", "a non-official host is rejected");
assert(officialTargetBlock("https://orienta.example.edu/laurea-magistrale/informatica-applicata/", ["example.edu"]) == null, "an official subdomain stays allowed");
assert(!fs.readFileSync("src/lib/research/official-discovery.ts", "utf8").includes("informatica-applicata"), "the known programme path is not hard-coded in discovery");
assert(!fs.readFileSync("src/lib/research/openai-provider.ts", "utf8").includes("informatica-applicata"), "the known programme path is not hard-coded in the provider");
const cleaned = readableDocument("<main><div class=\"cookie\">IELTS 9.0</div><h1>Informatica Applicata</h1><p>Laurea Magistrale</p></main>");
assert(cleaned.text.includes("Laurea Magistrale") && !cleaned.text.includes("IELTS"), "navigation and cookie text stay out of the readable page");

const appliedSubject: ResearchSubject = {
  slug: "applied-computer-science",
  name: "Applied Computer Science (Machine Learning and Big Data)",
  universityName: "University of Naples Parthenope",
  level: "master",
  city: "Naples",
  region: "south",
  language: "English",
  englishRequirement: "",
  universityWebsite: "https://www.example.edu",
  admissionPortal: null,
};
const programmeUrl = "https://orienta.example.edu/laurea-magistrale/informatica-applicata/";
const programmeHtml = `<html><head><title>Informatica Applicata</title></head><body><nav>Menu</nav><main><h1>Informatica Applicata</h1><p>Università Parthenope Laurea Magistrale Informatica Applicata. Classe LM-18. English title: Applied Computer Science. Curriculum Machine Learning and Big Data. Lingua di Erogazione Inglese. Inizio Immatricolazione 27 Luglio 2026. Scadenza Immatricolazione 1 Marzo 2027. Requisiti curriculari minimi rappresentati da 45 CFU così distribuiti: area fisica per almeno 5 CFU; area informatica per almeno 22 CFU; area matematica per almeno 15 CFU.</p></main></body></html>`;
const cyberPage = {
  url: "https://orienta.example.edu/corsi-di-laurea-sede-di-nola/laurea-in-ingegneria-e-scienze-informatiche-per-la-cybersecurity-sede-di-nola/",
  title: "Laurea in Ingegneria e Scienze Informatiche per la Cybersecurity sede di Nola",
  text: "coloro che sono in possesso del diploma di scuola media superiore o di titolo estero equipollente ai sensi del D.M. 22 ottobre 2004",
};
const programmePage = { url: programmeUrl, title: "Informatica Applicata", text: "English title: Applied Computer Science. Curriculum Machine Learning and Big Data. Inizio Immatricolazione 27 Luglio 2026. Scadenza Immatricolazione 1 Marzo 2027." };
assert(admissionSourceScope(cyberPage, appliedSubject) === "unrelated_programme", "a different course page is unrelated to the target programme");
const italianConfirmed = {
  url: programmeUrl,
  title: "Informatica applicata (Machine Learning e Big Data)",
  text: "Università Parthenope Laurea Magistrale Classe LM-18 Informatica applicata (Machine Learning e Big Data).",
};
const confirmedFingerprint = {
  programmeUrl,
  university: appliedSubject.universityName,
  degreeLevel: "master",
  degreeClass: "LM-18",
  officialTitles: [italianConfirmed.title],
  aliases: [italianConfirmed.title],
  trackOrCurriculum: "Machine Learning and Big Data",
  universityDomain: "example.edu",
};
assert(admissionSourceScope(italianConfirmed, appliedSubject) === "unrelated_programme", "an Italian title alone is not matched from the English catalogue phrase");
assert(admissionSourceScope(italianConfirmed, appliedSubject, confirmedFingerprint) === "programme_specific", "the confirmed programme URL stays programme-specific");
assert(admissionSourceScope(cyberPage, appliedSubject, confirmedFingerprint) === "unrelated_programme", "the Nola cybersecurity page stays unrelated after confirmation");
const conflicted = validateResearch({
  confirmedIdentity: confirmedFingerprint,
  sources: [{ url: programmeUrl, title: italianConfirmed.title, sourceType: "official_programme_page", language: "it", pageText: "Università Parthenope Laurea Triennale Informatica applicata.", sourceConfirmed: true }],
}, appliedSubject.slug, "openai", appliedSubject);
assert(conflicted.researchWarnings.some((warning) => warning.startsWith("identity_conflict")), "a degree-level contradiction is flagged for review");
assert(admissionSourceScope({ url: programmeUrl, title: italianConfirmed.title, text: "Laurea Triennale Informatica applicata" }, appliedSubject, confirmedFingerprint) === "programme_specific", "a contradiction does not downgrade the confirmed URL to unrelated");
const masterIdentityPage = {
  url: programmeUrl,
  title: "Informatica applicata (Machine Learning e Big Data)",
  pageText: "Università degli Studi di Napoli Parthenope. Laurea Magistrale. Classe LM-18. Informatica applicata (Machine Learning e Big Data). Curriculum Machine Learning and Big Data. Lingua di Erogazione Inglese. Inizio Immatricolazione 27 Luglio 2026. Scadenza Immatricolazione 1 Marzo 2027. Requisiti curriculari minimi rappresentati da 45 CFU così distribuiti: area fisica per almeno 5 CFU.",
};
const bachelorIdentityPage = {
  url: "https://orienta.example.edu/laurea-triennale/informatica/",
  title: "Informatica",
  pageText: "Università Parthenope. Laurea Triennale. Informatica. Classe L-31.",
};
const mixedIdentity = identityFromSources(appliedSubject, [masterIdentityPage, bachelorIdentityPage]);
assert(mixedIdentity.degreeClass === "LM-18" && mixedIdentity.identityConflicts.length === 0 && !mixedIdentity.aliases.includes("Informatica"), "an unrelated L-31 page cannot replace LM-18 or add its title as an alias");
const frozenIdentity = freezeConfirmedIdentity(appliedSubject, [masterIdentityPage], mixedIdentity, "example.edu");
assert(Object.isFrozen(frozenIdentity) && frozenIdentity.degreeClass === "LM-18" && frozenIdentity.degreeLevel === "master" && frozenIdentity.provenance?.degreeClass?.sourceUrl === programmeUrl, "confirmed identity is frozen from the programme page");
assert(identityObservation(bachelorIdentityPage, frozenIdentity, appliedSubject) == null, "an unrelated bachelor page does not create a target identity conflict");
const sameProgrammeConflict = identityObservation({
  url: "https://orienta.example.edu/laurea-magistrale/informatica-applicata-call/",
  title: "Informatica applicata",
  text: "Informatica applicata (Machine Learning e Big Data). Università Parthenope. Laurea Magistrale. Classe LM-32.",
}, frozenIdentity, appliedSubject);
assert(sameProgrammeConflict?.confirmedValue === "LM-18" && sameProgrammeConflict.observedValue === "LM-32" && frozenIdentity.degreeClass === "LM-18", "a same-programme LM-32 observation does not overwrite LM-18");
const preservedIdentity = validateResearch({
  confirmedIdentity: frozenIdentity,
  sources: [
    { url: masterIdentityPage.url, title: masterIdentityPage.title, sourceType: "official_programme_page", language: "it", pageText: masterIdentityPage.pageText, sourceConfirmed: true },
    { url: bachelorIdentityPage.url, title: bachelorIdentityPage.title, sourceType: "official_programme_page", language: "it", pageText: bachelorIdentityPage.pageText, sourceConfirmed: true },
  ],
}, appliedSubject.slug, "openai", appliedSubject);
assert(preservedIdentity.identity.degreeClass === "LM-18" && preservedIdentity.identity.degreeLevel === "master" && !preservedIdentity.identity.aliases.includes("Informatica"), "canonical identity stays on the confirmed programme");
assert(!preservedIdentity.researchWarnings.some((warning) => warning.includes("L-31")), "L-31 stays out of the target identity warnings");
assert(preservedIdentity.identity.englishTaught === true && preservedIdentity.academicRequirement.ectsRequirements?.includes("45 CFU"), "programme facts survive an unrelated L-31 page");
assert(preservedIdentity.application.deadlines.some((item) => item.dateType === "enrolment_open" && item.date === "2026-07-27") && preservedIdentity.application.deadlines.some((item) => item.dateType === "enrolment_deadline" && item.date === "2027-03-01"), "enrolment dates survive an unrelated L-31 page");
assert(preservedIdentity.reviewStatus === "pending_review", "an unrelated page leaves the result pending review");
const conflictedIdentity = validateResearch({
  confirmedIdentity: frozenIdentity,
  sources: [
    { url: masterIdentityPage.url, title: masterIdentityPage.title, sourceType: "official_programme_page", language: "it", pageText: masterIdentityPage.pageText, sourceConfirmed: true },
    { url: "https://orienta.example.edu/laurea-magistrale/informatica-applicata-call/", title: "Informatica applicata", sourceType: "official_programme_page", language: "it", pageText: "Informatica applicata (Machine Learning e Big Data). Università Parthenope. Laurea Magistrale. Classe LM-32.", sourceConfirmed: true },
  ],
}, appliedSubject.slug, "openai", appliedSubject);
assert(conflictedIdentity.identity.degreeClass === "LM-18" && conflictedIdentity.identityConflicts.some((item) => item.observedValue === "LM-32") && conflictedIdentity.researchWarnings.some((warning) => warning.startsWith("identity_conflict")) && conflictedIdentity.reviewStatus === "pending_review", "a same-programme class conflict stays LM-18 and pending review");
assert(detectDegreeLevel("https://www.unipd.it/corsi-di-laurea/accounting-finance-and-business-consulting") == null, "a course URL does not decide the degree level");
assert(detectDegreeLevel("Classe LM-77") === "master", "an explicit LM class supports Master's level");
const paduaSubject = {
  name: "Accounting, Finance and Business Consulting",
  universityName: "University of Padua",
  level: "master" as const,
  universityWebsite: "https://www.unipd.it",
  admissionPortal: null,
};
const paduaPage = {
  url: "https://www.unipd.it/corsi-di-laurea/accounting-finance-and-business-consulting",
  title: "ACCOUNTING, FINANCE AND BUSINESS CONSULTING",
  pageText: "ACCOUNTING, FINANCE AND BUSINESS CONSULTING. Classe LM-77. Università degli Studi di Padova.",
};
const paduaDecision = sourceDecision(paduaSubject, `${paduaPage.title}\n${paduaPage.pageText}`, paduaPage.url);
assert(paduaDecision.universityMatch === "confirmed_by_official_domain" && paduaDecision.confirmed && paduaDecision.classCode === "LM-77" && paduaDecision.detected === "master", "Padua confirms from the official domain without the English token");
const paduaIdentity = identityFromSources(paduaSubject, [paduaPage]);
assert(paduaIdentity.confidence === "confirmed" && paduaIdentity.degreeClass === "LM-77", "LM-77 is captured only after the Padua programme confirms");
const frozenPadua = freezeConfirmedIdentity(paduaSubject, [paduaPage], paduaIdentity, "unipd.it");
assert(Object.isFrozen(frozenPadua) && frozenPadua.degreeClass === "LM-77", "the confirmed Padua class is frozen");
assert(identityObservation({ url: "https://www.unipd.it/laurea-triennale/informatica/", title: "Informatica", text: "Laurea Triennale Informatica Classe L-31" }, frozenPadua, paduaSubject) == null, "an unrelated Padua page cannot change LM-77");
const otherUniversity = identityFromSources(paduaSubject, [{
  url: "https://another-university.it/corsi/accounting-finance-and-business-consulting",
  title: "ACCOUNTING, FINANCE AND BUSINESS CONSULTING",
  pageText: "ACCOUNTING, FINANCE AND BUSINESS CONSULTING. Classe LM-77.",
}]);
assert(otherUniversity.confidence !== "confirmed" && sourceDecision(paduaSubject, "ACCOUNTING, FINANCE AND BUSINESS CONSULTING. Classe LM-77.", "https://another-university.it/corsi/accounting-finance-and-business-consulting").universityMatch == null, "the same title on another domain does not confirm the university");
const economicsOnPadua = identityFromSources(paduaSubject, [{
  url: "https://www.unipd.it/corsi-di-laurea/economics",
  title: "Economics",
  pageText: "Economics. Classe LM-56. Laurea Magistrale.",
}]);
assert(economicsOnPadua.confidence !== "confirmed", "the correct university domain does not confirm a different programme");
assert(detectDegreeLevel("sono ammessi candidati con laurea magistrale a ciclo unico") == null, "a prior-qualification single-cycle phrase is not the target level");
assert(detectDegreeLevel("Corso di Laurea Magistrale in Accounting, Finance and Business Consulting") === "master", "a target Master's heading stays Master's");
assert(detectDegreeLevel("Laurea Magistrale a Ciclo Unico in Medicina e Chirurgia\nClasse LM-41") === "single-cycle", "an explicit single-cycle heading stays single-cycle");
assert(detectDegreeLevel("Dottorato di ricerca in Economics") === "phd" && detectDegreeLevel("PhD in Economics") === "phd", "a real PhD heading stays PhD");
assert(detectDegreeLevel("Laurea\nClasse L-18") === "bachelor", "an explicit bachelor class stays bachelor");
const schoolAdmissionText = [
  "Corsi di laurea magistrale della scuola di Economia e Scienze politiche",
  "In questa pagina sono disponibili le informazioni relative all'accesso ai seguenti corsi di laurea magistrale ad accesso libero con requisiti:",
  "Corsi in lingua italiana Accounting, Finance and Business Consulting – curriculum Consulenza e direzione aziendale",
  "Attenzione: questa pagina è dedicata a chi accede ai corsi utilizzando un titolo di laurea di primo livello (triennale, magistrale a ciclo unico o equivalente) conseguito in Italia.",
  "Il Cambio corso è disponibile solo dal 1 settembre e fino al 30 ottobre 2026.",
].join("\n");
const schoolAdmission = sourceDecision(paduaSubject, schoolAdmissionText, "https://www.unipd.it/ammissioni-esp-magistrali-fanno");
assert(schoolAdmission.detected === "master" && schoolAdmission.levelRejected === false && schoolAdmission.confirmed === false, "a programme-specific admissions page is not reclassified as single-cycle");
assert(admissionSourceScope({ url: "https://www.unipd.it/ammissioni-esp-magistrali-fanno", title: "Corsi di laurea magistrale della scuola di Economia e Scienze politiche", text: schoolAdmissionText }, paduaSubject, frozenPadua) === "programme_specific", "the Padua school admissions page stays programme-specific");
const departmentHtml = "<html><body><nav><a href=\"/phd\">PhD in Economics and Management</a></nav><main><h1>Amministrazione, Finanza e Consulenza Aziendale</h1><p>Corso di laurea magistrale. Classe: LM-77. Accounting, Finance and Business Consulting. I curricula consentono l'accesso a programmi di dottorato di ricerca.</p></main></body></html>";
const departmentReadable = readableDocument(departmentHtml);
assert(!/PhD in Economics/i.test(departmentReadable.text) && detectDegreeLevel(`${departmentReadable.title}\n${departmentReadable.text}`) === "master", "navigation PhD text does not outweigh Classe LM-77");
const departmentDecision = sourceDecision(paduaSubject, `Amministrazione, Finanza e Consulenza Aziendale\nPhD in Economics and Management\nCorso di laurea magistrale. Classe: LM-77. Accounting, Finance and Business Consulting. I curricula consentono l'accesso a programmi di dottorato di ricerca.`, "https://www.economiascienzepolitiche.unipd.it/offerta-didattica/corsi-di-laurea-magistrale?key=EP2898");
assert(departmentDecision.detected === "master" && departmentDecision.classCode === "LM-77" && departmentDecision.levelRejected === false, "the department Master's page stays eligible");
const wrongLevel = sourceDecision(paduaSubject, "Accounting, Finance and Business Consulting\nLaurea. Classe L-18.", "https://www.unipd.it/corsi/accounting-finance-and-business-consulting");
assert(wrongLevel.detected === "bachelor" && wrongLevel.levelRejected === true && wrongLevel.confirmed === false, "a target page whose own metadata says L-18 is rejected");
const broadInternational = [
  "Ammissione studenti internazionali",
  "Corsi di laurea e di laurea magistrale a ciclo unico",
  "Domanda di ammissione entro il 15 febbraio 2027.",
  "Lauree Magistrali",
  "Studenti extra-UE residenti all'estero devono presentare domanda entro il 2 maggio 2027.",
].join("\n");
const broadDecision = sourceDecision(paduaSubject, broadInternational, "https://www.unipd.it/ammissione-studenti-internazionali", frozenPadua);
const broadScope = admissionSourceScope({ url: "https://www.unipd.it/ammissione-studenti-internazionali", title: "Ammissione studenti internazionali", text: broadInternational }, paduaSubject, frozenPadua);
const broadEvents = scopedDatedEvents(broadInternational, broadScope, "master");
assert(broadScope === "university_wide" && broadDecision.detected == null && broadDecision.levelRejected === false && broadDecision.confirmed === false, "a university-wide admissions page is not rejected as single-cycle");
assert(broadEvents.some((item) => item.date === "2027-05-02" && item.applicantCategory === "non_eu_residing_abroad") && !broadEvents.some((item) => item.date === "2027-02-15"), "only the Master's section deadline applies to the Master target");
const sectionReview = validateResearch({
  confirmedIdentity: frozenPadua,
  sources: [
    { url: paduaPage.url, title: paduaPage.title, sourceType: "official_programme_page", language: "it", pageText: paduaPage.pageText, sourceConfirmed: true },
    { url: "https://www.unipd.it/ammissione-studenti-internazionali", title: "Ammissione studenti internazionali", sourceType: "official_admission_call", language: "it", pageText: broadInternational, sourceConfirmed: true },
  ],
}, "padua-sections", "openai", paduaSubject);
assert(sectionReview.identity.degreeLevel === "master" && sectionReview.identity.degreeClass === "LM-77" && sectionReview.sources.some((source) => source.url.includes("ammissione-studenti-internazionali") && source.sourceConfirmed), "the university-wide page stays accepted without changing LM-77");
assert(sectionReview.identityConfidence === "confirmed" && sectionReview.researchOutcome === "pending_review", "a university-wide page does not downgrade a frozen Master identity");
assert(sectionReview.application.deadlines.some((item) => item.date === "2027-05-02") && !sectionReview.application.deadlines.some((item) => item.date === "2027-02-15"), "a bachelor section deadline is not stored for the Master target");
const paduaFinal = validateResearch({
  confirmedIdentity: frozenPadua,
  sources: [
    { url: paduaPage.url, title: paduaPage.title, sourceType: "official_programme_page", language: "it", pageText: paduaPage.pageText, sourceConfirmed: true },
    { url: "https://www.unipd.it/ammissioni-esp-magistrali-fanno", title: "Corsi di laurea magistrale", sourceType: "official_admission_call", language: "it", pageText: "Corsi di laurea magistrale. Accounting, Finance and Business Consulting.", sourceConfirmed: true },
    { url: "https://www.unipd.it/ammissione-studenti-internazionali", title: "Ammissione studenti internazionali", sourceType: "official_admission_call", language: "it", pageText: "Ammissione studenti internazionali. Informazioni generali per i corsi dell'ateneo.", sourceConfirmed: true },
  ],
}, "padua-finalize", "openai", paduaSubject);
assert(paduaFinal.identityConfidence === "confirmed" && paduaFinal.identity.degreeLevel === "master" && paduaFinal.identity.degreeClass === "LM-77" && paduaFinal.identity.university === "University of Padua" && paduaFinal.confirmedIdentity?.programmeUrl === paduaPage.url && paduaFinal.confirmedIdentity?.provenance?.degreeClass?.value === "LM-77" && paduaFinal.researchOutcome === "pending_review", "an empty international and Universitaly pass leaves the frozen Padua identity pending review");
assert(paduaFinal.researchWarnings.some((warning) => /non-EU application deadline not confirmed/i.test(warning)) && paduaFinal.application.deadlines.length === 0, "missing international dates stay warnings on a confirmed programme");
const paduaDropped = validateResearch({ confirmedIdentity: frozenPadua, sources: [] }, "padua-dropped", "openai", paduaSubject);
assert(paduaDropped.identityConfidence === "confirmed" && paduaDropped.researchOutcome === "pending_review" && paduaDropped.identity.degreeLevel === "master" && paduaDropped.identity.degreeClass === "LM-77" && paduaDropped.confirmedIdentity?.programmeUrl === paduaPage.url && paduaDropped.confirmedIdentity?.provenance?.degreeClass?.sourceUrl === paduaPage.url && paduaDropped.researchWarnings.includes("post_confirmation_source_validation_incomplete"), "a missing later source list does not turn a frozen identity into not_found");
const paduaTyped = validateResearch({
  confirmedIdentity: frozenPadua,
  sources: [
    { url: paduaPage.url, title: paduaPage.title, sourceType: "programme", language: "it", pageText: paduaPage.pageText, readable: true },
    { url: "https://www.unipd.it/ammissione-studenti-internazionali", title: "Ammissione studenti internazionali", sourceType: "webpage", language: "it", pageText: "Ammissione studenti internazionali. The first application window closes on 15 November 2026.", readable: true },
  ],
}, "padua-source-type", "openai", paduaSubject);
assert(paduaTyped.identityConfidence === "confirmed" && paduaTyped.application.deadlines.some((item) => item.date === "2026-11-15" && item.applicantCategory === "international" && item.dateType === "application_deadline"), "fetched page text is kept when the returned source type is not a catalogue type");
const paduaFillers = [1, 2, 3, 4].map((item) => ({
  url: `https://www.unipd.it/avvisi/bando-${item}`,
  title: `Bando ${item}`,
  sourceType: "official_admission_call" as const,
  language: "it" as const,
  pageText: "Avviso generale di ammissione.",
  sourceConfirmed: true,
}));
const paduaCapped = validateResearch({
  confirmedIdentity: frozenPadua,
  sources: [...paduaFillers, { url: paduaPage.url, title: paduaPage.title, sourceType: "official_programme_page" as const, language: "it" as const, pageText: paduaPage.pageText, sourceConfirmed: true }],
}, "padua-cap", "openai", paduaSubject);
assert(paduaCapped.sources.length === 4 && paduaCapped.sources.some((source) => source.url === paduaPage.url) && paduaCapped.identityConfidence === "confirmed" && paduaCapped.confirmedIdentity?.provenance?.programmeName?.sourceUrl === paduaPage.url, "the saved source cap keeps frozen identity provenance");
const paduaConflict = validateResearch({
  confirmedIdentity: frozenPadua,
  sources: [
    { url: paduaPage.url, title: paduaPage.title, sourceType: "official_programme_page", language: "it", pageText: paduaPage.pageText, sourceConfirmed: true },
    { url: "https://www.unipd.it/corsi-di-laurea/accounting-finance-bachelor", title: "Accounting, Finance and Business Consulting", sourceType: "official_programme_page", language: "it", pageText: "Accounting, Finance and Business Consulting. Laurea. Classe L-18.", sourceConfirmed: true },
  ],
}, "padua-conflict", "openai", paduaSubject);
assert(paduaConflict.identity.degreeClass === "LM-77" && paduaConflict.identity.degreeLevel === "master" && paduaConflict.identityConfidence === "confirmed" && paduaConflict.researchOutcome === "pending_review" && paduaConflict.identityConflicts.some((item) => item.observedValue === "L-18") && paduaConflict.researchWarnings.some((warning) => warning.startsWith("identity_conflict")), "a later L-18 page for the same programme stays visible as an identity conflict");
const singleCycleDecision = sourceDecision({
  name: "Medicine and Surgery",
  universityName: "University of Padua",
  level: "single-cycle",
  universityWebsite: "https://www.unipd.it",
}, "Medicine and Surgery\nLaurea Magistrale a Ciclo Unico in Medicina e Chirurgia. Classe LM-41.", "https://www.unipd.it/corsi/medicine-and-surgery");
assert(singleCycleDecision.detected === "single-cycle" && singleCycleDecision.confirmed === true, "a real single-cycle programme still confirms");
const phdDecision = sourceDecision({
  name: "Economics",
  universityName: "University of Padua",
  level: "phd",
  universityWebsite: "https://www.unipd.it",
}, "Dottorato di ricerca\nPhD in Economics. Università di Padova.", "https://www.unipd.it/phd/economics");
assert(phdDecision.detected === "phd" && phdDecision.levelRejected === false, "a real PhD page still classifies as PhD");
const schoolReview = validateResearch({
  confirmedIdentity: frozenPadua,
  sources: [
    { url: paduaPage.url, title: paduaPage.title, sourceType: "official_programme_page", language: "it", pageText: paduaPage.pageText, sourceConfirmed: true },
    { url: "https://www.unipd.it/ammissioni-esp-magistrali-fanno", title: "Corsi di laurea magistrale della scuola di Economia e Scienze politiche", sourceType: "official_admission_call", language: "it", pageText: schoolAdmissionText, sourceConfirmed: true },
  ],
}, "padua-school", "openai", paduaSubject);
assert(schoolReview.identity.degreeClass === "LM-77" && schoolReview.identity.degreeLevel === "master" && !schoolReview.researchWarnings.some((warning) => /single-cycle/i.test(warning)), "the school admissions page does not disturb frozen LM-77 identity");
assert(schoolReview.sources.some((source) => source.url.includes("ammissioni") && source.sourceConfirmed) && !schoolReview.application.deadlines.some((item) => item.date === "2026-10-30" && isApplyByDate(item.dateType)), "the school page stays eligible and its course-change date is not an application deadline");
assert(teachingLanguage("Lingua Italiano e Inglese. Erogato in italiano e in inglese.") == null, "mixed Italian and English teaching does not become fully English");
const internationalLinks = internationalAdmissionLinksFromHtml(`<main><a href="https://www.unipd.it/ammissione-studenti-internazionali">ammissione studenti internazionali</a><a href="https://www.unipd.it/cambi-corso">cambi corso</a><a href="https://www.unipd.it/news/visa-update">visa news</a><a href="https://example.edu/international">international</a><a href="/en/ammissione-studenti-internazionali">foreign qualification</a><a href="/visa-applicant">visa applicant</a><a href="/universitaly-pre-iscrizione">Universitaly</a></main>`, "https://www.unipd.it/ammissioni-esp-magistrali-fanno", ["unipd.it"]);
assert(internationalLinks.length === 2 && internationalLinks[0] === "https://www.unipd.it/ammissione-studenti-internazionali" && internationalLinks.some((url) => url.includes("/visa-applicant")) && internationalLinks.every((url) => url.includes("unipd.it")) && !internationalLinks.some((url) => url.includes("/news/") || url.includes("example.edu") || url.includes("cambi-corso") || url.includes("/en/")), "same-domain international admission links stay bounded, deduped, and are not crawled from other sites");
const latePadding = "x".repeat(110000);
const lateHtml = `<html><head><title>School admissions</title></head><body><main><p>${latePadding}</p><a href="https://www.unipd.it/ammissione-studenti-internazionali">ammissione studenti internazionali</a><a href="https://www.unipd.it/ammissione-studenti-internazionali#top">same page</a><a href="https://www.unipd.it/news/open-day">news</a><a href="https://example.edu/international-admissions">international admissions</a></main></body></html>`;
const lateParsed = parseOfficialDocument(lateHtml, "https://www.unipd.it/ammissioni-esp-magistrali-fanno", ["unipd.it"]);
const lateSelected = selectAdmissionLinks(lateParsed.pageLinks, { kinds: ["international"], limit: 3 });
assert(lateHtml.length > 100000 && lateHtml.indexOf("ammissione-studenti-internazionali") > 100000, "the regression fixture places the international anchor after 100KB");
assert(lateParsed.text.length <= 12000 && lateParsed.html.length <= 20000 && !lateParsed.html.includes("ammissione-studenti-internazionali"), "model text and stored HTML stay bounded");
assert(lateSelected.length === 1 && lateSelected[0].href === "https://www.unipd.it/ammissione-studenti-internazionali" && lateSelected[0].href.includes("unipd.it"), "the full-document parser still selects the late same-domain international link");
const curriculumOnly = `Curriculum "Consulenza e Direzione Aziendale" taught in Italian. Curriculum "Accounting, Control and Corporate Finance" taught in English. Curriculum "Banking and Finance" taught in English.`;
assert(detectProgrammeTeachingLanguage(curriculumOnly) == null && teachingLanguage(curriculumOnly) == null, "one curriculum taught in Italian does not classify the programme");
const curricula = detectCurriculumTeachingLanguages(curriculumOnly);
assert(curricula.length === 3 && curricula.some((item) => item.curriculum === "Consulenza e Direzione Aziendale" && item.language === "italian") && curricula.filter((item) => item.language === "english").length === 2, "curriculum languages stay attached to their curricula");
assert(detectProgrammeTeachingLanguage("Lingua: Italiano e Inglese") === "mixed" && teachingLanguage("Lingua: Italiano e Inglese") == null, "Italiano e Inglese is a mixed programme");
assert(detectProgrammeTeachingLanguage("Lingua di erogazione: Inglese") === "english" && teachingLanguage("Lingua di erogazione: Inglese") === true, "an explicit English programme stays English-taught");
assert(detectProgrammeTeachingLanguage("Lingua di erogazione: Italiano") === "italian" && teachingLanguage("Lingua di erogazione: Italiano") === false, "an explicit Italian programme is not English-taught");
const mixedLanguage = validateResearch({
  confirmedIdentity: frozenPadua,
  sources: [
    { url: paduaPage.url, title: paduaPage.title, sourceType: "official_programme_page", language: "it", pageText: `${paduaPage.pageText} Lingua: Italiano e Inglese`, sourceConfirmed: true },
    { url: "https://www.unipd.it/ammissioni-esp-magistrali-fanno", title: "Ammissioni", sourceType: "official_admission_call", language: "it", pageText: curriculumOnly, sourceConfirmed: true },
  ],
}, "padua-language", "openai", paduaSubject);
assert(mixedLanguage.identity.programmeTeachingLanguage === "mixed" && mixedLanguage.identity.englishTaught == null && mixedLanguage.identity.curriculumTeachingLanguages.length === 3, "a mixed programme stays mixed when one curriculum is Italian");
const pluralCurricula = `Lingua: Italiano e Inglese. Corsi in lingua italiana Accounting, Finance and Business Consulting – curriculum "Consulenza e direzione aziendale" Corsi in lingua inglese Applied Economics Management for Sustainable Firms Accounting, Finance and Business Consulting – curricula "Accounting, Control and Corporate Finance" e "Banking and Finance" Corsi in lingua inglese curricula "Accounting, Control and Corporate Finance" e "Banking and Finance"`;
const pluralEntries = detectCurriculumTeachingLanguages(pluralCurricula);
assert(detectProgrammeTeachingLanguage(pluralCurricula) === "mixed" && pluralEntries.length === 3 && pluralEntries.every((item) => item.evidenceScope === "curriculum") && pluralEntries.some((item) => item.curriculum === "Consulenza e direzione aziendale" && item.language === "italian") && pluralEntries.filter((item) => item.language === "english").length === 2, "one English heading stores each quoted curriculum once");
const pluralReview = validateResearch({
  confirmedIdentity: frozenPadua,
  sources: [
    { url: paduaPage.url, title: paduaPage.title, sourceType: "official_programme_page", language: "it", pageText: `${paduaPage.pageText} ${pluralCurricula}`, sourceConfirmed: true },
  ],
}, "padua-curricula", "openai", paduaSubject);
assert(pluralReview.identity.programmeTeachingLanguage === "mixed" && pluralReview.identity.englishTaught == null && pluralReview.identity.curriculumTeachingLanguages.length === 3 && pluralReview.identity.curriculumTeachingLanguages.every((item) => item.evidenceScope === "curriculum" && item.sourceUrl === paduaPage.url) && pluralReview.englishRequirement.ieltsMin == null, "plural curricula stay curriculum evidence and do not overwrite mixed");
assert(mixedLanguage.englishRequirement.ieltsMin == null && mixedLanguage.englishRequirement.moiAccepted == null && mixedLanguage.englishRequirement.cefrLevel == null, "teaching language does not create an English-test requirement");
const englishLanguage = validateResearch({
  confirmedIdentity: frozenPadua,
  sources: [{ url: paduaPage.url, title: paduaPage.title, sourceType: "official_programme_page", language: "it", pageText: `${paduaPage.pageText} Lingua di erogazione: Inglese`, sourceConfirmed: true }],
}, "padua-english", "openai", paduaSubject);
assert(englishLanguage.identity.programmeTeachingLanguage === "english" && englishLanguage.identity.englishTaught === true && englishLanguage.englishRequirement.ieltsMin == null, "a fully English programme is English-taught without inventing IELTS");
const italianLanguage = validateResearch({
  confirmedIdentity: frozenPadua,
  sources: [{ url: paduaPage.url, title: paduaPage.title, sourceType: "official_programme_page", language: "it", pageText: `${paduaPage.pageText} Lingua di erogazione: Italiano`, sourceConfirmed: true }],
}, "padua-italian", "openai", paduaSubject);
assert(italianLanguage.identity.programmeTeachingLanguage === "italian" && italianLanguage.identity.englishTaught === false, "a fully Italian programme follows the boolean semantics");
const paduaHomepage = `<title>Università degli Studi di Padova</title><header><p>Università degli Studi di Padova</p></header>`;
const paduaNames = extractOfficialUniversityNames(paduaHomepage);
const paduaCache = memoryUniversityFingerprintCache();
const paduaFingerprint = rememberUniversityFingerprint(paduaCache, { catalogueName: "University of Padua", registeredDomain: "unipd.it", pageUrl: "https://www.unipd.it/", html: paduaHomepage });
assert(paduaNames.officialNames.includes("Università degli Studi di Padova") && paduaFingerprint?.catalogueName === "University of Padua" && paduaFingerprint.officialNames.includes("Università degli Studi di Padova") && paduaFingerprint.registeredDomain === "unipd.it", "official Italian naming is stored on the Padua fingerprint");
assert(paduaCache.read("unipd.it")?.confirmedOfficialRoots.includes("https://www.unipd.it"), "the validated Padua root is cached for later programmes");
const universitySource = fs.readFileSync("src/lib/research/university-identity.ts", "utf8");
assert(!/padova/i.test(universitySource) && !/\bpadua\b/i.test(universitySource), "university identity does not hard-code a Padua translation");
const unconfirmedLabels = validateResearch({
  identity: { university: "Università degli Studi di Padova", degreeLevel: "Laurea Magistrale", officialProgrammeName: "ACCOUNTING, FINANCE AND BUSINESS CONSULTING", language: "Italiano e Inglese" },
  sources: [{ url: "https://another-university.it/corsi/accounting-finance-and-business-consulting", title: "ACCOUNTING, FINANCE AND BUSINESS CONSULTING", sourceType: "official_programme_page", language: "it", pageText: "ACCOUNTING, FINANCE AND BUSINESS CONSULTING. Classe LM-77.", sourceConfirmed: true }],
}, "padua-unconfirmed", "openai", paduaSubject);
assert(unconfirmedLabels.identityConfidence !== "confirmed" && unconfirmedLabels.identity.university == null && unconfirmedLabels.identity.degreeLevel == null && unconfirmedLabels.identity.language == null && unconfirmedLabels.identity.officialProgrammeName == null, "unconfirmed model labels stay out of the verified identity");
assert(unconfirmedLabels.unconfirmedModelIdentity?.language === "Italiano e Inglese" && unconfirmedLabels.unconfirmedModelIdentity.degreeLevel === "Laurea Magistrale", "unconfirmed model labels stay in a separate diagnostic record");
assert(datedEvents(cyberPage.text)[0]?.dateType === "legal_reference_date" && datedEvents(cyberPage.text)[0]?.date === "2004-10-22", "a ministerial citation date is a legal reference");
const rejectedCitation = acceptedAdmissionEvents([cyberPage, programmePage], appliedSubject);
assert(!rejectedCitation.some((item) => item.date === "2004-10-22" || item.dateType === "foreign_qualification_deadline" || item.dateType === "legal_reference_date"), "a rejected legal citation is not an accepted deadline");
assert(hasInternationalDeadline(rejectedCitation) === false, "a raw invalid date does not satisfy the international deadline check");
assert(rejectedCitation.some((item) => item.dateType === "enrolment_open" && item.date === "2026-07-27") && rejectedCitation.some((item) => item.dateType === "enrolment_deadline" && item.date === "2027-03-01"), "enrolment dates stay available without answering the international search");
const residingAbroad = datedEvents("Studenti extra-UE residenti all'estero devono presentare domanda entro il 15 gennaio 2027.")[0];
assert(residingAbroad?.dateType === "non_eu_application_deadline" && residingAbroad.applicantCategory === "non_eu_residing_abroad" && residingAbroad.date === "2027-01-15", "entro plus extra-UE residing abroad is a non-EU application deadline");
const foreignDeadline = datedEvents("Candidates holding a foreign qualification must submit the application by 20 February 2027.")[0];
assert(foreignDeadline?.dateType === "foreign_qualification_deadline" && foreignDeadline.date === "2027-02-20", "a foreign-qualification deadline needs submission language");
assert(datedEvents("Foreign qualifications are recognized pursuant to D.M. 22 ottobre 2004.").every((item) => item.dateType === "legal_reference_date"), "recognition under a decree is not a foreign-qualification deadline");
assert(!hasInternationalDeadline(acceptedAdmissionEvents([{ url: "https://orienta.example.edu/ammissione/", title: "Ammissione", text: "Candidates holding a foreign qualification must submit the application by 20 February 2027." }], appliedSubject)), "a foreign-qualification deadline does not skip the non-EU pass");
const mixedDeadlines = acceptedAdmissionEvents([{ url: "https://orienta.example.edu/ammissione/", title: "Ammissione", text: "Scadenza domanda di ammissione 15 febbraio 2027. Pre-iscrizione tramite Universitaly entro 30 novembre 2026." }], appliedSubject);
assert(hasGeneralAdmissionDeadline(mixedDeadlines) && hasUniversitalyDeadline(mixedDeadlines) && !hasInternationalDeadline(mixedDeadlines), "an application deadline and a Universitaly date stay independent of the non-EU pass");
assert(!hasInternationalDeadline(acceptedAdmissionEvents([{ url: "https://orienta.example.edu/universitaly/", title: "Universitaly", text: "Pre-iscrizione tramite Universitaly entro 30 novembre 2026." }], appliedSubject)), "a Universitaly date does not answer the non-EU search");
const rankProgramme = admissionCandidateRank({ url: "https://orienta.example.edu/ammissione/applied-computer-science/", title: "Applied Computer Science bando di ammissione", text: "" }, appliedSubject);
const rankInternational = admissionCandidateRank({ url: "https://orienta.example.edu/ammissione/studenti-extra-ue/", title: "Studenti extra-UE", text: "" }, appliedSubject);
const rankDepartment = admissionCandidateRank({ url: "https://orienta.example.edu/dipartimento/ammissione/", title: "Dipartimento ammissione", text: "" }, appliedSubject);
const rankGeneral = admissionCandidateRank({ url: "https://orienta.example.edu/ammissione/", title: "Bandi di ammissione", text: "" }, appliedSubject);
const rankOther = admissionCandidateRank(cyberPage, appliedSubject);
assert(rankProgramme < rankInternational && rankInternational < rankDepartment && rankDepartment < rankGeneral && rankGeneral < rankOther, "admission pages rank the target programme ahead of an unrelated course");

function htmlResponse(body: string, status = 200, headers: Record<string, string> = {}) {
  return new Response(body, { status, headers: { "content-type": "text/html; charset=utf-8", ...headers } });
}

async function discoveryLayerChecks() {
  const savedKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "test-not-a-real-key";
  try {
    const fromSitemap = await discoverOfficialCandidates(appliedSubject, async (url) => {
      if (url.endsWith("/sitemap.xml")) {
        return htmlResponse(`<urlset><url><loc>${programmeUrl}</loc></url><url><loc>https://orienta.example.edu/applied-computer-science-regulation.pdf</loc></url></urlset>`, 200, { "content-type": "application/xml" });
      }
      if (url === programmeUrl) return htmlResponse(programmeHtml);
      if (url.endsWith(".pdf")) return htmlResponse("%PDF", 200, { "content-type": "application/pdf" });
      return htmlResponse("missing", 404);
    });
    assert(fromSitemap.pages[0]?.url === programmeUrl, "A: sitemap discovery finds the programme URL");
    assert(fromSitemap.trace[0]?.method === "sitemap" && fromSitemap.trace[0]?.opened, "A: the sitemap candidate is opened");
    assert(fromSitemap.pages.every((page) => !page.url.endsWith(".pdf")), "C: a regulation PDF does not replace the HTML programme page");

    const fromIndex = await discoverOfficialCandidates(appliedSubject, async (url) => {
      if (url.endsWith(".xml")) return htmlResponse("missing", 404);
      if (url === "https://www.example.edu/") return htmlResponse("<a href=\"/corsi/\">Course catalogue</a>");
      if (url.endsWith("/corsi/")) return htmlResponse("<a href=\"/laurea-magistrale/informatica-applicata/\">Informatica Applicata</a><a href=\"/news/applied-computer-science\">News</a>");
      if (url.includes("/news/")) return htmlResponse("<h1>News</h1>");
      if (url.includes("informatica-applicata")) return htmlResponse("<main><h1>Informatica Applicata</h1><p>Informatica Applicata</p></main>");
      return htmlResponse("missing", 404);
    });
    const indexGate = identityFromSources(appliedSubject, fromIndex.pages.map((page) => ({ url: page.url, title: page.title, pageText: page.text })));
    assert(fromIndex.pages.some((page) => page.url.includes("informatica-applicata") && page.method === "course_index"), "B: a course index can surface a translated Italian title");
    assert(indexGate.confidence !== "confirmed", "B: the index candidate is not confirmed from the title alone");

    const searchHits: string[] = [];
    const fromSearch = await discoverOfficialCandidates(appliedSubject, async (url) => {
      searchHits.push(url);
      if (url.endsWith(".xml")) return htmlResponse("missing", 404);
      if (url === "https://www.example.edu/") return htmlResponse("<form action=\"/search\" method=\"get\"><input name=\"s\"></form>");
      if (url.includes("/search?")) return htmlResponse(`<a href="${programmeUrl}">Informatica Applicata</a>`);
      if (url === programmeUrl) return htmlResponse("<main><h1>Informatica Applicata</h1><p>Informatica Applicata</p></main>");
      return htmlResponse("missing", 404);
    });
    assert(fromSearch.trace.some((item) => item.method === "internal_search" && item.url === programmeUrl), "D: official site search returns the programme page");
    assert(searchHits.some((url) => url.includes("/search?")) && searchHits.every((url) => !url.includes("google.")), "D: the search stays on the official site");

    const redirectHits: string[] = [];
    const redirected = await discoverOfficialCandidates(appliedSubject, async (url) => {
      redirectHits.push(url);
      if (url.endsWith("/sitemap.xml")) return htmlResponse(`<urlset><url><loc>${programmeUrl}</loc></url><url><loc>http://10.0.0.8/secret</loc></url></urlset>`, 200, { "content-type": "application/xml" });
      if (url === programmeUrl) return htmlResponse("", 302, { location: "https://evil.test/steal" });
      return htmlResponse("missing", 404);
    });
    assert(redirected.pages.every((page) => !page.url.includes("evil.test")), "E: an off-domain redirect is not opened");
    assert(redirected.trace.some((item) => item.identityEvidence.includes("redirect-rejected")), "E: the rejected redirect is recorded");
    assert(!redirectHits.some((url) => url.includes("10.0.0.8") || url.includes("evil.test")), "E: private and off-domain targets are not fetched");

    const explosionHits: string[] = [];
    const childLocs = Array.from({ length: 40 }, (_, index) => `<url><loc>https://www.example.edu/sitemaps/file-${index}.xml</loc></url>`).join("");
    const bounded = await discoverOfficialCandidates(appliedSubject, async (url) => {
      explosionHits.push(url);
      if (url.endsWith("/sitemap.xml")) {
        return htmlResponse(`<sitemapindex>${childLocs}<url><loc>https://www.example.edu/sitemaps/courses.xml</loc></url></sitemapindex>`, 200, { "content-type": "application/xml" });
      }
      if (url.endsWith("/courses.xml")) {
        const links = Array.from({ length: 10 }, (_, index) => `<url><loc>https://www.example.edu/laurea-magistrale/applied-computer-science-${index}/</loc></url>`).join("");
        return htmlResponse(`<urlset>${links}</urlset>`, 200, { "content-type": "application/xml" });
      }
      if (url.includes("/laurea-magistrale/applied-computer-science-")) return htmlResponse("<main><h1>Applied Computer Science</h1></main>");
      return htmlResponse("missing", 404);
    });
    assert(explosionHits.filter((url) => url.endsWith(".xml")).length === 2, "F: sitemap reading stays within two files");
    assert(!explosionHits.some((url) => url.includes("file-39")), "F: nested sitemap files are not all fetched");
    assert(bounded.pages.length === 3, "F: opened programme links stay within three");

    const discoveryCalls: Array<Record<string, unknown>> = [];
    const liveShape = await openaiResearch(appliedSubject, {
      fetchImpl: async (url) => {
        if (url.endsWith("/sitemap.xml")) return htmlResponse(`<urlset><url><loc>${programmeUrl}</loc></url></urlset>`, 200, { "content-type": "application/xml" });
        if (url === programmeUrl) return htmlResponse(programmeHtml);
        return htmlResponse("missing", 404);
      },
      postResponses: async (_key, payload) => {
        discoveryCalls.push(payload);
        return {
          output_text: JSON.stringify({ sources: [{ url: programmeUrl, title: "Informatica Applicata", sourceType: "official_programme_page", language: "it", scope: "programme" }] }),
          output: [],
          usage: { input_tokens: 4, output_tokens: 3, total_tokens: 7 },
        };
      },
    });
    const checked = validateResearch(liveShape, appliedSubject.slug, "openai", appliedSubject);
    const extractionText = JSON.stringify(discoveryCalls[0] ?? {});
    assert(!("tools" in (discoveryCalls[0] ?? {})) && discoveryCalls.every((payload) => payload.max_tool_calls !== 6), "G: a confirmed official page does not start the broad discovery search");
    assert(extractionText.includes("SOURCE 1"), "G: Stage B extraction still runs");
    assert(checked.identityConfidence === "confirmed" && checked.identity.aliases.includes("Informatica Applicata"), "Parthenope regression confirms the official alias");
    assert(checked.identity.englishTaught === true, "Parthenope regression stores the teaching language");
    assert(checked.application.deadlines.some((item) => item.dateType === "enrolment_open" && item.date === "2026-07-27"), "Parthenope regression stores the enrolment opening");
    assert(checked.application.deadlines.some((item) => item.dateType === "enrolment_deadline" && item.date === "2027-03-01"), "Parthenope regression stores the enrolment deadline");
    assert(checked.application.deadlines.every((item) => item.dateType !== "application_deadline" && item.dateType !== "non_eu_application_deadline"), "an enrolment date still does not become an application deadline");
    assert(checked.academicRequirement.ectsRequirements?.includes("45 CFU"), "Parthenope regression stores the 45 CFU requirement");
    assert((checked.usage?.urlDiscoveryCalls ?? 0) === 0 && (checked.usage?.extractionCalls ?? 0) === 1 && (checked.usage?.admissionResearchCalls ?? 0) === 2 && (checked.usage?.officialFetches ?? 0) > 0, "official page reads are counted apart from web searches");
    assert(checked.discoveryTrace.some((item) => item.method === "sitemap" && item.opened), "the discovery trace records the sitemap hit");

    const fallbackCalls: Array<Record<string, unknown>> = [];
    const fallbackRaw = await openaiResearch(appliedSubject, {
      rootCache: memoryOfficialRootCache(),
      fetchImpl: async () => htmlResponse("missing", 404),
      postResponses: async (_key, payload) => {
        fallbackCalls.push(payload);
        return { output_text: JSON.stringify({ sources: [] }), output: [], usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 } };
      },
    });
    const fallbackTool = (fallbackCalls[0]?.tools as Array<{ type?: string }> | undefined)?.[0];
    const fallbackUsage = validateResearch(fallbackRaw, appliedSubject.slug, "openai", appliedSubject).usage;
    assert(fallbackCalls.length === urlDiscoveryPasses() && fallbackTool?.type === "web_search" && fallbackCalls.every((payload) => payload.max_tool_calls === 1), "H: failed official discovery uses the bounded URL-discovery passes");
    assert(fallbackUsage?.urlDiscoveryTrigger === "no_discovery_pages" && fallbackUsage.urlDiscoveryCalls === urlDiscoveryPasses(), "H: the URL-discovery trigger is recorded");

    const romaSubject: ResearchSubject = {
      ...appliedSubject,
      slug: "roma-tre-bachelor-international-studies",
      name: "International Studies",
      universityName: "Roma Tre University",
      level: "bachelor",
      universityWebsite: "https://www.uniroma3.it",
    };
    let romaSearch = 0;
    const romaRaw = await openaiResearch(romaSubject, {
      fetchImpl: async (url) => {
        if (url.endsWith("/sitemap.xml")) return htmlResponse("<urlset><url><loc>https://www.uniroma3.it/laurea-magistrale/international-studies/</loc></url></urlset>", 200, { "content-type": "application/xml" });
        if (url.includes("/international-studies/")) return htmlResponse("<main><h1>International Studies</h1><p>Laurea Magistrale LM-52 International Studies Roma Tre</p></main>");
        return htmlResponse("missing", 404);
      },
      postResponses: async () => {
        romaSearch += 1;
        return { output_text: "{}", output: [] };
      },
    });
    const roma = validateResearch(romaRaw, romaSubject.slug, "openai", romaSubject);
    assert(romaSearch === 0, "I: a wrong degree level does not continue into OpenAI search");
    assert(roma.researchOutcome === "catalogue_review_required" && roma.catalogueAnomaly?.catalogueLevel === "bachelor" && roma.catalogueAnomaly.officialLevel === "master", "I: Roma Tre still requires catalogue review");
    assert(roma.identityConfidence !== "confirmed", "I: the wrong degree level is still rejected");

    const tlsNow = Date.parse("2026-09-28T12:00:00.000Z");
    const tlsFailure = () => {
      const error = new Error("fetch failed");
      (error as Error & { cause?: { code: string } }).cause = { code: "UNABLE_TO_VERIFY_LEAF_SIGNATURE" };
      return error;
    };
    const passRequest = (pass: 1 | 2) => buildUrlDiscoveryRequest(appliedSubject, pass);
    const passPrompt = (pass: 1 | 2) => ((passRequest(pass).input as Array<{ content: string }>)[0]?.content ?? "");
    const passTool = (passRequest(1).tools as Array<{ filters?: { allowed_domains?: string[] } }>)[0];
    assert(urlDiscoveryPasses() === 2 && researchBudget().maxToolCalls === 6, "URL discovery is two passes and the full research budget stays at 6");
    assert(passRequest(1).max_tool_calls === 1 && passRequest(2).max_tool_calls === 1 && passTool?.filters?.allowed_domains?.includes("example.edu"), "each URL-discovery pass is one domain-restricted search");
    assert(passPrompt(1).includes("Pass 1") && passPrompt(1).includes("Do not extract") && passPrompt(2).includes("Pass 2") && passPrompt(2).includes("Do not extract"), "both passes ask only for official URLs");
    assert(!/informatica applicata/i.test(`${passPrompt(1)}\n${passPrompt(2)}`), "URL discovery does not invent an Italian programme title");
    const passOneQuery = buildUrlDiscoveryQuery(appliedSubject, 1);
    const passTwoQuery = buildUrlDiscoveryQuery(appliedSubject, 2);
    assert(passOneQuery.includes("\"Applied Computer Science\"") && passOneQuery.includes("\"Machine Learning\"") && passOneQuery.includes("\"Big Data\"") && passOneQuery.includes(" master "), "Pass 1 searches the catalogue title and separate track tokens");
    assert(!passOneQuery.includes("Machine Learning and Big Data") && !passTwoQuery.includes("Machine Learning and Big Data"), "discovery does not require the exact and-phrase");
    assert(passTwoQuery.includes("\"Laurea Magistrale\"") && passTwoQuery.includes("\"Machine Learning\"") && passTwoQuery.includes("\"Big Data\"") && !passTwoQuery.includes("Applied Computer Science"), "Pass 2 uses the Italian degree phrase and the unchanged track tokens");
    assert(trackSearchPhrases("Machine Learning and Big Data").join("|") === "Machine Learning|Big Data", "and is treated as a search connector");
    assert(italianDegreePhrase("bachelor") === "Laurea" && italianDegreePhrase("single-cycle") === "Laurea Magistrale a Ciclo Unico" && italianDegreePhrase("phd") === "Dottorato", "Pass 2 degree phrases follow the catalogue level");
    assert(!buildUrlDiscoveryQuery({ ...appliedSubject, level: "bachelor", name: "International Studies" }, 2).includes("Magistrale"), "a bachelor Pass 2 query stays on Laurea");
    const italianTrack = scoreOfficialCandidate("https://orienta.example.edu/laurea-magistrale/machine-learning-e-big-data/", "Machine Learning e Big Data", appliedSubject);
    assert(italianTrack.tokenHits >= 4, "E: meaningful track tokens still match when the page uses e");
    for (const file of ["src/lib/research/fetch-safety.ts", "src/lib/research/official-discovery.ts", "src/lib/research/openai-provider.ts"]) {
      const source = fs.readFileSync(file, "utf8");
      assert(!source.includes("rejectUnauthorized") && !source.includes("NODE_TLS_REJECT_UNAUTHORIZED"), "certificate verification stays enabled");
    }
    const rankedUrls = orderedOfficialUrls(appliedSubject, [
      "https://orienta.example.edu/applied-computer-science-regulation.pdf",
      "https://evil.test/applied-computer-science",
      "https://orienta.example.edu/laurea-magistrale/applied-computer-science/",
    ]);
    assert(rankedUrls[0]?.includes("/laurea-magistrale/") && rankedUrls.every((url) => !url.includes("evil.test")), "E: an official HTML page ranks ahead of a PDF and an unofficial domain is rejected");

    const hostA = memoryOfficialRootCache();
    const callsA: Array<Record<string, unknown>> = [];
    const foundA = await openaiResearch(appliedSubject, {
      now: tlsNow,
      rootCache: hostA,
      fetchImpl: async (url) => {
        if (String(url).includes("www.example.edu")) throw tlsFailure();
        if (String(url) === programmeUrl) return htmlResponse("<main><h1>Informatica Applicata</h1><p>Informatica Applicata</p></main>");
        return htmlResponse("missing", 404);
      },
      postResponses: async (_key, payload) => {
        callsA.push(payload);
        return {
          output_text: JSON.stringify({ sources: [{ url: programmeUrl, title: "Informatica Applicata", sourceType: "official_programme_page", language: "it", scope: "programme" }] }),
          output: [{ type: "web_search_call" }],
          usage: { input_tokens: 2, output_tokens: 1, total_tokens: 3 },
        };
      },
    });
    assert(callsA.length === 2 && callsA.every((payload) => payload.max_tool_calls === 1), "an unconfirmed first page still runs the second URL-discovery pass");
    assert(foundA && typeof foundA === "object" && Array.isArray((foundA as { discoveryTrace?: unknown[] }).discoveryTrace) && ((foundA as { discoveryTrace: Array<{ url: string; opened: boolean }> }).discoveryTrace).some((item) => item.url === programmeUrl && item.opened), "A: the orientation candidate is still discovered");
    assert(hostA.read("example.edu").some((row) => row.origin === "https://www.example.edu" && row.state === "tls_unavailable"), "A: the failed host is marked tls_unavailable");

    const hostB = memoryOfficialRootCache();
    const callsB: Array<Record<string, unknown>> = [];
    const orientaSubject: ResearchSubject = { ...appliedSubject, admissionPortal: "https://international.example.edu" };
    const rawB = await openaiResearch(orientaSubject, {
      now: tlsNow,
      rootCache: hostB,
      fetchImpl: async (url) => {
        const target = String(url);
        if (target.includes("www.example.edu") || target.includes("international.example.edu")) throw tlsFailure();
        if (target === programmeUrl) return htmlResponse(programmeHtml);
        return htmlResponse("missing", 404);
      },
      postResponses: async (_key, payload) => {
        callsB.push(payload);
        if (callsB.length === 1) {
          return {
            output_text: JSON.stringify({ sources: [{ url: programmeUrl, title: "Informatica Applicata", sourceType: "official_programme_page", language: "it", scope: "programme" }] }),
            output: [{ type: "web_search_call" }],
            usage: { input_tokens: 2, output_tokens: 1, total_tokens: 3 },
          };
        }
        return {
          output_text: JSON.stringify({ sources: [{ url: programmeUrl, title: "Informatica Applicata", sourceType: "official_programme_page", language: "it", scope: "programme" }] }),
          output: [],
          usage: { input_tokens: 2, output_tokens: 1, total_tokens: 3 },
        };
      },
    });
    const checkedB = validateResearch(rawB, orientaSubject.slug, "openai", orientaSubject);
    assert(!("tools" in (callsB[1] ?? {})) && callsB.some((payload) => JSON.stringify(payload).includes("Admission search 1")) && callsB.some((payload) => JSON.stringify(payload).includes("Admission search 2")), "B: fact extraction runs before the separate admission searches");
    assert(checkedB.identityConfidence === "confirmed" && checkedB.identity.degreeClass === "LM-18" && checkedB.identity.aliases.includes("Informatica Applicata"), "B: the orientation page can confirm identity");
    assert(checkedB.application.deadlines.some((item) => item.dateType === "enrolment_deadline") && checkedB.application.deadlines.every((item) => item.dateType !== "application_deadline"), "enrolment dates remain separate from application deadlines");
    assert(hostB.read("example.edu").some((row) => row.origin === "https://orienta.example.edu" && row.state === "healthy"), "B: the healthy subdomain is cached");

    const callsC: Array<Record<string, unknown>> = [];
    const rawC = await openaiResearch(appliedSubject, {
      now: tlsNow,
      rootCache: memoryOfficialRootCache(),
      fetchImpl: async (url) => {
        if (String(url).includes("orienta.example.edu")) throw tlsFailure();
        throw tlsFailure();
      },
      postResponses: async (_key, payload) => {
        callsC.push(payload);
        return {
          output_text: JSON.stringify({ sources: [{ url: programmeUrl, title: "Informatica Applicata", sourceType: "official_programme_page", language: "it", scope: "programme" }] }),
          output: [{ type: "web_search_call" }],
          usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 },
        };
      },
    });
    const traceC = rawC && typeof rawC === "object" && Array.isArray((rawC as { discoveryTrace?: unknown[] }).discoveryTrace)
      ? (rawC as { discoveryTrace: Array<{ url: string; identityEvidence: string[] }> }).discoveryTrace
      : [];
    assert(callsC.length === 2 && callsC.every((payload) => payload.max_tool_calls === 1) && traceC.some((item) => item.url === programmeUrl && item.identityEvidence.includes("found_unconfirmed_tls")), "C: a candidate with a TLS failure is found but not used as evidence, and Pass 2 still runs");
    assert(validateResearch(rawC, appliedSubject.slug, "openai", appliedSubject).identityConfidence !== "confirmed", "C: an unread TLS failure cannot confirm identity");

    const fetchedD: string[] = [];
    await openaiResearch(appliedSubject, {
      now: tlsNow,
      rootCache: memoryOfficialRootCache(),
      fetchImpl: async (url) => {
        const target = String(url);
        fetchedD.push(target);
        if (target.includes("www.example.edu")) throw tlsFailure();
        if (target === programmeUrl) return htmlResponse("<main><h1>Applied Computer Science</h1></main>");
        return htmlResponse("missing", 404);
      },
      postResponses: async () => ({
        output_text: JSON.stringify({ sources: [
          { url: "https://evil.test/applied-computer-science", title: "Applied Computer Science", sourceType: "official_programme_page", language: "en", scope: "programme" },
          { url: programmeUrl, title: "Applied Computer Science", sourceType: "official_programme_page", language: "it", scope: "programme" },
        ] }),
        output: [{ type: "web_search_call" }],
        usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 },
      }),
    });
    assert(fetchedD.some((url) => url === programmeUrl) && fetchedD.every((url) => !url.includes("evil.test")), "D: an unofficial search result is not fetched");

    const cacheF = memoryOfficialRootCache([{ origin: "https://orienta.example.edu", domain: "example.edu", role: "orientation", state: "healthy", lastChecked: new Date(tlsNow).toISOString() }]);
    const hitsF: string[] = [];
    await discoverOfficialCandidates(appliedSubject, async (url) => {
      hitsF.push(String(url));
      if (String(url) === "https://orienta.example.edu/sitemap.xml") {
        return htmlResponse(`<urlset><url><loc>https://orienta.example.edu/laurea-magistrale/applied-computer-science/</loc></url></urlset>`, 200, { "content-type": "application/xml" });
      }
      if (String(url).includes("/laurea-magistrale/applied-computer-science/")) return htmlResponse("<main><h1>Applied Computer Science</h1><p>Laurea Magistrale</p></main>");
      throw tlsFailure();
    }, { cache: cacheF, now: tlsNow });
    assert(hitsF[0] === "https://orienta.example.edu/sitemap.xml", "F: a recently healthy subdomain is reused before the broken www host");

    const cacheG = memoryOfficialRootCache([{ origin: "https://www.example.edu", domain: "example.edu", role: "main", state: "tls_unavailable", lastChecked: new Date(tlsNow - 48 * 60 * 60 * 1000).toISOString() }]);
    const hitsG: string[] = [];
    await discoverOfficialCandidates(appliedSubject, async (url) => {
      hitsG.push(String(url));
      if (String(url).endsWith("/sitemap.xml")) return htmlResponse("<urlset></urlset>", 200, { "content-type": "application/xml" });
      return htmlResponse("missing", 404);
    }, { cache: cacheG, now: tlsNow });
    assert(hitsG.some((url) => url.startsWith("https://www.example.edu/")) && cacheG.read("example.edu").some((row) => row.origin === "https://www.example.edu" && row.state === "healthy"), "G: a TLS-failed root can be checked again and become healthy");
    const recentFail = memoryOfficialRootCache([
      { origin: "https://www.example.edu", domain: "example.edu", role: "main", state: "tls_unavailable", lastChecked: new Date(tlsNow - 60 * 60 * 1000).toISOString() },
      { origin: "https://orienta.example.edu", domain: "example.edu", role: "orientation", state: "healthy", lastChecked: new Date(tlsNow).toISOString() },
    ]);
    const reused = selectableRoots(appliedSubject, recentFail, tlsNow);
    assert(reused[0] === "https://orienta.example.edu" && !reused.includes("https://www.example.edu"), "G: a recent TLS failure is skipped without being permanently blocked");

    const promptOf = (payload: Record<string, unknown>) => ((payload.input as Array<{ content?: string }> | undefined)?.[0]?.content ?? "");
    const internationalUrl = "https://international.example.edu/all-courses/applied-computer-science-machine-learning-and-big-data/";
    const departmentUrl = "https://informatica.example.edu/laurea-magistrale/applied-computer-science-machine-learning/";
    const searchResult = (url: string) => ({
      output_text: JSON.stringify({ sources: [{ url, title: "Applied Computer Science", sourceType: "official_programme_page", language: "it", scope: "programme" }] }),
      output: [{ type: "web_search_call" }],
      usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 },
    });
    const stoppedCalls: Array<Record<string, unknown>> = [];
    await openaiResearch(appliedSubject, {
      now: tlsNow,
      rootCache: memoryOfficialRootCache(),
      fetchImpl: async (url) => {
        if (String(url).includes("www.example.edu")) throw tlsFailure();
        if (String(url) === programmeUrl) return htmlResponse(programmeHtml);
        return htmlResponse("missing", 404);
      },
      postResponses: async (_key, payload) => {
        stoppedCalls.push(payload);
        if (promptOf(payload).includes("Pass 1")) return searchResult(programmeUrl);
        return { output_text: "{}", output: [], usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 } };
      },
    });
    assert(stoppedCalls.some((payload) => promptOf(payload).includes("Pass 1")) && stoppedCalls.every((payload) => !promptOf(payload).includes("Pass 2")), "A: Pass 1 produces a healthy candidate and Pass 2 is not called");

    const onlyTlsCalls: Array<Record<string, unknown>> = [];
    await openaiResearch(appliedSubject, {
      now: tlsNow,
      rootCache: memoryOfficialRootCache([{ origin: "https://international.example.edu", domain: "example.edu", role: "international", state: "tls_unavailable", lastChecked: new Date(tlsNow).toISOString() }]),
      fetchImpl: async (url) => {
        if (String(url).includes("www.example.edu")) throw tlsFailure();
        return htmlResponse("missing", 404);
      },
      postResponses: async (_key, payload) => {
        onlyTlsCalls.push(payload);
        if (promptOf(payload).includes("Pass 1")) return searchResult(internationalUrl);
        if (promptOf(payload).includes("Pass 2")) return searchResult("https://evil.test/applied-computer-science");
        return { output_text: "{}", output: [], usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 } };
      },
    });
    assert(onlyTlsCalls.some((payload) => promptOf(payload).includes("Pass 2")), "B: Pass 1 produces only a tls_unavailable candidate and Pass 2 is called");

    const orientaFetches: string[] = [];
    const parthenopeCache = memoryOfficialRootCache([{ origin: "https://international.example.edu", domain: "example.edu", role: "international", state: "tls_unavailable", lastChecked: new Date(tlsNow).toISOString() }]);
    const parthenopeCalls: Array<Record<string, unknown>> = [];
    const parthenopeRaw = await openaiResearch(appliedSubject, {
      now: tlsNow,
      rootCache: parthenopeCache,
      fetchImpl: async (url) => {
        const target = String(url);
        orientaFetches.push(target);
        if (target.includes("www.example.edu") || target.includes("international.example.edu")) throw tlsFailure();
        if (target === programmeUrl) return htmlResponse(programmeHtml);
        return htmlResponse("missing", 404);
      },
      postResponses: async (_key, payload) => {
        parthenopeCalls.push(payload);
        if (promptOf(payload).includes("Pass 1")) return searchResult(internationalUrl);
        if (promptOf(payload).includes("Pass 2")) return searchResult(programmeUrl);
        return { output_text: JSON.stringify({ sources: [{ url: programmeUrl, title: "Informatica Applicata", sourceType: "official_programme_page", language: "it", scope: "programme" }] }), output: [], usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 } };
      },
    });
    const parthenopeChecked = validateResearch(parthenopeRaw, appliedSubject.slug, "openai", appliedSubject);
    assert(parthenopeCalls.some((payload) => promptOf(payload).includes("Pass 2")), "Parthenope regression runs the second URL-discovery pass");
    assert(orientaFetches.includes(programmeUrl) && orientaFetches.every((url) => !url.includes("international.example.edu")), "C: the cooled international host is skipped and the orientation page is fetched");
    assert(parthenopeChecked.identityConfidence === "confirmed" && parthenopeChecked.identity.degreeClass === "LM-18" && parthenopeChecked.identity.aliases.includes("Informatica Applicata"), "Parthenope regression confirms identity from the orientation page");
    assert(parthenopeChecked.application.deadlines.some((item) => item.dateType === "enrolment_deadline") && parthenopeChecked.application.deadlines.every((item) => item.dateType !== "application_deadline" && item.dateType !== "non_eu_application_deadline"), "Parthenope regression keeps enrolment separate from application deadlines");
    assert(parthenopeCache.read("example.edu").some((row) => row.origin === "https://orienta.example.edu" && row.state === "healthy" && row.role === "orientation"), "Parthenope regression caches the healthy orientation root");

    const rankedFirst = orderedOfficialUrls(appliedSubject, [
      internationalUrl,
      "https://international.example.edu/all-courses/applied-computer-science-machine-learning/",
      "https://international.example.edu/courses/applied-computer-science-machine-learning-and-big-data/",
      programmeUrl,
      departmentUrl,
    ], {
      cache: memoryOfficialRootCache([{ origin: "https://international.example.edu", domain: "example.edu", role: "international", state: "tls_unavailable", lastChecked: new Date(tlsNow).toISOString() }]),
      now: tlsNow,
    });
    assert(rankedFirst.includes(programmeUrl) && rankedFirst[0] && !rankedFirst[0].includes("international.example.edu") && rankedFirst.every((url) => !url.includes("international.example.edu")), "D: a healthy official subdomain is ordered ahead of a tls_unavailable host");
    const diverse = orderedOfficialUrls(appliedSubject, [
      internationalUrl,
      "https://international.example.edu/all-courses/applied-computer-science-machine-learning/",
      "https://international.example.edu/courses/applied-computer-science-machine-learning-and-big-data/",
      programmeUrl,
    ]);
    assert(diverse.includes(programmeUrl) && diverse.filter((url) => url.includes("international.example.edu")).length < 3, "candidate lists prefer another official subdomain over three URLs from one host");

    const learned = memoryOfficialRootCache();
    await openaiResearch(appliedSubject, {
      now: tlsNow,
      rootCache: learned,
      fetchImpl: async (url) => {
        if (String(url).includes("www.example.edu")) throw tlsFailure();
        if (String(url) === programmeUrl) return htmlResponse(programmeHtml);
        return htmlResponse("missing", 404);
      },
      postResponses: async (_key, payload) => {
        if (promptOf(payload).includes("Pass 1")) return searchResult(programmeUrl);
        return { output_text: "{}", output: [], usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 } };
      },
    });
    const reuseHits: string[] = [];
    const reuseCalls: Array<Record<string, unknown>> = [];
    await openaiResearch({ ...appliedSubject, slug: "applied-computer-science-second" }, {
      now: tlsNow,
      rootCache: learned,
      fetchImpl: async (url) => {
        reuseHits.push(String(url));
        if (String(url) === "https://orienta.example.edu/sitemap.xml") {
          return htmlResponse(`<urlset><url><loc>${programmeUrl}</loc></url></urlset>`, 200, { "content-type": "application/xml" });
        }
        if (String(url) === programmeUrl) return htmlResponse(programmeHtml);
        throw tlsFailure();
      },
      postResponses: async (_key, payload) => {
        reuseCalls.push(payload);
        return { output_text: "{}", output: [], usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 } };
      },
    });
    assert(reuseHits[0] === "https://orienta.example.edu/sitemap.xml" && reuseCalls.every((payload) => !JSON.stringify(payload).includes("Pass 1, English catalogue title")), "F: the next programme uses the cached healthy root before OpenAI URL discovery");

    const blankCalls: Array<Record<string, unknown>> = [];
    const blankRaw = await openaiResearch(appliedSubject, {
      now: tlsNow,
      rootCache: memoryOfficialRootCache(),
      fetchImpl: async (url) => {
        if (String(url).includes("www.example.edu")) throw tlsFailure();
        return htmlResponse("missing", 404);
      },
      postResponses: async (_key, payload) => {
        blankCalls.push(payload);
        return searchResult("https://evil.test/applied-computer-science");
      },
    });
    const blank = validateResearch(blankRaw, appliedSubject.slug, "openai", appliedSubject);
    assert(blankCalls.filter((payload) => promptOf(payload).includes("Pass")).length === 2, "G: both URL-discovery passes run when neither finds an official page");
    assert(blank.researchOutcome === "research_incomplete_identity" && blank.identityConfidence !== "confirmed", "G: both passes failing stays incomplete");
    assert(blank.application.deadlines.length === 0 && blank.englishRequirement.ieltsMin == null && blank.identity.englishTaught == null && blank.academicRequirement.ectsRequirements == null, "G: no admission facts are invented");

    const wrongUrl = "https://orienta.example.edu/laurea-triennale/applied-computer-science/";
    const wrongRaw = await openaiResearch(appliedSubject, {
      now: tlsNow,
      rootCache: memoryOfficialRootCache(),
      fetchImpl: async (url) => {
        if (String(url).includes("www.example.edu")) throw tlsFailure();
        if (String(url) === wrongUrl) return htmlResponse("<main><h1>Applied Computer Science</h1><p>Università Parthenope Laurea Triennale Applied Computer Science.</p></main>");
        return htmlResponse("missing", 404);
      },
      postResponses: async (_key, payload) => {
        if (promptOf(payload).includes("Pass 1")) return { output_text: JSON.stringify({ sources: [] }), output: [{ type: "web_search_call" }], usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 } };
        if (promptOf(payload).includes("Pass 2")) return searchResult(wrongUrl);
        return { output_text: "{}", output: [], usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 } };
      },
    });
    const wrong = validateResearch(wrongRaw, appliedSubject.slug, "openai", appliedSubject);
    assert(wrong.identityConfidence !== "confirmed" && wrong.application.deadlines.length === 0 && wrong.englishRequirement.ieltsMin == null, "H: a wrong degree-level candidate from Pass 2 is still rejected");
    assert(wrong.researchOutcome === "catalogue_review_required", "H: a wrong degree level still requires catalogue review");

    const enrolmentOnlyCalls: Array<Record<string, unknown>> = [];
    const enrolmentOnlyRaw = await openaiResearch(appliedSubject, {
      now: tlsNow,
      rootCache: memoryOfficialRootCache(),
      fetchImpl: async (url) => {
        if (String(url).endsWith("/sitemap.xml")) return htmlResponse(`<urlset><url><loc>${programmeUrl}</loc></url></urlset>`, 200, { "content-type": "application/xml" });
        if (String(url) === programmeUrl) return htmlResponse(programmeHtml);
        return htmlResponse("missing", 404);
      },
      postResponses: async (_key, payload) => {
        enrolmentOnlyCalls.push(payload);
        return { output_text: JSON.stringify({ sources: [] }), output: promptOf(payload).includes("Admission search") || promptOf(payload).includes("Universitaly search") ? [{ type: "web_search_call" }] : [], usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 } };
      },
    });
    const enrolmentOnly = validateResearch(enrolmentOnlyRaw, appliedSubject.slug, "openai", appliedSubject);
    assert(enrolmentOnlyCalls.some((payload) => promptOf(payload).includes("Admission search 1")) && enrolmentOnlyCalls.some((payload) => promptOf(payload).includes("Admission search 2")), "enrolment dates still launch international admission research");
    assert(enrolmentOnly.identityConfidence === "confirmed" && enrolmentOnly.application.deadlines.some((item) => item.dateType === "enrolment_deadline" && item.date === "2027-03-01"), "the enrolment deadline remains populated");
    assert(enrolmentOnly.application.deadlines.every((item) => item.dateType !== "application_deadline" && item.dateType !== "non_eu_application_deadline" && item.dateType !== "non_eu_abroad_deadline"), "missing admission research does not invent an application deadline");

    const admissionUrl = "https://orienta.example.edu/ammissione/studenti-extra-ue/";
    const separatedRaw = await openaiResearch(appliedSubject, {
      now: tlsNow,
      rootCache: memoryOfficialRootCache(),
      fetchImpl: async (url) => {
        const target = String(url);
        if (target.endsWith("/sitemap.xml")) return htmlResponse(`<urlset><url><loc>${programmeUrl}</loc></url></urlset>`, 200, { "content-type": "application/xml" });
        if (target === programmeUrl) return htmlResponse(`${programmeHtml}<a href="/ammissione/studenti-extra-ue/">Ammissione extra-UE</a>`);
        if (target === admissionUrl) return htmlResponse("<main><p>Università Parthenope. Studenti extra-UE residenti all'estero: domanda entro 15 gennaio 2027.</p></main>");
        return htmlResponse("missing", 404);
      },
      postResponses: async (_key, payload) => {
        if (promptOf(payload).includes("Admission search 2")) return searchResult(admissionUrl);
        return { output_text: JSON.stringify({ sources: [] }), output: [], usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 } };
      },
    });
    const separated = validateResearch(separatedRaw, appliedSubject.slug, "openai", appliedSubject);
    assert(separated.application.deadlines.some((item) => item.dateType === "non_eu_application_deadline" && item.date === "2027-01-15" && item.applicantCategory === "non_eu_residing_abroad"), "the non-EU abroad deadline stays on its own date");
    assert(separated.application.deadlines.some((item) => item.dateType === "enrolment_deadline" && item.date === "2027-03-01"), "the enrolment deadline stays on 1 March");
    assert(separated.application.deadlines.filter((item) => item.date === "2027-01-15").every((item) => item.dateType !== "enrolment_deadline"), "the January date is not stored as enrolment");

    const cyberUrl = cyberPage.url;
    const falsePositiveCalls: Array<Record<string, unknown>> = [];
    const falsePositiveRaw = await openaiResearch(appliedSubject, {
      now: tlsNow,
      rootCache: memoryOfficialRootCache(),
      fetchImpl: async (url) => {
        const target = String(url);
        if (target.endsWith("/sitemap.xml")) return htmlResponse(`<urlset><url><loc>${programmeUrl}</loc><url><loc>${cyberUrl}</loc></url></urlset>`, 200, { "content-type": "application/xml" });
        if (target === programmeUrl) return htmlResponse(programmeHtml);
        if (target === cyberUrl) return htmlResponse(`<main><h1>${cyberPage.title}</h1><p>${cyberPage.text}</p></main>`);
        return htmlResponse("missing", 404);
      },
      postResponses: async (_key, payload) => {
        falsePositiveCalls.push(payload);
        return { output_text: JSON.stringify({ sources: [] }), output: promptOf(payload).includes("Admission search") || promptOf(payload).includes("Universitaly search") ? [{ type: "web_search_call" }] : [], usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 } };
      },
    });
    const falsePositive = validateResearch(falsePositiveRaw, appliedSubject.slug, "openai", appliedSubject);
    assert(falsePositiveCalls.some((payload) => promptOf(payload).includes("Admission search 2")), "an invalid citation on another course still runs the international pass");
    assert(falsePositiveCalls.some((payload) => promptOf(payload).includes("Universitaly search")), "an application page does not cancel the Universitaly search when no Universitaly date is accepted");
    assert(falsePositive.application.deadlines.some((item) => item.dateType === "enrolment_open" && item.date === "2026-07-27") && falsePositive.application.deadlines.some((item) => item.dateType === "enrolment_deadline" && item.date === "2027-03-01"), "enrolment dates remain enrolment dates");
    assert(falsePositive.application.deadlines.every((item) => item.date !== "2004-10-22"), "the 2004 decree date is not stored as a deadline");
    assert(falsePositive.researchWarnings.some((warning) => warning.includes("Official non-EU application deadline not confirmed.")), "the skipped citation does not count as a confirmed non-EU deadline");

    const italianHtml = `<html><head><title>Informatica applicata (Machine Learning e Big Data)</title></head><body><main><h1>Informatica applicata (Machine Learning e Big Data)</h1><p>Università degli Studi di Napoli Parthenope. Laurea Magistrale. Classe LM-18. Curriculum Machine Learning e Big Data. Lingua di Erogazione Inglese. Inizio Immatricolazione 27 Luglio 2026. Scadenza Immatricolazione 1 Marzo 2027. Requisiti curriculari minimi rappresentati da 45 CFU così distribuiti: area fisica per almeno 5 CFU; area informatica per almeno 22 CFU; area matematica per almeno 15 CFU.</p></main></body></html>`;
    const italianRaw = await openaiResearch(appliedSubject, {
      now: tlsNow,
      rootCache: memoryOfficialRootCache(),
      fetchImpl: async (url) => {
        const target = String(url);
        if (target.endsWith("/sitemap.xml")) return htmlResponse(`<urlset><url><loc>${programmeUrl}</loc></url></urlset>`, 200, { "content-type": "application/xml" });
        if (target === programmeUrl) return htmlResponse(italianHtml);
        return htmlResponse("missing", 404);
      },
      postResponses: async (_key, payload) => ({ output_text: JSON.stringify({ sources: [] }), output: promptOf(payload).includes("Admission search") || promptOf(payload).includes("Universitaly search") ? [{ type: "web_search_call" }] : [], usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 } }),
    });
    const italianChecked = validateResearch(italianRaw, appliedSubject.slug, "openai", appliedSubject);
    assert(italianChecked.identityConfidence === "confirmed" && italianChecked.confirmedIdentity?.programmeUrl === programmeUrl, "the confirmed Italian page keeps its programme URL");
    assert(admissionSourceScope({ url: programmeUrl, title: "Informatica applicata (Machine Learning e Big Data)", text: "Informatica applicata (Machine Learning e Big Data)" }, appliedSubject, italianChecked.confirmedIdentity) === "programme_specific", "downstream scope uses the confirmed URL");
    assert(italianChecked.identity.englishTaught === true, "English-taught evidence from the confirmed page survives");
    assert(italianChecked.application.deadlines.some((item) => item.dateType === "enrolment_open" && item.date === "2026-07-27") && italianChecked.application.deadlines.some((item) => item.dateType === "enrolment_deadline" && item.date === "2027-03-01"), "confirmed-page enrolment dates survive");
    assert(italianChecked.academicRequirement.ectsRequirements?.includes("45 CFU"), "the 45 CFU curricular requirement survives");
    const italianProgress = italianChecked.admissionProgress;
    assert(italianProgress != null && italianProgress.general.searchExecuted && italianProgress.international.searchExecuted && italianProgress.universitaly.searchExecuted, "enrolment dates do not suppress admission research");
    assert(italianProgress != null && italianProgress.international.candidatesReturned === 0 && italianProgress.international.acceptedEvidenceFound === false, "a search with no official candidates stays an empty result");
    assert(italianChecked.application.deadlines.every((item) => item.dateType !== "application_deadline" && item.dateType !== "non_eu_application_deadline"), "preserved enrolment dates are not application deadlines");

    const tlsAdmissionUrl = "https://international.example.edu/ammissione/extra-ue/";
    const healthyAdmissionUrl = "https://orienta.example.edu/ammissione/studenti-internazionali/";
    const otherProgrammeUrl = "https://orienta.example.edu/laurea-magistrale/cybersecurity-nola/";
    const internationalResponse = {
      output_text: "",
      output: [{ type: "web_search_call", action: { sources: [
        { url: tlsAdmissionUrl, title: "International admission" },
        { url: healthyAdmissionUrl, title: "Studenti internazionali" },
        { url: otherProgrammeUrl, title: "Laurea in Cybersecurity sede di Nola" },
      ] } }],
      usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 },
    };
    assert(admissionCandidatesFromResponse(internationalResponse).length === 3, "a search response with tool sources becomes a candidate list");
    const openedAdmission: string[] = [];
    const candidateRaw = await openaiResearch(appliedSubject, {
      now: tlsNow,
      rootCache: memoryOfficialRootCache([{ origin: "https://international.example.edu", domain: "example.edu", role: "international", state: "tls_unavailable", lastChecked: new Date(tlsNow).toISOString() }]),
      fetchImpl: async (url) => {
        const target = String(url);
        openedAdmission.push(target);
        if (target.endsWith("/sitemap.xml")) return htmlResponse(`<urlset><url><loc>${programmeUrl}</loc></url></urlset>`, 200, { "content-type": "application/xml" });
        if (target === programmeUrl) return htmlResponse(programmeHtml);
        if (target === healthyAdmissionUrl) return htmlResponse("<main><h1>Studenti internazionali</h1><p>Università Parthenope. Bandi di ammissione per studenti internazionali.</p></main>");
        if (target === otherProgrammeUrl) return htmlResponse("<main><h1>Laurea in Cybersecurity sede di Nola</h1><p>Scadenza domanda di ammissione 1 febbraio 2027. titolo estero equipollente ai sensi del D.M. 22 ottobre 2004.</p></main>");
        if (target === tlsAdmissionUrl) throw tlsFailure();
        return htmlResponse("missing", 404);
      },
      postResponses: async (_key, payload) => promptOf(payload).includes("Admission search 2") ? internationalResponse : { output_text: JSON.stringify({ sources: [] }), output: promptOf(payload).includes("Admission search") || promptOf(payload).includes("Universitaly search") ? [{ type: "web_search_call" }] : [], usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 } },
    });
    const candidateChecked = validateResearch(candidateRaw, appliedSubject.slug, "openai", appliedSubject);
    assert(openedAdmission.includes(healthyAdmissionUrl) && !openedAdmission.includes(tlsAdmissionUrl), "a TLS candidate is skipped and the next official candidate is opened");
    assert(candidateChecked.application.deadlines.every((item) => item.date !== "2027-02-01" && item.date !== "2004-10-22"), "an unrelated programme page does not supply the target deadline");
    const internationalProgress = candidateChecked.admissionProgress;
    assert(internationalProgress != null && internationalProgress.international.searchExecuted && internationalProgress.international.candidatesReturned === 3 && internationalProgress.international.candidatesOpened >= 1 && internationalProgress.international.acceptedEvidenceFound === false, "international pass state records returned, opened, and missing evidence separately");

    const universitalyTlsUrl = "https://informatica.example.edu/area-riservata/";
    const universitalyRaw = await openaiResearch(appliedSubject, {
      now: tlsNow,
      rootCache: memoryOfficialRootCache([{ origin: "https://informatica.example.edu", domain: "example.edu", role: "department", state: "tls_unavailable", lastChecked: new Date(tlsNow).toISOString() }]),
      fetchImpl: async (url) => {
        const target = String(url);
        if (target.endsWith("/sitemap.xml")) return htmlResponse(`<urlset><url><loc>${programmeUrl}</loc></url></urlset>`, 200, { "content-type": "application/xml" });
        if (target === programmeUrl) return htmlResponse(programmeHtml);
        if (target === universitalyTlsUrl) throw tlsFailure();
        return htmlResponse("missing", 404);
      },
      postResponses: async (_key, payload) => promptOf(payload).includes("Universitaly search")
        ? { output_text: "", output: [{ type: "web_search_call", action: { sources: [{ url: universitalyTlsUrl, title: "Area riservata" }] } }], usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 } }
        : { output_text: JSON.stringify({ sources: [] }), output: promptOf(payload).includes("Admission search") ? [{ type: "web_search_call" }] : [], usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 } },
    });
    const universitalyChecked = validateResearch(universitalyRaw, appliedSubject.slug, "openai", appliedSubject);
    const universitalyProgress = universitalyChecked.admissionProgress;
    assert(universitalyProgress != null && universitalyProgress.universitaly.searchExecuted && universitalyProgress.universitaly.candidatesOpened === 0 && universitalyProgress.universitaly.acceptedEvidenceFound === false, "a TLS-only Universitaly candidate leaves the search without evidence");
    assert(!universitalyChecked.application.deadlines.some((item) => item.dateType === "universitaly_deadline" || item.dateType === "pre_enrolment_deadline"), "a TLS-unavailable Universitaly host does not create a deadline");

    const lateSchoolUrl = "https://orienta.example.edu/ammissioni-school/";
    const lateInternationalUrl = "https://orienta.example.edu/ammissione-studenti-internazionali";
    const grandchildUrl = "https://orienta.example.edu/another-international-call";
    const lateSchoolHtml = `<html><head><title>School admissions</title></head><body><main><p>${"word ".repeat(30000)}</p><a href="${lateInternationalUrl}">ammissione studenti internazionali</a></main></body></html>`;
    const answeredInternationalHtml = `<html><body><main><h1>Ammissione studenti internazionali</h1><p>Studenti extra-UE residenti all'estero devono presentare domanda entro il 15 gennaio 2027.</p><a href="${grandchildUrl}">ammissione studenti internazionali</a></main></body></html>`;
    const lateOpened: string[] = [];
    const latePrompts: string[] = [];
    const lateRaw = await openaiResearch(appliedSubject, {
      now: tlsNow,
      rootCache: memoryOfficialRootCache(),
      fetchImpl: async (url) => {
        const target = String(url);
        lateOpened.push(target);
        if (target.endsWith("/sitemap.xml")) return htmlResponse(`<urlset><url><loc>${programmeUrl}</loc></url></urlset>`, 200, { "content-type": "application/xml" });
        if (target === programmeUrl) return htmlResponse(programmeHtml);
        if (target === lateSchoolUrl) return htmlResponse(lateSchoolHtml);
        if (target === lateInternationalUrl) return htmlResponse(answeredInternationalHtml);
        return htmlResponse("missing", 404);
      },
      postResponses: async (_key, payload) => {
        const prompt = promptOf(payload);
        latePrompts.push(prompt);
        if (prompt.includes("Admission search 1")) {
          return { output_text: "", output: [{ type: "web_search_call", action: { sources: [{ url: lateSchoolUrl, title: "School admissions" }] } }], usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 } };
        }
        return { output_text: JSON.stringify({ sources: [] }), output: prompt.includes("Admission search") || prompt.includes("Universitaly search") ? [{ type: "web_search_call" }] : [], usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 } };
      },
    });
    const lateChecked = validateResearch(lateRaw, appliedSubject.slug, "openai", appliedSubject);
    const internationalOpen = lateOpened.indexOf(lateInternationalUrl);
    const searchTwo = latePrompts.findIndex((prompt) => prompt.includes("Admission search 2"));
    assert(lateSchoolHtml.length > 100000 && lateSchoolHtml.indexOf("ammissione-studenti-internazionali") > 100000, "the school fixture keeps the international anchor past 100KB");
    assert(internationalOpen >= 0 && !lateOpened.includes(grandchildUrl), "the late official link is opened once and does not start another generation");
    assert(searchTwo === -1 && lateChecked.admissionProgress?.international.searchExecuted === false && lateChecked.admissionProgress?.international.linkEvidenceAccepted === true && lateChecked.admissionProgress?.international.linksOpened === 1 && lateChecked.admissionProgress?.international.acceptedEvidenceFound === true, "accepted international evidence from the official link skips the paid search");
    assert((lateChecked.admissionProgress?.international.linksFound ?? 0) > 0 && lateChecked.admissionProgress?.international.candidatesReturned === 0, "link telemetry stays separate from search telemetry");
    assert(lateChecked.application.deadlines.some((item) => item.date === "2027-01-15" && item.dateType === "non_eu_application_deadline"), "the linked page can supply the non-EU deadline");

    const unansweredOrder: string[] = [];
    await openaiResearch(appliedSubject, {
      now: tlsNow,
      rootCache: memoryOfficialRootCache(),
      fetchImpl: async (url) => {
        const target = String(url);
        if (target === lateInternationalUrl) unansweredOrder.push("open-link");
        if (target.endsWith("/sitemap.xml")) return htmlResponse(`<urlset><url><loc>${programmeUrl}</loc></url></urlset>`, 200, { "content-type": "application/xml" });
        if (target === programmeUrl) return htmlResponse(programmeHtml);
        if (target === lateSchoolUrl) return htmlResponse(lateSchoolHtml);
        if (target === lateInternationalUrl) return htmlResponse("<main><h1>Ammissione studenti internazionali</h1><p>International admissions office.</p></main>");
        return htmlResponse("missing", 404);
      },
      postResponses: async (_key, payload) => {
        const prompt = promptOf(payload);
        if (prompt.includes("Admission search 2")) unansweredOrder.push("search-2");
        if (prompt.includes("Admission search 1")) {
          return { output_text: "", output: [{ type: "web_search_call", action: { sources: [{ url: lateSchoolUrl, title: "School admissions" }] } }], usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 } };
        }
        return { output_text: JSON.stringify({ sources: [] }), output: prompt.includes("Admission search") || prompt.includes("Universitaly search") ? [{ type: "web_search_call" }] : [], usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 } };
      },
    });
    assert(unansweredOrder.indexOf("open-link") >= 0 && unansweredOrder.indexOf("open-link") < unansweredOrder.indexOf("search-2"), "a linked page that does not answer the question is opened before the international search still runs");
  } finally {
    if (savedKey == null) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = savedKey;
  }
}

function macerataAliasChecks() {
  const dataset = JSON.parse(fs.readFileSync(new URL("../src/data/universities.json", import.meta.url), "utf8")) as UniversitiesDataset;
  const cards = buildDegreeCatalogue(dataset);
  const macerata = cards.filter((card) => card.universityId === "university-of-macerata" && card.level === "master");
  const current = macerata.find((card) => card.name === "International Relations" && card.listing !== "historical");
  const historical = macerata.find((card) => card.name === "Global Politics and International Relations");
  if (!current || !historical) throw new Error("Macerata keeps both the current and historical catalogue records");
  assert(current.listing === "current" && current.degreeClass === "LM-52" && current.italianTitle === "Relazioni internazionali", "the current International Relations record stores the class and Italian title");
  assert(historical.listing === "historical" && historical.canonicalSlug === current.slug, "the old record resolves to the current slug");
  assert((current.aliasSlugs ?? []).includes(historical.slug), "the current record keeps the old slug");
  assert(current.renames?.[0]?.relationship === "same_programme_renamed" && current.renames[0].academicYear === "2021/2022" && current.renames[0].sources.length === 3, "the rename stores the verified 2021/2022 sources");
  const listed = publicCatalogue(cards).filter((card) => card.universityId === "university-of-macerata" && card.level === "master");
  assert(listed.length === 1 && listed[0].slug === current.slug, "the public catalogue lists Macerata International Relations once");
  const oldTitle = filterProgrammes(publicCatalogue(cards), { ...EMPTY_FINDER, q: "Global Politics and International Relations", level: "master" }).filter((card) => card.universityId === "university-of-macerata");
  const italianTitle = filterProgrammes(publicCatalogue(cards), { ...EMPTY_FINDER, q: "Politiche globali e relazioni internazionali", level: "master" }).filter((card) => card.universityId === "university-of-macerata");
  assert(oldTitle.length === 1 && oldTitle[0].slug === current.slug && italianTitle.length === 1 && italianTitle[0].slug === current.slug, "searching a historical title returns the current programme once");
  assert(resolveCatalogueSlug(publicCatalogue(cards), historical.slug) === current.slug, "an old slug resolves to the canonical programme");
  assert(dedupeResolvedSlugs(publicCatalogue(cards), [historical.slug, current.slug]).join("|") === current.slug, "a shortlist or compare list that saved both slugs keeps one programme");

  const applyUrl = "https://apply.unimc.it/en_GB/courses/course/12-ir-international-relations-curricula-international-politics-and-economic-relations-international-economic-relations-international-politics";
  const applyText = [
    "International Relations",
    "Master's Degree in International Relations (Classe LM-52).",
    "Department of Political Science, Communication and International Relations.",
    "Curricula: International Politics (IP), International Economic Relations (IER), International Politics and Economic Relations (IPER).",
    "Submit the application on Universitaly. The Ministry of Foreign Affairs issues the visa.",
  ].join("\n");
  const aliasTarget = {
    name: "Global Politics and International Relations",
    universityName: "University of Macerata",
    level: "master",
    universityWebsite: "https://www.unimc.it/en",
    admissionPortal: "https://apply.unimc.it/",
    verifiedTitles: ["International Relations"],
    degreeClass: "LM-52",
  };
  const applyPage = { url: applyUrl, title: "International Relations", text: applyText };
  const aliasDecision = sourceDecision(aliasTarget, applyText, applyUrl);
  assert(admissionSourceScope(applyPage, aliasTarget) === "programme_specific" && aliasDecision.scope === "programme_specific", "a course record page stays programme-specific when the verified title matches");
  assert(aliasDecision.detected === "master" && aliasDecision.classCode === "LM-52" && aliasDecision.detected != null, "Universitaly and Ministry wording does not clear the degree level or class");
  assert(aliasDecision.confirmed && aliasDecision.universityMatch === "confirmed_by_official_domain", "a verified same-programme rename can match the current official title");
  const bareCourse = { url: "https://apply.example.edu/courses/course/99-unstructured", title: "Courses", text: "Read the Universitaly instructions from the Ministero." };
  assert(admissionSourceScope(bareCourse, aliasTarget) !== "programme_specific" && admissionSourceScope(bareCourse, aliasTarget) !== "national", "a course URL without programme structure is not a programme or a national source");
  const withoutAlias = sourceDecision({ ...aliasTarget, verifiedTitles: [] }, applyText, applyUrl);
  assert(!withoutAlias.confirmed, "a different title does not match without a verified rename");
  const otherUniversity = sourceDecision(aliasTarget, applyText, "https://www.example.edu/courses/course/12-ir-international-relations");
  assert(!otherUniversity.confirmed && otherUniversity.universityMatch == null, "a verified title still requires the university");
  const wrongLevel = sourceDecision({ ...aliasTarget, level: "bachelor" }, applyText, applyUrl);
  assert(wrongLevel.levelRejected && !wrongLevel.confirmed, "a verified title still requires the degree level");
  const wrongClass = sourceDecision(aliasTarget, "International Relations\nMaster's Degree. Classe L-14.\nDepartment of Political Science.\nCurriculum IP.", applyUrl);
  assert(!wrongClass.confirmed, "a verified title does not override a conflicting degree class");
  const nationalPage = { url: "https://www.universitaly.it/index.php/dashboard", title: "Universitaly", text: "Ministero dell'Università e della Ricerca. National pre-enrolment service." };
  assert(admissionSourceScope(nationalPage, aliasTarget) === "national", "an official national portal stays national");
  const universityWide = { url: "https://www.example.edu/en/international-admissions", title: "International admissions", text: "Applications for all degree programmes open at the university admissions office. No single course is described here." };
  assert(admissionSourceScope(universityWide, aliasTarget) === "university_wide", "a broad admissions page stays university-wide");
}

function macerataIdentityConsistencyChecks() {
  const macerataTarget = {
    name: "International Relations",
    universityName: "University of Macerata",
    level: "master" as const,
    universityWebsite: "https://www.unimc.it/en",
    admissionPortal: "https://apply.unimc.it/",
    verifiedTitles: ["Global Politics and International Relations", "Politiche globali e relazioni internazionali"],
    degreeClass: "LM-52",
  };
  const applyUrl = "https://apply.unimc.it/en_GB/courses/course/12-ir-international-relations-curricula-international-politics-and-economic-relations-international-economic-relations-international-politics";
  const classSourceUrl = "https://ir.unimc.it/requisiti-di-accesso";
  const confirmedAt = "2026-10-04T03:12:30.573Z";
  const applyWithoutClass = "International Relations\nMaster's Degree\nUniversity of Macerata\nDepartment of Political Science, Communication and International Relations\nCurricula: International Politics.";
  const confirmation = freezeConfirmedIdentity(
    macerataTarget,
    [{ url: applyUrl, title: "International Relations" }],
    { programmeName: "International Relations", degreeClass: null, aliases: ["International Relations"], curriculumOrTrack: null },
    "unimc.it",
    confirmedAt,
  );
  const enriched = validateResearch({
    confirmedIdentity: confirmation,
    sources: [
      { url: applyUrl, title: "International Relations", sourceType: "official_programme_page", language: "en", pageText: applyWithoutClass, sourceConfirmed: true },
      { url: classSourceUrl, title: "Requisiti di accesso", sourceType: "official_admission_call", language: "it", pageText: "International Relations. Laurea Magistrale. Classe LM-52. Requisiti di accesso.", sourceConfirmed: true },
    ],
  }, "university-of-macerata-master-international-relations", "openai", macerataTarget);
  assert(applyUrl.length > 180 && confirmation.degreeClass == null && confirmation.confirmedAt === confirmedAt, "confirmation can freeze International Relations before a degree class is known");
  assert(enriched.confirmedIdentity?.degreeClass === "LM-52" && enriched.identity.degreeClass === "LM-52" && enriched.identity.degreeLevel === "master" && enriched.identity.university === "University of Macerata", "later LM-52 evidence fills the null class on both identity records");
  assert(enriched.identityConfidence === "confirmed" && enriched.researchOutcome === "pending_review" && enriched.identityConflicts.length === 0 && !enriched.researchWarnings.some((warning) => warning.startsWith("identity_conflict")), "degree-class enrichment stays confirmed and does not invent a conflict");
  assert(enriched.confirmedIdentity?.confirmedAt === confirmedAt && enriched.confirmedIdentity.provenance?.degreeClass?.confirmedAt !== confirmedAt && enriched.confirmedIdentity.provenance?.degreeClass?.sourceUrl === classSourceUrl && enriched.confirmedIdentity.provenance?.degreeClass?.value === "LM-52", "LM-52 provenance points at the later source and keeps the original confirmation time");
  assert(enriched.confirmedIdentity?.programmeUrl === applyUrl && enriched.confirmedIdentity.supportingSources?.[0] === applyUrl && enriched.confirmedIdentity.provenance?.programmeName?.sourceUrl === applyUrl && enriched.confirmedIdentity.provenance?.programmeName?.value === "International Relations", "programme title provenance stays on the confirming Apply URL");
  assert(confirmation.degreeClass == null && !enriched.identity.aliases.includes("Global Politics and International Relations") && !enriched.identity.aliases.includes("Requisiti di accesso"), "enrichment does not rewrite the confirmation snapshot or add page titles as aliases");

  const conflicted = validateResearch({
    confirmedIdentity: freezeConfirmedIdentity(
      macerataTarget,
      [{ url: applyUrl, title: "International Relations" }],
      { programmeName: "International Relations", degreeClass: "LM-52", aliases: ["International Relations"], curriculumOrTrack: null },
      "unimc.it",
      confirmedAt,
    ),
    sources: [
      { url: applyUrl, title: "International Relations", sourceType: "official_programme_page", language: "en", pageText: `${applyWithoutClass}\nClasse LM-52.`, sourceConfirmed: true },
      { url: "https://ir.unimc.it/altro", title: "International Relations", sourceType: "official_programme_page", language: "en", pageText: "International Relations. Laurea Magistrale. Classe L-14.", sourceConfirmed: true },
    ],
  }, "university-of-macerata-master-international-relations", "openai", macerataTarget);
  assert(conflicted.confirmedIdentity?.degreeClass === "LM-52" && conflicted.identity.degreeClass === "LM-52" && conflicted.identityConflicts.some((item) => item.observedValue === "L-14" && item.confirmedValue === "LM-52") && conflicted.researchWarnings.some((warning) => warning.startsWith("identity_conflict")), "a later L-14 observation does not overwrite frozen LM-52");

  const universityWidePage = { url: "https://www.unimc.it/en/international-admissions", title: "International admissions", text: "Ammissione studenti internazionali. Selected master's programmes include Classe LM-52." };
  assert(admissionSourceScope(universityWidePage, macerataTarget, confirmation) === "university_wide", "the class mention on a generic admissions page stays university-wide");
  const universityWide = validateResearch({
    confirmedIdentity: confirmation,
    sources: [
      { url: applyUrl, title: "International Relations", sourceType: "official_programme_page", language: "en", pageText: applyWithoutClass, sourceConfirmed: true },
      { url: universityWidePage.url, title: universityWidePage.title, sourceType: "official_admission_call", language: "en", pageText: universityWidePage.text, sourceConfirmed: true },
    ],
  }, "university-of-macerata-master-international-relations", "openai", macerataTarget);
  assert(universityWide.confirmedIdentity?.degreeClass == null && universityWide.identity.degreeClass == null && universityWide.identityConflicts.length === 0, "a university-wide LM-52 mention does not fill the target class");

  const unrelatedPage = { url: "https://apply.unimc.it/en_GB/courses/course/18-iecols-international-european-and-comparative-legal-studies", title: "IECoLS International, European and Comparative Legal Studies", text: "IECoLS International, European and Comparative Legal Studies. Bachelor. Classe L-14. Department of Law. Curriculum comparative." };
  assert(admissionSourceScope(unrelatedPage, macerataTarget, confirmation) === "unrelated_programme", "IECoLS stays an unrelated course record");
  const unrelated = validateResearch({
    confirmedIdentity: confirmation,
    sources: [
      { url: applyUrl, title: "International Relations", sourceType: "official_programme_page", language: "en", pageText: applyWithoutClass, sourceConfirmed: true },
      { url: unrelatedPage.url, title: unrelatedPage.title, sourceType: "official_programme_page", language: "en", pageText: unrelatedPage.text, sourceConfirmed: true },
    ],
  }, "university-of-macerata-master-international-relations", "openai", macerataTarget);
  assert(unrelated.confirmedIdentity?.degreeClass == null && unrelated.identity.degreeClass == null && !unrelated.identity.aliases.some((alias) => alias.includes("IECoLS") || alias.includes("Legal Studies")), "an unrelated L-14 course does not fill the class or the alias list");

  const longUrl = `https://apply.unimc.it/en_GB/courses/course/${"international-relations-".repeat(18)}`;
  const longIdentity = freezeConfirmedIdentity(
    macerataTarget,
    [{ url: longUrl, title: "International Relations" }],
    { programmeName: "International Relations", degreeClass: "LM-52", aliases: ["International Relations"], curriculumOrTrack: null },
    "unimc.it",
    confirmedAt,
  );
  const longSaved = validateResearch({
    confirmedIdentity: longIdentity,
    sources: [
      { url: longUrl, title: "International Relations", sourceType: "official_programme_page", language: "en", pageText: "International Relations. Master's Degree. Classe LM-52. University of Macerata.", sourceConfirmed: true },
    ],
  }, "university-of-macerata-master-international-relations", "openai", macerataTarget);
  assert(longUrl.length > 400 && longSaved.confirmedIdentity?.programmeUrl === longUrl && longSaved.confirmedIdentity.supportingSources?.[0] === longUrl && longSaved.confirmedIdentity.provenance?.programmeName?.sourceUrl === longUrl && longSaved.confirmedIdentity.provenance?.degreeClass?.sourceUrl === longUrl && longSaved.confirmedIdentity.provenance?.degreeLevel?.sourceUrl === longUrl, "identity provenance keeps a programme URL longer than 180 characters");
  assert(longSaved.identity.degreeClass === "LM-52" && longSaved.confirmedIdentity?.degreeClass === "LM-52", "a stored degree class stays aligned after the long URL is saved");
}

async function discoveryHintChecks() {
  const savedKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "test-not-a-real-key";
  const now = Date.parse("2026-10-04T12:00:00.000Z");
  const schoolUrl = "https://www.medicina.unicampania.it/";
  const schoolIndexUrl = "https://www.medicina.unicampania.it/didattica/corsi-di-studio";
  const englishUrl = "https://www.medicinadiprecisione.unicampania.it/didattica/corsi-di-studio/corso-di-laurea-magistrale-a-ciclo-unico-in-medicina-e-chirurgia-in-lingua-inglese-medicine-and-surgery-in-english";
  const napoliUrl = "https://www.medicinasperimentale.unicampania.it/didattica/corsi-di-studio/corso-di-laurea-magistrale-a-ciclo-unico-in-medicina-e-chirurgia-sede-di-napoli";
  const vanvitelli: ResearchSubject = {
    slug: "university-of-campania-luigi-vanvitelli-single-cycle-medicine-and-surgery",
    name: "Medicine and Surgery",
    universityName: "University of Campania Luigi Vanvitelli",
    level: "single-cycle",
    city: "Naples",
    region: "south",
    language: "English",
    englishRequirement: "",
    universityWebsite: "https://www.unicampania.it/index.php/english",
    admissionPortal: "https://www.unicampania.it/",
    verifiedTitles: [],
    degreeClass: "LM-41",
    italianTitle: "Medicina e Chirurgia in lingua inglese",
    discoveryHints: [{ url: schoolUrl, kind: "apply_url" }],
  };
  const homepageHtml = "<html><head><title>Università Vanvitelli</title></head><body><main><a href=\"/index.php/ateneo/bandi-di-gara\">Bandi di gara</a><a href=\"/index.php/amministrazione-trasparente\">Amministrazione trasparente</a></main></body></html>";
  const schoolHtml = "<html><head><title>Scuola di Medicina e Chirurgia</title></head><body><nav><a href=\"/didattica/corsi-di-studio\">Corsi di Studio</a><a href=\"/la-scuola/avvisi/258-avviso\">Avviso</a></nav><main><h1>Scuola di Medicina e Chirurgia</h1><p>Medicine and Surgery. Classe LM-41. Corsi di laurea magistrale a ciclo unico.</p></main></body></html>";
  const indexHtml = `<html><head><title>Corsi di Studio</title></head><body><main><h1>Didattica</h1><p>Medicina e chirurgia - sede di Napoli <a href="${napoliUrl}">Sito web del corso</a></p><p>Medicine and Surgery Classe LM-41 <a href="http://www.medicinadiprecisione.unicampania.it/">Medicina di Precisione</a> <a href="${englishUrl}">Sito web del corso</a></p></main></body></html>`;
  const englishHtml = "<html><head><title>Medicina e Chirurgia in lingua inglese - Medicine and Surgery in English</title></head><body><main><h2>Corso di Laurea Magistrale a ciclo unico in Medicina e Chirurgia in lingua inglese - Medicine and Surgery in English</h2><p>Medicine and Surgery in English. Length: 6 years. Group of degrees in Italy: LM-41. The single-cycle Degree Course in Medicine and Surgery is taught in English. Università degli Studi della Campania Luigi Vanvitelli.</p></main></body></html>";
  const napoliHtml = "<html><head><title>Medicina e Chirurgia - sede di Napoli</title></head><body><main><h2>Corso di Laurea Magistrale a ciclo unico in Medicina e Chirurgia</h2><p>Classe LM-41. Durata 6 anni. Lingua: italiano. Denominazione inglese: Medicine and Surgery. Università degli Studi della Campania Luigi Vanvitelli.</p></main></body></html>";
  const site = (url: string) => {
    const target = String(url).replace(/^http:\/\//, "https://");
    if (target.endsWith(".xml")) return htmlResponse("missing", 404);
    if (target === "https://www.unicampania.it/") return htmlResponse(homepageHtml);
    if (target === schoolUrl) return htmlResponse(schoolHtml);
    if (target === schoolIndexUrl) return htmlResponse(indexHtml);
    if (target === englishUrl) return htmlResponse(englishHtml);
    if (target === napoliUrl) return htmlResponse(napoliHtml);
    return htmlResponse("missing", 404);
  };
  const promptOf = (payload: Record<string, unknown>) => ((payload.input as Array<{ content?: string }> | undefined)?.[0]?.content ?? "");
  const empty = { output_text: JSON.stringify({ sources: [] }), output: [], usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 } };
  const gateOf = (pages: Array<{ url: string; title: string; text: string }>) => identityFromSources(vanvitelli, pages.map((page) => ({ url: page.url, title: page.title, pageText: page.text })));

  try {
    const hintFetches: string[] = [];
    const hintCache = memoryOfficialRootCache();
    const hinted = await discoverOfficialCandidates(vanvitelli, async (url) => {
      hintFetches.push(String(url));
      return site(String(url));
    }, { cache: hintCache, now });
    const hintedGate = gateOf(hinted.pages);
    assert(hinted.hints.seeds.includes(schoolUrl) && hintFetches[0] === schoolUrl && hintFetches.includes(schoolIndexUrl), "Vanvitelli hint: the school URL is fetched as a discovery root and its course index is followed");
    assert(hinted.pages.some((page) => page.url === englishUrl && page.method === "course_index"), "Vanvitelli hint: the school index surfaces the department programme page");
    assert(hinted.pages.every((page) => page.url !== schoolUrl && page.url !== schoolIndexUrl), "Vanvitelli hint: the school and index pages are not treated as programme evidence");
    assert(hintedGate.confidence === "confirmed" && hintedGate.kept.length === 1 && hinted.pages[hintedGate.kept[0] ?? -1]?.url === englishUrl, "Vanvitelli hint: only the English department page confirms identity");
    assert(hintFetches.filter((url) => url.endsWith(".xml")).length === 0 && !hinted.urlDiscoveryNeeded && hinted.urlDiscoveryTrigger == null, "Vanvitelli hint: a strong candidate skips the sitemap and URL discovery");
    const schoolOnly = identityFromSources(vanvitelli, [{ url: schoolUrl, title: "Scuola di Medicina e Chirurgia", pageText: readableDocument(schoolHtml).text }]);
    assert(schoolOnly.confidence !== "confirmed", "Vanvitelli hint: the hinted school page itself never confirms identity");
    const programmeHintOnItalianPage = await discoverOfficialCandidates({ ...vanvitelli, discoveryHints: [{ url: napoliUrl, kind: "programme_url" }] }, async (url) => site(String(url)), { cache: memoryOfficialRootCache(), now });
    assert(programmeHintOnItalianPage.pages.some((page) => page.url === napoliUrl && page.method === "catalogue_hint") && gateOf(programmeHintOnItalianPage.pages).confidence !== "confirmed", "a programme-URL hint is read but does not confirm identity by itself");
    const learnedVanvitelli = learnedDiscoveryRoots(hintCache, "unicampania.it", now);
    assert(learnedVanvitelli.some((row) => row.origin === "https://www.medicina.unicampania.it" && row.via === "catalogue_hint" && row.role === "school"), "the verified school host is stored as a learned discovery root");
    assert(selectableRoots(vanvitelli, hintCache, now)[0] === "https://www.unicampania.it", "learned school roots do not displace the catalogue root for other programmes");

    const zeroCalls: Array<Record<string, unknown>> = [];
    const zeroRaw = await openaiResearch({ ...vanvitelli, discoveryHints: [] }, {
      now,
      rootCache: memoryOfficialRootCache(),
      fetchImpl: async (url) => site(String(url)),
      postResponses: async (_key, payload) => {
        zeroCalls.push(payload);
        if (promptOf(payload).includes("Pass 1")) return { output_text: JSON.stringify({ sources: [{ url: englishUrl, title: "Medicine and Surgery in English", sourceType: "official_programme_page", language: "en", scope: "programme" }] }), output: [{ type: "web_search_call" }], usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 } };
        return empty;
      },
    });
    const zero = validateResearch(zeroRaw, vanvitelli.slug, "openai", vanvitelli);
    assert(zeroCalls.some((payload) => promptOf(payload).includes("Pass 1")) && zero.usage?.urlDiscoveryTrigger === "zero_eligible_candidates" && zero.usage.urlDiscoveryCalls === 1, "zero eligible candidates after healthy fetches runs bounded URL discovery");
    assert(zeroCalls.every((payload) => payload.max_tool_calls !== 6), "zero eligible candidates does not use the broad discovery search");
    assert(zero.identityConfidence === "confirmed" && zero.confirmedIdentity?.programmeUrl === englishUrl && zero.confirmedIdentity.degreeClass === "LM-41" && zero.confirmedIdentity.degreeLevel === "single-cycle", "URL discovery still needs the English, single-cycle, LM-41 page to confirm");

    const strongCalls: Array<Record<string, unknown>> = [];
    const strongRaw = await openaiResearch({ ...vanvitelli, discoveryHints: [{ url: englishUrl, kind: "programme_url" }, { url: schoolUrl, kind: "apply_url" }] }, {
      now,
      rootCache: memoryOfficialRootCache(),
      fetchImpl: async (url) => site(String(url)),
      postResponses: async (_key, payload) => {
        strongCalls.push(payload);
        return empty;
      },
    });
    const strong = validateResearch(strongRaw, vanvitelli.slug, "openai", vanvitelli);
    assert(strongCalls.every((payload) => !promptOf(payload).includes("Pass 1") && !promptOf(payload).includes("Pass 2") && payload.max_tool_calls !== 6), "a strong candidate adds no URL-discovery or broad search call");
    assert((strong.usage?.urlDiscoveryCalls ?? 0) === 0 && strong.usage?.urlDiscoveryTrigger == null && strong.identityConfidence === "confirmed", "a strong catalogue programme URL keeps the low-cost path");

    const offDomain = trustedDiscoveryHints({
      ...vanvitelli,
      discoveryHints: [
        { url: "https://www.universitaly.it/medicine-and-surgery", kind: "programme_url" },
        { url: "https://unicampania.it.evil.test/medicina/", kind: "apply_url" },
        { url: "http://10.0.0.8/medicina", kind: "apply_url" },
        { url: "not a url", kind: "apply_url" },
      ],
    }, ["https://www.unicampania.it"]);
    assert(offDomain.rejected.length === 4 && offDomain.candidates.length === 0 && offDomain.seeds.length === 0, "an off-domain hint is not trusted");
    const offFetches: string[] = [];
    await discoverOfficialCandidates({ ...vanvitelli, discoveryHints: [{ url: "https://evil.test/medicine-and-surgery-in-english", kind: "programme_url" }] }, async (url) => {
      offFetches.push(String(url));
      return site(String(url));
    }, { cache: memoryOfficialRootCache(), now });
    assert(offFetches.every((url) => !url.includes("evil.test")), "an off-domain hint is never fetched");
    const sameRoot = trustedDiscoveryHints({ ...vanvitelli, discoveryHints: [{ url: "https://www.unicampania.it/", kind: "apply_url" }] }, ["https://www.unicampania.it"]);
    assert(sameRoot.seeds.length === 0 && sameRoot.rejected.length === 0, "an apply URL on an existing root adds no extra fetch");

    const deptSubject: ResearchSubject = { ...appliedSubject, slug: "university-master-data-science", name: "Data Science", universityName: "Example University", level: "master", universityWebsite: "https://www.university.it", admissionPortal: null, discoveryHints: [] };
    const deptUrl = "https://department.university.it/laurea-magistrale/data-science/";
    const deptCache = memoryOfficialRootCache();
    await discoverOfficialCandidates(deptSubject, async (url) => {
      const target = String(url);
      if (target === "https://www.university.it/") return htmlResponse(`<main><a href="https://department.university.it/">Dipartimento di Informatica</a><a href="${deptUrl}">Data Science</a></main>`);
      if (target === deptUrl) return htmlResponse("<main><h1>Data Science</h1><p>Laurea Magistrale LM-91 Data Science.</p></main>");
      return htmlResponse("missing", 404);
    }, { cache: deptCache, now });
    const deptLearned = learnedDiscoveryRoots(deptCache, "university.it", now);
    assert(deptLearned.some((row) => row.origin === "https://department.university.it" && row.via === "official_navigation" && row.role === "department"), "subdomain learning stores the linked department host as a discovery root");
    assert(selectableRoots(deptSubject, deptCache, now).includes("https://department.university.it"), "the learned department host becomes an eligible healthy root");
    const strayCache = memoryOfficialRootCache();
    await discoverOfficialCandidates(deptSubject, async (url) => {
      const target = String(url);
      if (target === "https://www.university.it/") return htmlResponse(`<main><a href="https://department.university.it/">Dipartimento</a></main>`);
      return htmlResponse("missing", 404);
    }, { cache: strayCache, now });
    assert(learnedDiscoveryRoots(strayCache, "university.it", now).length === 0, "a linked host that is never read successfully is not learned");

    const italianIndexUrl = "https://www.medicina.unicampania.it/didattica/corsi-di-studio";
    const italianTargetUrl = "https://www.medicinadiprecisione.unicampania.it/didattica/corsi-di-studio/medicina-e-chirurgia-in-lingua-inglese";
    const italianIndex = await discoverOfficialCandidates(vanvitelli, async (url) => {
      const target = String(url);
      if (target === schoolUrl) return htmlResponse("<nav><a href=\"/didattica/corsi-di-studio\">Corsi di Studio</a></nav>");
      if (target === italianIndexUrl) return htmlResponse(`<main><a href="${italianTargetUrl}">Medicina e Chirurgia in lingua inglese</a><a href="${napoliUrl}">Medicina e Chirurgia - sede di Napoli</a></main>`);
      if (target === italianTargetUrl) return htmlResponse(englishHtml);
      if (target === napoliUrl) return htmlResponse(napoliHtml);
      return htmlResponse("missing", 404);
    }, { cache: memoryOfficialRootCache(), now });
    const italianIndexGate = gateOf(italianIndex.pages);
    assert(italianIndex.pages.some((page) => page.url === italianTargetUrl), "an Italian-title course index can discover the English programme");
    assert(italianIndexGate.confidence === "confirmed" && italianIndexGate.kept.every((index) => italianIndex.pages[index]?.url === italianTargetUrl), "only the English page from the Italian index confirms");
    const napoliText = readableDocument(napoliHtml);
    const napoliDecision = sourceDecision(vanvitelli, `${napoliText.title}\n${napoliText.text}`, napoliUrl);
    assert(!napoliDecision.confirmed && !napoliDecision.languageVariantProven && identityFromSources(vanvitelli, [{ url: napoliUrl, title: napoliText.title, pageText: napoliText.text }]).confidence !== "confirmed", "an Italian Medicina e Chirurgia page does not confirm the English target");

    const englishText = readableDocument(englishHtml);
    const englishBlob = `${englishText.title}\n${englishText.text}`;
    const englishDecision = sourceDecision(vanvitelli, englishBlob, englishUrl);
    assert(englishDecision.confirmed && englishDecision.detected === "single-cycle" && englishDecision.classCode === "LM-41" && englishDecision.universityMatched, "identity safety: University of Campania Luigi Vanvitelli, English, single-cycle, LM-41 confirms");
    assert(!sourceDecision(vanvitelli, englishBlob.replace(/LM-41/g, "LM-46"), englishUrl).confirmed, "identity safety: a different degree class does not confirm");
    assert(!sourceDecision(vanvitelli, englishBlob, "https://www.unina.it/medicine-and-surgery-in-english").confirmed, "identity safety: another university's domain does not confirm");
    assert(!sourceDecision(vanvitelli, "Medicine and Surgery in English\nLaurea triennale in Medicine and Surgery in English. Classe L-22. Università Vanvitelli.", englishUrl).confirmed, "identity safety: a different degree level does not confirm");

    const variants = searchTitleVariants(vanvitelli);
    const passTwo = buildUrlDiscoveryQuery(vanvitelli, 2);
    assert(variants.includes("Medicina e Chirurgia in lingua inglese") && variants.includes("Medicina e Chirurgia") && searchTitleVariants({ name: "Medicine and Surgery", language: "English", italianTitle: null }).includes("Medicina e Chirurgia in lingua inglese"), "bilingual discovery variants come from the catalogue Italian title and a bounded translation");
    assert(passTwo.includes("\"Laurea Magistrale a Ciclo Unico\"") && passTwo.includes("\"Medicina e Chirurgia in lingua inglese\""), "URL-discovery Pass 2 searches the Italian title");
    assert(buildDiscoveryQueries(vanvitelli).some((query) => query.includes("\"Medicina e Chirurgia in lingua inglese\"")), "the broad discovery queries include the Italian search variant");
    assert(searchTitleVariants({ name: "Civil Engineering", language: "English", italianTitle: null }).length === 0 && searchTitleVariants({ name: "Applied Computer Science (Machine Learning and Big Data)", language: "English", italianTitle: null }).length === 0, "the translation layer does not guess titles with unknown words");
    const zeroAliases = zero.identity.aliases.map((alias) => alias.toLowerCase());
    assert(!zeroAliases.includes("medicina e chirurgia") && !(zero.confirmedIdentity?.aliases ?? []).includes("Medicina e Chirurgia"), "a search variant never becomes an identity alias");

    assert(isCourseIndexPath("/didattica/corsi-di-studio") && isCourseIndexPath("/index.php/didattica/corsi-di-laurea") && isCourseIndexPath("/corsi/") && !isCourseIndexPath("/didattica/corsi-di-studio/medicina-e-chirurgia"), "corsi-di-studio is recognised as a course index and a programme page is not");
    const corsiCandidate = scoreOfficialCandidate(englishUrl, "Sito web del corso", vanvitelli);
    assert(corsiCandidate.sourceType === "official_programme_page" && corsiCandidate.scope === "programme" && corsiCandidate.tokenHits === 2 && corsiCandidate.levelMatch, "a corsi-di-studio programme URL ranks as a programme candidate");

    const dataset = JSON.parse(fs.readFileSync("src/data/universities.json", "utf8")) as UniversitiesDataset;
    const vanvitelliCard = buildDegreeCatalogue(dataset).find((card) => card.slug === vanvitelli.slug);
    assert(vanvitelliCard?.programmeUrl === "https://www.medicinadiprecisione.unicampania.it/didattica/corsi-di-studio/corso-di-laurea-magistrale-a-ciclo-unico-in-medicina-e-chirurgia-in-lingua-inglese-medicine-and-surgery-in-english", "the Vanvitelli catalogue stores the verified programme URL");
    assert(vanvitelliCard?.degreeClass === "LM-41" && vanvitelliCard.italianTitle === "Medicina e Chirurgia in lingua inglese" && vanvitelliCard.applyUrl === "https://www.medicina.unicampania.it/" && vanvitelliCard.admissionTest === "IMAT", "the Vanvitelli catalogue keeps the apply URL and IMAT label and adds LM-41 and the Italian title");
    const vanvitelliPrograms = dataset.universities.find((uni) => uni.id === "university-of-campania-luigi-vanvitelli")?.programs ?? [];
    assert(vanvitelliPrograms.filter((program) => program.name === "Medicine and Surgery").length === 1, "the catalogue update does not create a second programme");
    const enrichmentHash = createHash("sha256").update(fs.readFileSync("src/data/programme-enrichment.json")).digest("hex");
    assert(enrichmentHash === "eaf9ce6ba624584e17e5c5ae10945d2dda2783c80de8a15c1dbba7803e57dd29", "programme-enrichment.json is unchanged");
  } finally {
    if (savedKey) process.env.OPENAI_API_KEY = savedKey;
    else delete process.env.OPENAI_API_KEY;
  }
}

async function postIdentityAdmissionChecks() {
  const savedKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "test-not-a-real-key";
  try {
  const now = Date.parse("2026-10-04T12:00:00.000Z");
  const vanvitelli: ResearchSubject = {
    slug: "university-of-campania-luigi-vanvitelli-single-cycle-medicine-and-surgery",
    name: "Medicine and Surgery",
    universityName: "University of Campania Luigi Vanvitelli",
    level: "single-cycle",
    city: "Naples",
    region: "south",
    language: "English",
    englishRequirement: "",
    universityWebsite: "https://www.unicampania.it/index.php/english",
    admissionPortal: "https://www.unicampania.it/",
    verifiedTitles: [],
    degreeClass: "LM-41",
    italianTitle: "Medicina e Chirurgia in lingua inglese",
  };
  const vanvitelliProgrammeUrl = "https://www.medicinadiprecisione.unicampania.it/didattica/corsi-di-studio/corso-di-laurea-magistrale-a-ciclo-unico-in-medicina-e-chirurgia-in-lingua-inglese-medicine-and-surgery-in-english";
  const hubUrl = "https://www.unicampania.it/index.php/studenti/ammissioni-corsi-di-laurea";
  const englishAdmissionUrl = "https://www.unicampania.it/index.php/studenti/ammissioni-corsi-di-laurea/11587-medicine-and-surgery-in-english";
  const italianAdmissionUrl = "https://www.unicampania.it/index.php/studenti/ammissioni-corsi-di-laurea/medicina-e-chirurgia-napoli";
  const dentistryUrl = "https://www.unicampania.it/index.php/studenti/ammissioni-corsi-di-laurea/odontoiatria";
  const heading = "Corso di Laurea Magistrale a ciclo unico in Medicina e Chirurgia in lingua inglese - Medicine and Surgery in English";
  const programmeText = `${heading}. Length: 6 years. Group of degrees in Italy: LM-41 - Medicina e Chirurgia. The single-cycle Degree Course in Medicine and Surgery is taught in English. Università degli Studi della Campania Luigi Vanvitelli. Student activity: Italian Language.`;
  const frozen = freezeConfirmedIdentity(
    vanvitelli,
    [{ url: vanvitelliProgrammeUrl, title: heading }],
    { programmeName: "Medicine and Surgery", degreeClass: "LM-41", aliases: ["Medicine and Surgery in English"], curriculumOrTrack: null },
    "unicampania.it",
  );
  const languageFromTitle = validateResearch({
    confirmedIdentity: frozen,
    sources: [{ url: vanvitelliProgrammeUrl, title: heading, sourceType: "official_programme_page", language: "en", pageText: programmeText, pageTitle: heading, sourceConfirmed: true }],
  }, vanvitelli.slug, "openai", vanvitelli);
  assert(headingTeachingLanguage([heading], ["Medicine and Surgery", "Medicina e Chirurgia in lingua inglese"]) === "english", "programme-heading language reads in lingua inglese / in English");
  assert(languageFromTitle.identity.programmeTeachingLanguage === "english" && languageFromTitle.identity.englishTaught === true, "a programme-specific English title sets teaching language");
  const moduleKept = validateResearch({
    confirmedIdentity: frozen,
    sources: [{ url: vanvitelliProgrammeUrl, title: heading, sourceType: "official_programme_page", language: "en", pageText: `${programmeText}\nItalian Language module. Attività formativa: Italian Language.`, pageTitle: heading, sourceConfirmed: true }],
  }, vanvitelli.slug, "openai", vanvitelli);
  assert(moduleKept.identity.programmeTeachingLanguage === "english" && moduleKept.identity.englishTaught === true, "an Italian Language module does not overwrite an English programme");
  const hubTitle = "Ammissione Corsi di Laurea a.a. 2026/2027";
  const hubText = `${hubTitle}\nMEDICINE AND SURGERY IN ENGLISH\nMEDICINA E CHIRURGIA\nODONTOIATRIA E PROTESI DENTARIA\nNURSING\nLAUREA MAGISTRALE DATA ANALYTICS`;
  const hubPage = { url: hubUrl, title: hubTitle, text: hubText };
  assert(isAdmissionHub(hubPage, vanvitelli, frozen) && admissionSourceScope(hubPage, vanvitelli, frozen) === "university_wide", "a multi-programme admissions list is a university-wide hub");
  const hubDecision = sourceDecision(vanvitelli, `${hubTitle}\n${hubText}`, hubUrl, frozen);
  assert(hubDecision.hub && hubDecision.detected == null && hubDecision.levelRejected === false && !hubDecision.confirmed, "a hub has no page degree level and does not confirm identity");
  const hubSaved = validateResearch({
    confirmedIdentity: frozen,
    sources: [
      { url: vanvitelliProgrammeUrl, title: heading, sourceType: "official_programme_page", language: "en", pageText: programmeText, pageTitle: heading, sourceConfirmed: true },
      { url: hubUrl, title: hubTitle, sourceType: "official_admission_call", language: "it", pageText: hubText, pageTitle: hubTitle, sourceConfirmed: true },
    ],
  }, vanvitelli.slug, "openai", vanvitelli);
  assert(hubSaved.sources.find((source) => source.url === hubUrl)?.scope === "university", "the saved hub source stays university scope");
  assert(!hubSaved.researchWarnings.some((warning) => /identity rejected|master source/i.test(warning)), "a university-wide hub does not produce an identity rejection warning");
  assert(identityFromSources(vanvitelli, [{ url: hubUrl, title: hubTitle, pageText: hubText }]).warnings.every((warning) => !/identity rejected|master source/i.test(warning)), "identityFromSources ignores admission hubs");
  const dedicated = { url: englishAdmissionUrl, title: "Medicine and Surgery in English a.a. 2026/2027", text: "Medicine and Surgery in English. Admission test: IMAT. Application deadline 9 September 2026. Università degli Studi della Campania Luigi Vanvitelli. Classe LM-41. Single-cycle." };
  assert(admissionSourceScope(dedicated, vanvitelli, frozen) === "programme_specific" && !isAdmissionHub(dedicated, vanvitelli, frozen), "a dedicated English Medicine admission page stays programme-specific");
  const dedicatedSaved = validateResearch({
    confirmedIdentity: frozen,
    sources: [
      { url: vanvitelliProgrammeUrl, title: heading, sourceType: "official_programme_page", language: "en", pageText: programmeText, pageTitle: heading, sourceConfirmed: true },
      { url: dedicated.url, title: dedicated.title, sourceType: "official_admission_call", language: "en", pageText: dedicated.text, pageTitle: dedicated.title, sourceConfirmed: true },
    ],
  }, vanvitelli.slug, "openai", vanvitelli);
  assert(dedicatedSaved.tests.required === true && dedicatedSaved.tests.types.includes("IMAT"), "readable HTML IMAT on the target admission page is stored");
  assert(dedicatedSaved.application.deadlines.some((item) => item.date === "2026-09-09" && item.dateType === "application_deadline"), "an explicit application deadline on the target page is stored");
  const pdfOnly = validateResearch({
    confirmedIdentity: frozen,
    sources: [
      { url: vanvitelliProgrammeUrl, title: heading, sourceType: "official_programme_page", language: "en", pageText: programmeText, pageTitle: heading, sourceConfirmed: true },
      { url: "https://www.unicampania.it/Bando_IMAT_26-27.pdf", title: "Bando_IMAT_26-27.pdf", sourceType: "official_pdf", language: "it", pageText: "", readable: false, sourceConfirmed: false },
    ],
  }, vanvitelli.slug, "openai", vanvitelli);
  assert(pdfOnly.tests.required == null && !pdfOnly.tests.types.includes("IMAT") && pdfOnly.researchWarnings.some((warning) => /PDF FOUND — CONTENT NOT VERIFIED/i.test(warning)), "a PDF filename does not supply IMAT or dates");
  const hubLinks = [
    { href: italianAdmissionUrl, anchorText: "Medicina e Chirurgia - sede di Napoli", rel: null, sourceUrl: hubUrl },
    { href: dentistryUrl, anchorText: "Odontoiatria e Protesi Dentaria", rel: null, sourceUrl: hubUrl },
    { href: englishAdmissionUrl, anchorText: "Medicine and Surgery in English 2026/27", rel: null, sourceUrl: hubUrl },
    { href: "https://www.unicampania.it/index.php/studenti/ammissioni-corsi-di-laurea/semestre-aperto", anchorText: "Semestre aperto Medicina e Chirurgia", rel: null, sourceUrl: hubUrl },
  ];
  const ranked = rankHubTargetLinks(hubLinks, { labels: ["Medicine and Surgery", "Medicine and Surgery in English", "Medicina e Chirurgia in lingua inglese"], degreeClass: "LM-41", englishVariant: true });
  assert(ranked[0]?.href === englishAdmissionUrl && ranked.every((link) => link.href === englishAdmissionUrl), "only the English Medicine hub link qualifies strongly");
  assert(HUB_LIMITS.hubsPerStage === 1 && HUB_LIMITS.linksConsidered === 3 && HUB_LIMITS.linksOpened === 1, "hub following stays at one hub, three considered links, and one opened page");
  const vanvitelliProgrammeHtml = `<html><head><title>${heading}</title></head><body><main><h1>${heading}</h1><p>${programmeText}</p><a href="${hubUrl}">Ammissione Corsi di Laurea</a></main></body></html>`;
  const hubHtml = `<html><head><title>${hubTitle}</title></head><body><main><h1>${hubTitle}</h1><a href="${englishAdmissionUrl}">Medicine and Surgery in English 2026/27</a><a href="${italianAdmissionUrl}">Medicina e Chirurgia</a><a href="${dentistryUrl}">Odontoiatria e Protesi Dentaria</a><a href="/index.php/studenti/ammissioni-corsi-di-laurea/architettura">Architettura</a><a href="/index.php/studenti/ammissioni-corsi-di-laurea/infermieristica">Nursing</a></main></body></html>`;
  const admissionHtml = `<html><head><title>Medicine and Surgery in English a.a. 2026/2027</title></head><body><main><h1>Medicine and Surgery in English a.a. 2026/2027</h1><p>Admission test: IMAT. Application deadline 9 September 2026. Università degli Studi della Campania Luigi Vanvitelli. Classe LM-41.</p><a href="/Bando_IMAT_26-27.pdf">Bando IMAT</a></main></body></html>`;
  const promptOf = (payload: Record<string, unknown>) => ((payload.input as Array<{ content?: string }> | undefined)?.[0]?.content ?? "");
  const fetched: string[] = [];
  const calls: Array<Record<string, unknown>> = [];
  const hubRun = await openaiResearch({ ...vanvitelli, discoveryHints: [{ url: vanvitelliProgrammeUrl, kind: "programme_url" }] }, {
    now,
    rootCache: memoryOfficialRootCache(),
    fetchImpl: async (url) => {
      const target = String(url);
      fetched.push(target);
      if (target.endsWith(".xml")) return htmlResponse("missing", 404);
      if (target === vanvitelliProgrammeUrl) return htmlResponse(vanvitelliProgrammeHtml);
      if (target === hubUrl) return htmlResponse(hubHtml);
      if (target === englishAdmissionUrl) return htmlResponse(admissionHtml);
      if (target === italianAdmissionUrl || target === dentistryUrl) return htmlResponse("<main><h1>Other course</h1></main>");
      return htmlResponse("missing", 404);
    },
    postResponses: async (_key, payload) => {
      calls.push(payload);
      return { output_text: JSON.stringify({ sources: [] }), output: [], usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 } };
    },
  });
  const hubChecked = validateResearch(hubRun, vanvitelli.slug, "openai", vanvitelli);
  assert(fetched.includes(hubUrl) && fetched.includes(englishAdmissionUrl), "programme → admissions list → target admission page is one bounded hop");
  assert(!fetched.includes(italianAdmissionUrl) && !fetched.includes(dentistryUrl), "Italian Medicine and Dentistry hub links are not opened");
  assert((hubChecked.admissionProgress?.general.hubFollow?.linksOpened ?? 0) === 1 && hubChecked.admissionProgress?.general.hubFollow?.targetUrls.includes(englishAdmissionUrl), "hub telemetry records the one opened target page");
  assert(!fetched.some((url) => url.endsWith("/Bando_IMAT_26-27.pdf")), "the hop does not recurse into the admission-page PDF");
  assert(hubChecked.identity.programmeTeachingLanguage === "english" && hubChecked.identity.englishTaught === true, "the live-style English heading sets teaching language");
  assert(hubChecked.tests.types.includes("IMAT") && hubChecked.application.deadlines.some((item) => item.date === "2026-09-09"), "the opened target admission page supplies IMAT and the application deadline");
  assert(calls.every((payload) => !promptOf(payload).includes("Admission search 1")), "a target-specific admission page found by a hub hop skips the first paid admission search");
  const offDomain = "https://evil.test/imat";
  const wrongProgramme = "https://orienta.example.edu/laurea-triennale/cybersecurity/";
  const targetAdmission = "https://orienta.example.edu/ammissione/applied-computer-science/";
  const diagnosticFetched: string[] = [];
  const diagnosticRun = await openaiResearch(appliedSubject, {
    now,
    rootCache: memoryOfficialRootCache(),
    fetchImpl: async (url) => {
      const target = String(url);
      diagnosticFetched.push(target);
      if (target.endsWith("/sitemap.xml")) return htmlResponse(`<urlset><url><loc>${programmeUrl}</loc></url></urlset>`, 200, { "content-type": "application/xml" });
      if (target === programmeUrl) return htmlResponse(programmeHtml);
      if (target === targetAdmission) return htmlResponse("<main><h1>Applied Computer Science bando di ammissione</h1><p>Università Parthenope. Scadenza domanda di ammissione 15 febbraio 2027.</p></main>");
      if (target === wrongProgramme) return htmlResponse("<main><h1>Cybersecurity</h1><p>Laurea triennale.</p></main>");
      return htmlResponse("missing", 404);
    },
    postResponses: async (_key, payload) => {
      if (promptOf(payload).includes("Admission search")) {
        return {
          output_text: JSON.stringify({ sources: [
            { url: offDomain, title: "IMAT", sourceType: "official_admission_call" },
            { url: wrongProgramme, title: "Cybersecurity Laurea Triennale", sourceType: "official_admission_call" },
            { url: targetAdmission, title: "Applied Computer Science bando di ammissione", sourceType: "official_admission_call" },
          ] }),
          output: [{ type: "web_search_call", action: { query: "site:example.edu Applied Computer Science bando" } }],
          usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 },
        };
      }
      return { output_text: JSON.stringify({ sources: [] }), output: promptOf(payload).includes("Universitaly") ? [{ type: "web_search_call" }] : [], usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 } };
    },
  });
  const diagnostic = validateResearch(diagnosticRun, appliedSubject.slug, "openai", appliedSubject);
  const generalDiag = diagnostic.admissionProgress?.general.searchDiagnostics;
  assert((generalDiag?.resultsReturned ?? 0) === 3 && generalDiag?.candidates.some((item) => item.url === offDomain && item.rejectionReason === "off_domain" && !item.opened), "search diagnostics record an off-domain rejection");
  assert(generalDiag?.candidates.some((item) => item.url === wrongProgramme && (item.rejectionReason === "wrong_programme" || item.rejectionReason === "wrong_level") && !item.opened), "search diagnostics record a wrong-programme rejection");
  assert(generalDiag?.candidates.some((item) => item.url === targetAdmission && item.opened) && diagnosticFetched.includes(targetAdmission) && !diagnosticFetched.includes(offDomain), "search diagnostics record the opened target page only");
  const zeroRun = await openaiResearch(appliedSubject, {
    now,
    rootCache: memoryOfficialRootCache(),
    fetchImpl: async (url) => {
      if (String(url).endsWith("/sitemap.xml")) return htmlResponse(`<urlset><url><loc>${programmeUrl}</loc></url></urlset>`, 200, { "content-type": "application/xml" });
      if (String(url) === programmeUrl) return htmlResponse(programmeHtml);
      return htmlResponse("missing", 404);
    },
    postResponses: async (_key, payload) => ({
      output_text: JSON.stringify({ sources: [] }),
      output: promptOf(payload).includes("Admission search") || promptOf(payload).includes("Universitaly") ? [{ type: "web_search_call", action: { query: "site:example.edu empty" } }] : [],
      usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 },
    }),
  });
  const zero = validateResearch(zeroRun, appliedSubject.slug, "openai", appliedSubject);
  assert(zero.admissionProgress?.general.searchDiagnostics?.resultsReturned === 0 && zero.admissionProgress.general.searchDiagnostics.candidates.length === 0, "a search that returns no URLs is recorded as resultsReturned 0");
  assert(JSON.stringify(zero.admissionProgress?.general.searchDiagnostics ?? "").length < 4000, "search diagnostics stay compact");
  } finally {
    if (savedKey) process.env.OPENAI_API_KEY = savedKey;
    else delete process.env.OPENAI_API_KEY;
  }
}

async function submissionDeadlineChecks() {
  const savedKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "test-not-a-real-key";
  try {
  const italianClose = datedEvents("Termine presentazione domande di partecipazione: 9 settembre 2026");
  assert(italianClose.length === 1 && italianClose[0]?.dateType === "application_deadline" && italianClose[0].date === "2026-09-09" && italianClose[0].applicantCategory === "all_applicants", "termine presentazione domande di partecipazione is an application deadline");
  assert(datedEvents("Termine per la presentazione delle domande: 9 settembre 2026")[0]?.dateType === "application_deadline", "termine per la presentazione delle domande closes applications");
  assert(datedEvents("Termine di presentazione della domanda: 9 settembre 2026")[0]?.dateType === "application_deadline", "termine di presentazione della domanda closes applications");
  assert(datedEvents("Scadenza per la presentazione delle domande: 9 settembre 2026")[0]?.dateType === "application_deadline", "scadenza per la presentazione delle domande closes applications");
  assert(datedEvents("Presentare la domanda entro il 9 settembre 2026")[0]?.dateType === "application_deadline", "presentare la domanda entro closes applications");
  const englishClose = datedEvents("Deadline for submitting applications: September 9, 2026");
  assert(englishClose.length === 1 && englishClose[0]?.dateType === "application_deadline" && englishClose[0].date === "2026-09-09", "deadline for submitting applications is an application deadline");
  assert(datedEvents("Applications must be submitted by September 9, 2026")[0]?.dateType === "application_deadline", "applications must be submitted by is an application deadline");
  assert(datedEvents("Submit your application by 9 September 2026")[0]?.dateType === "application_deadline", "submit your application by is an application deadline");
  const bilingual = datedEvents("Termine presentazione domande di partecipazione: 9 settembre 2026. Deadline for submitting applications: September 9, 2026.");
  assert(bilingual.length === 1 && bilingual[0]?.dateType === "application_deadline" && bilingual[0].date === "2026-09-09" && bilingual[0].applicantCategory === "all_applicants", "bilingual submission wording stores one application deadline");
  assert(!bilingual.some((item) => item.applicantCategory === "non_eu" || item.applicantCategory === "visa_applicant" || item.applicantCategory === "international"), "a general submission deadline does not invent an applicant category");
  const englishWindow = datedEvents("Applications open on 1 August 2026 and the deadline for submitting applications is September 9, 2026.");
  assert(englishWindow.some((item) => item.date === "2026-08-01" && item.dateType === "application_open") && englishWindow.some((item) => item.date === "2026-09-09" && item.dateType === "application_deadline"), "an English opening does not reclassify the later submission deadline");
  const italianWindow = datedEvents("Le domande possono essere presentate a partire dal 1 agosto 2026. Termine per la presentazione delle domande: 9 settembre 2026.");
  assert(italianWindow.some((item) => item.date === "2026-08-01" && item.dateType === "application_open") && italianWindow.some((item) => item.date === "2026-09-09" && item.dateType === "application_deadline"), "an Italian opening does not reclassify the later submission deadline");
  const unchanged = datedEvents("Application deadline: 15 November 2026")[0];
  assert(unchanged?.dateType === "application_deadline" && unchanged.date === "2026-11-15" && unchanged.applicantCategory === "all_applicants", "Application deadline wording is unchanged");
  const testRegistration = datedEvents("Deadline for registration to the admission test: 5 September 2026")[0];
  assert(testRegistration?.dateType === "test_registration_deadline" && testRegistration.date === "2026-09-05", "test registration stays test-specific");
  assert(reclassifyDate("application_deadline", "Deadline for registration to the admission test: 5 September 2026") === "test_registration_deadline", "test registration wording overrides an application label");
  const enrolment = datedEvents("Termine per l'immatricolazione: 30 September 2026")[0];
  assert(enrolment?.dateType === "enrolment_deadline" && enrolment.date === "2026-09-30", "immatricolazione stays an enrolment deadline");
  const vanvitelli: ResearchSubject = {
    slug: "university-of-campania-luigi-vanvitelli-single-cycle-medicine-and-surgery",
    name: "Medicine and Surgery",
    universityName: "University of Campania Luigi Vanvitelli",
    level: "single-cycle",
    city: "Naples",
    region: "south",
    language: "English",
    englishRequirement: "",
    universityWebsite: "https://www.unicampania.it/index.php/english",
    admissionPortal: "https://www.unicampania.it/",
    verifiedTitles: [],
    degreeClass: "LM-41",
    italianTitle: "Medicina e Chirurgia in lingua inglese",
  };
  const programmeUrl = "https://www.medicinadiprecisione.unicampania.it/didattica/corsi-di-studio/corso-di-laurea-magistrale-a-ciclo-unico-in-medicina-e-chirurgia-in-lingua-inglese-medicine-and-surgery-in-english";
  const hubUrl = "https://www.unicampania.it/index.php/studenti/ammissioni-corsi-di-laurea";
  const englishAdmissionUrl = "https://www.unicampania.it/index.php/studenti/ammissioni-corsi-di-laurea/11587-medicine-and-surgery-in-english";
  const italianAdmissionUrl = "https://www.unicampania.it/index.php/studenti/ammissioni-corsi-di-laurea/medicina-e-chirurgia-napoli";
  const heading = "Corso di Laurea Magistrale a ciclo unico in Medicina e Chirurgia in lingua inglese - Medicine and Surgery in English";
  const programmeText = `${heading}. Length: 6 years. Group of degrees in Italy: LM-41 - Medicina e Chirurgia. The single-cycle Degree Course in Medicine and Surgery is taught in English. Università degli Studi della Campania Luigi Vanvitelli.`;
  const frozen = freezeConfirmedIdentity(
    vanvitelli,
    [{ url: programmeUrl, title: heading }],
    { programmeName: "Medicine and Surgery", degreeClass: "LM-41", aliases: ["Medicine and Surgery in English"], curriculumOrTrack: null },
    "unicampania.it",
  );
  const thinTitle = "Università degli studi della Campania Luigi Vanvitelli - MEDICINE AND SURGERY IN ENGLISH";
  const thinText = "Termine presentazione domande di partecipazione: 9 settembre 2026. Deadline for submitting applications: September 9, 2026.";
  const italianText = "Lingua: italiano. Denominazione inglese: Medicine and Surgery. Termine presentazione domande di partecipazione: 1 ottobre 2026.";
  const saved = validateResearch({
    confirmedIdentity: frozen,
    sources: [
      { url: programmeUrl, title: heading, sourceType: "official_programme_page", language: "en", pageText: programmeText, pageTitle: heading, sourceConfirmed: true },
      { url: hubUrl, title: "Ammissione Corsi di Laurea a.a. 2026/2027", sourceType: "official_admission_call", language: "it", pageText: "Ammissione Corsi di Laurea a.a. 2026/2027\nMEDICINE AND SURGERY IN ENGLISH\nMEDICINA E CHIRURGIA\nODONTOIATRIA\nNURSING\nDATA ANALYTICS", pageTitle: "Ammissione Corsi di Laurea a.a. 2026/2027", sourceConfirmed: true },
      { url: englishAdmissionUrl, title: thinTitle, sourceType: "official_admission_call", language: "en", pageText: thinText, pageTitle: thinTitle, sourceConfirmed: true },
      { url: italianAdmissionUrl, title: "Medicina e Chirurgia - sede di Napoli", sourceType: "official_admission_call", language: "it", pageText: italianText, pageTitle: "Medicina e Chirurgia - sede di Napoli", sourceConfirmed: true },
    ],
  }, vanvitelli.slug, "openai", vanvitelli);
  const september = saved.application.deadlines.filter((item) => item.date === "2026-09-09");
  assert(september.length === 1 && september[0]?.dateType === "application_deadline" && september[0].applicantCategory === "all_applicants", "the target admission page stores one 9 September application deadline");
  assert(!saved.application.deadlines.some((item) => item.date === "2026-10-01"), "an Italian Medicine admission page does not supply the English target deadline");
  assert(saved.sources.find((source) => source.url === italianAdmissionUrl)?.sourceConfirmed === false, "an explicit Italian Medicine admission page is not accepted for the English target");
  assert(!saved.researchWarnings.some((warning) => warning.startsWith(`Identity not confirmed for ${englishAdmissionUrl}`)), "a post-freeze target admission page does not warn that identity is unconfirmed");
  assert(saved.researchWarnings.some((warning) => warning.startsWith(`Identity not confirmed for ${italianAdmissionUrl}`)), "an explicit Italian Medicine page still warns");
  assert(!saved.researchWarnings.some((warning) => warning.includes(hubUrl) && /identity not confirmed|identity rejected/i.test(warning)), "a university-wide hub still produces no identity warning");
  const pdfs = [
    ["Apertura_anagrafiche_IMAT_26_27.pdf", "Apertura anagrafiche", "other_admission_pdf"],
    ["General_informations_IMAT_26_27.pdf", "General informations", "general_information_pdf"],
    ["Distribution_IMAT_26_27.pdf", "Distribution", "other_admission_pdf"],
    ["Venue_of_the_test_IMAT_26_27.pdf", "Venue of the test", "venue_notice_pdf"],
    ["03_-_DR_536-2026_Bando_IMAT_26-27.pdf", "Bando IMAT", "admission_call_pdf"],
    ["03_-_DR_536-2026_Call_for_applicartion_IMAT_26-27.pdf", "Call for application", "admission_call_pdf"],
    ["03_-_DR_536-2026_Emanazione_Bando_IMAT_26-27.pdf", "Emanazione bando", "admission_call_pdf"],
  ] as const;
  const links = pdfs.map(([file, anchor]) => ({ href: `https://www.unicampania.it/images/${file}`, anchorText: anchor, rel: null, sourceUrl: englishAdmissionUrl }));
  links.push({ href: "https://www.unicampania.it/images/Elenco_professori_emeriti.pdf", anchorText: "Elenco professori emeriti", rel: null, sourceUrl: englishAdmissionUrl });
  const inventory = admissionPdfInventory(links);
  assert(inventory.length === 7 && inventory.every((item, index) => item.purpose === pdfs[index]?.[2]), "relevant admission PDFs are inventoried with a safe purpose");
  assert(!inventory.some((item) => item.url.includes("emeriti")), "an unrelated PDF is left out of the admission inventory");
  const pdfHtml = `<html><head><title>${thinTitle}</title></head><body><p>${thinText}</p>${pdfs.map(([file, anchor]) => `<a href="/images/${file}">${anchor}</a>`).join("")}<a href="/images/Elenco_professori_emeriti.pdf">Elenco professori emeriti</a></body></html>`;
  const programmeHtml = `<html><head><title>${heading}</title></head><body><main><h1>${heading}</h1><p>${programmeText}</p><a href="${hubUrl}">Ammissione Corsi di Laurea</a></main></body></html>`;
  const hubHtml = `<html><head><title>Ammissione Corsi di Laurea a.a. 2026/2027</title></head><body><main><h1>Ammissione Corsi di Laurea a.a. 2026/2027</h1><a href="${englishAdmissionUrl}">Medicine and Surgery in English 2026/27</a><a href="${italianAdmissionUrl}">Medicina e Chirurgia</a><a href="https://www.unicampania.it/index.php/studenti/ammissioni-corsi-di-laurea/odontoiatria">Odontoiatria</a><a href="/index.php/studenti/ammissioni-corsi-di-laurea/architettura">Architettura</a><a href="/index.php/studenti/ammissioni-corsi-di-laurea/infermieristica">Nursing</a></main></body></html>`;
  const fetched: string[] = [];
  const run = await openaiResearch({ ...vanvitelli, discoveryHints: [{ url: programmeUrl, kind: "programme_url" }] }, {
    now: Date.parse("2026-10-04T12:00:00.000Z"),
    rootCache: memoryOfficialRootCache(),
    fetchImpl: async (url) => {
      const target = String(url);
      fetched.push(target);
      if (target.endsWith(".xml")) return htmlResponse("missing", 404);
      if (target === programmeUrl) return htmlResponse(programmeHtml);
      if (target === hubUrl) return htmlResponse(hubHtml);
      if (target === englishAdmissionUrl) return htmlResponse(pdfHtml);
      return htmlResponse("missing", 404);
    },
    postResponses: async () => ({ output_text: JSON.stringify({ sources: [] }), output: [], usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 } }),
  });
  const checked = validateResearch(run, vanvitelli.slug, "openai", vanvitelli);
  assert(checked.linkedDocuments.length === 7 && checked.linkedDocuments.every((item) => item.url.endsWith(".pdf")), "the accepted admission page keeps a bounded PDF inventory");
  assert(checked.tests.required == null && checked.tests.types.length === 0, "PDF filenames do not set IMAT");
  assert(checked.application.deadlines.filter((item) => item.date === "2026-09-09" && item.dateType === "application_deadline").length === 1, "the opened target page stores the submission deadline once");
  assert(checked.researchWarnings.filter((warning) => warning === "PDF found — content not verified").length === 1, "unparsed PDFs produce one compact warning");
  assert(!fetched.some((url) => url.toLowerCase().includes(".pdf")), "linked PDFs are inventoried without being opened");
  assert(!checked.researchWarnings.some((warning) => warning.startsWith(`Identity not confirmed for ${englishAdmissionUrl}`)), "the opened target page does not repeat an identity warning");
  } finally {
    if (savedKey) process.env.OPENAI_API_KEY = savedKey;
    else delete process.env.OPENAI_API_KEY;
  }
}

async function main() {
  macerataAliasChecks();
  macerataIdentityConsistencyChecks();
  await discoveryLayerChecks();
  await discoveryHintChecks();
  await postIdentityAdmissionChecks();
  await submissionDeadlineChecks();
  process.env.OPENAI_API_KEY = "";
  let missing = "";
  try {
    await openaiResearch(subject);
  } catch (error) {
    missing = error instanceof Error ? error.message : String(error);
  }
  if (savedKey) process.env.OPENAI_API_KEY = savedKey;
  else delete process.env.OPENAI_API_KEY;
  assert(missing.includes("OPENAI_API_KEY is not configured"), "a missing OpenAI key stops research");
  assert(!/sk-[A-Za-z0-9_-]{8,}/.test(missing), "the missing-key error does not contain a key");
  assert(Boolean(savedKey?.trim()) === Boolean(process.env.OPENAI_API_KEY?.trim()), "the existing OpenAI credential stays in place");

  const failedId = await insertResearchJob({ slug: subject.slug, university: subject.universityName, provider: "mock" });
  const failed = await runResearchJob(failedId, subject, { id: "mock", research: async () => { throw new Error("provider down"); } });
  assert(failed == null, "a provider failure does not invent a result");
  const failedJob = await latestResearchJob(subject.slug);
  assert(failedJob?.status === "failed", "the job is marked failed");
  await deleteResearchJob(failedId);

  const id = await insertResearchJob({ slug: subject.slug, university: subject.universityName, provider: "mock" });
  const result = await runResearchJob(id, subject, { id: "mock", research: async () => italianEvidenceFixture(subject.slug) });
  assert(result?.reviewStatus === "pending_review" && result.sources[0]?.language === "it", "a completed mock job stays pending");
  await setReviewStatus(id, "rejected");
  const rejected = await latestResearchJob(subject.slug);
  assert(rejected?.reviewStatus === "rejected", "rejection does not approve enrichment");
  await deleteResearchJob(id);

  process.env.RESEARCH_RATE_LIMIT_WAIT_MS = "0";
  const limitedId = await insertResearchJob({ slug: subject.slug, university: subject.universityName, provider: "openai" });
  let rateCalls = 0;
  const limited = await runResearchJob(limitedId, subject, {
    id: "openai",
    research: async () => {
      rateCalls += 1;
      throw new ResearchRateLimitError("OpenAI research was rate limited. The catalogue was not changed.", 1);
    },
  });
  assert(limited == null && rateCalls === 2, "a 429 is retried once and then stopped");
  const limitedJob = await latestResearchJob(subject.slug);
  assert(limitedJob?.status === "rate_limited", "the job is marked rate limited");
  await deleteResearchJob(limitedId);
  delete process.env.RESEARCH_RATE_LIMIT_WAIT_MS;

  const denied = await new Promise<number>((resolve, reject) => {
    const req = http.request({ hostname: "127.0.0.1", port: 43127, path: "/api/admin/research", method: "GET", headers: { Connection: "close" } }, (res) => {
      res.resume();
      res.on("end", () => resolve(res.statusCode ?? 0));
    });
    req.on("error", reject);
    req.end();
  });
  assert(denied === 401, `research without the admin password returned ${denied}`);
  console.log("live OpenAI research pilot not run");
  console.log("phase 3a5 checks passed");
  process.exit(0);
}

main().catch(async (error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
