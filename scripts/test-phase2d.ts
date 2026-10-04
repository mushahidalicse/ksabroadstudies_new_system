import { buildRequirements } from "../src/lib/catalogue-requirements";
import { importRecords } from "../src/lib/enrichment-store";
import {
  applyEnrichment,
  emptyRecord,
  historyFor,
  normalizeRecord,
  publicEnglishLine,
  publicMoiLine,
  publicTuitionLine,
  saveGuards,
  type EnrichmentRecord,
  type EnrichmentStore,
} from "../src/lib/programme-enrichment";
import { matchProgramme } from "../src/lib/matching/programme-match";
import { BLANK_ENRICHMENT, type CatalogueCard } from "../src/lib/programme-catalogue";
import { EMPTY_PROFILE, type StudentProfile } from "../src/lib/student-types";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

function card(): CatalogueCard {
  return {
    slug: "sample-master-business",
    name: "Business Administration",
    level: "master",
    field: "Business",
    universityId: "sample",
    universityName: "University X",
    city: "Rome",
    region: "lazio",
    language: "English",
    status: "open",
    finderStatus: "open",
    deadline: "2026-11-15",
    deadlineLabel: "15 November 2026",
    countdown: null,
    estimatedDeadline: false,
    applicationFeeEuro: 30,
    englishRequirement: "IELTS 6.0 overall",
    admissionTest: null,
    centS: false,
    greGmat: false,
    requiresCimea: null,
    applyUrl: null,
    admissionPortal: null,
    universityWebsite: "https://example.edu",
    catalogueChecked: "2026-09-18",
    verificationStatus: "partially_verified",
    sourceUrl: "https://example.edu/admissions",
    sourceTitle: "University note",
    intake: "2026/27",
    ...BLANK_ENRICHMENT,
    requirements: buildRequirements({
      englishRequirement: "IELTS 6.0 overall",
      admissionTest: null,
      notes: null,
      cgpaRequirement: null,
    }),
  };
}

function verified(partial: Partial<EnrichmentRecord>): EnrichmentRecord {
  return {
    ...emptyRecord("sample-master-business"),
    sourceUrl: "https://example.edu/programme",
    sourceTitle: "Official programme page",
    sourceType: "official_programme_page",
    lastChecked: "2026-09-24",
    academicYear: "2026/27",
    verificationStatus: "verified",
    ...partial,
    english: { ...emptyRecord("sample-master-business").english, ...partial.english },
    test: { ...emptyRecord("sample-master-business").test, ...partial.test },
    tuition: { ...emptyRecord("sample-master-business").tuition, ...partial.tuition },
    academic: { ...emptyRecord("sample-master-business").academic, ...partial.academic },
  };
}

const student = (score: string): StudentProfile => ({
  ...EMPTY_PROFILE,
  studyLevel: "bachelors",
  targetStudyLevel: "master",
  field: "Business",
  cgpa: "3.4",
  gradeSystem: "cgpa",
  cgpaScale: "4",
  englishProof: "IELTS",
  englishScore: score,
  regionPreference: "lazio",
});

const base = card();
assert(base.requirements.english.ieltsMin === 6, "catalogue parse should keep IELTS 6.0");
assert(base.englishRequirement === "IELTS 6.0 overall", "original prose stays");

const blocked = normalizeRecord({ verificationStatus: "verified", english: { ieltsMin: 6.5 } }, base.slug);
assert(blocked.record === null && blocked.errors.some((error) => /source URL/i.test(error)), "verified without source is blocked");

const saved = verified({ english: { ...emptyRecord(base.slug).english, ieltsMin: 6.5, moi: "accepted" } });
const applied = applyEnrichment(base, saved, "2026-09-24");
assert(applied.requirements.english.ieltsMin === 6.5, "programme IELTS overrides the university sentence");
assert(applied.englishRequirement === "IELTS 6.0 overall", "original prose is not erased");
assert(publicEnglishLine(applied) === "IELTS 6.5", "finder line uses the programme value");
assert(publicMoiLine(applied) === "Accepted", "MOI accepted is explicit");
const below = matchProgramme(student("6.2"), applied);
assert(below.publishedConflicts.some((item) => /6\.5/.test(item.text)), "matching uses the programme IELTS 6.5");
assert(below.englishLine === "IELTS 6.5", "matches use the same English line");

const rejected = applyEnrichment(base, verified({ english: { ...saved.english, moi: "rejected" } }), "2026-09-24");
assert(publicMoiLine(rejected) === "Not accepted", "MOI rejected stays rejected");
const moiStudent = { ...student("7"), englishProof: "MOI" as const, moiAvailable: "yes" as const };
assert(matchProgramme(moiStudent, rejected).publishedConflicts.some((item) => /medium of instruction is not accepted/i.test(item.text)), "rejected MOI is a published conflict");

const single = applyEnrichment(base, verified({
  tuition: { ...emptyRecord(base.slug).tuition, mode: "single", amount: 2500, currency: "EUR", period: "year" },
}), "2026-09-24");
assert(single.requirements.tuition?.amount === 2500, "single tuition stays one amount");
assert(publicTuitionLine(single) === "€2500 / year", "single tuition display");

const range = applyEnrichment(base, verified({
  tuition: { ...emptyRecord(base.slug).tuition, mode: "range", min: 206, max: 356, currency: "EUR" },
}), "2026-09-24");
assert(range.requirements.tuition?.amount == null && range.requirements.tuition?.min === 206 && range.requirements.tuition?.max === 356, "a range is not collapsed");

const academic = applyEnrichment(base, verified({
  academic: { ...emptyRecord(base.slug).academic, minimumCgpa: 2.7, cgpaScale: 4, requiredBackground: ["Business"] },
}), "2026-09-24");
assert(academic.requirements.academic.minimumCgpa === 2.7 && academic.requirements.academic.requiredBackground[0] === "Business", "academic cutoff is stored");

const stale = applyEnrichment(base, { ...saved, lastChecked: "2024-01-01" }, "2026-09-24");
assert(stale.requirements.english.ieltsMin === 6, "an old check does not override the catalogue");

const outdated = applyEnrichment(base, { ...saved, verificationStatus: "outdated" }, "2026-09-24");
assert(outdated.requirementOrigin !== "verified", "outdated status does not apply");
assert(publicEnglishLine(outdated) === null, "outdated values are not shown as verified");

const changed = verified({ sourceUrl: "https://example.edu/new-call", sourceType: "official_admission_call" });
const history = historyFor(saved, changed, "2026-09-24T12:00:00.000Z");
assert(history.some((entry) => entry.field === "source" && entry.actor === "admin" && entry.previous.includes(saved.sourceUrl)), "source changes are recorded");
assert(saveGuards(saved, changed, {}).some((error) => /replacing the source/i.test(error)), "replacing a source needs confirmation");
assert(saveGuards(saved, { ...saved, verificationStatus: "needs_review" }, {}).some((error) => /clearing a verified/i.test(error)), "clearing verified status needs confirmation");
assert(saveGuards(saved, changed, { confirmSource: true }).every((error) => !/source/i.test(error)), "confirmed source replacement is allowed");
assert(history.every((entry) => !("password" in entry)), "history has no password field");

const store: EnrichmentStore = { records: [], history: [] };
const invalid = importRecords(store, [{ slug: "missing-programme", verificationStatus: "needs_review" }], new Set([base.slug]), "2026-09-24T12:00:00.000Z");
assert(invalid.errors.length > 0 && invalid.store.records.length === 0, "an unknown slug does not write");
const valid = importRecords(store, [saved], new Set([base.slug]), "2026-09-24T12:00:00.000Z");
assert(valid.errors.length === 0 && valid.store.records[0]?.english.ieltsMin === 6.5, "a valid record imports");

console.log("phase 2d checks passed");
process.exit(0);
